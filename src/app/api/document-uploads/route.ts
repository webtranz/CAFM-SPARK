import { createHash, randomUUID } from "crypto";
import { access, mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireAdmin, requireUser } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { privateFileUrl, privateUploadRoot, resolvePrivateUploadPath } from "@/lib/private-files";
import { prisma } from "@/lib/prisma";

const MAX_FILE_SIZE = 60 * 1024 * 1024;
const documentCategories: Record<string, string> = {
  OM_MANUAL: "operation-maintenance-management",
  WARRANTY_GUARANTEE: "equipment-warranties-and-guarantees",
  SUPPORT_CONTRACT_SLA: "support-contracts-and-slas",
};
const allowedExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".txt", ".csv", ".xlsx", ".docx", ".pptx"]);

function safeSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function privateUrlSegments(fileUrl: string) {
  if (!fileUrl.startsWith("/api/files/")) return null;
  return fileUrl
    .slice("/api/files/".length)
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .filter(Boolean);
}

async function fileExists(fileUrl: string) {
  const segments = privateUrlSegments(fileUrl);
  const filePath = segments ? resolvePrivateUploadPath(segments) : null;
  if (!filePath) return fileUrl.startsWith("http://") || fileUrl.startsWith("https://") || fileUrl.startsWith("/uploads/");
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  try {
    const { error } = await requireUser();
    if (error) return error;
    const searchParams = new URL(request.url).searchParams;
    const category = searchParams.get("category") || undefined;
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 100)));
    const skip = (page - 1) * pageSize;
    const where = category ? { category } : {};

    const [documents, total] = await Promise.all([
      prisma.documentUpload.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
      prisma.documentUpload.count({ where }),
    ]);
    const assetTags = Array.from(new Set(documents.map((document) => document.assetTag).filter(Boolean)));
    const assets = assetTags.length
      ? await prisma.asset.findMany({
          where: { tag: { in: assetTags } },
          select: {
            tag: true,
            assetGroup: true,
            category: true,
            siteCode: true,
            buildingCode: true,
            floor: true,
            room: true,
            assignedSupervisorEmail: true,
            assignedTeamCode: true,
          },
        })
      : [];
    const assetsByTag = new Map(assets.map((asset) => [asset.tag, asset]));
    const rows = await Promise.all(documents.map(async (document) => {
      const asset = assetsByTag.get(document.assetTag);
      const exists = await fileExists(document.fileUrl);
      return {
        id: document.id,
        canDelete: true,
        category: document.category,
        documentType:
          document.category === "OM_MANUAL" ? "O&M Manual" :
          document.category === "WARRANTY_GUARANTEE" ? "Warranty / Guarantee" :
          "Support Contract / SLA",
        reference: document.assetTag,
        title: document.fileName,
        assetType: asset?.assetGroup || asset?.category || "-",
        location: [asset?.siteCode, asset?.buildingCode, asset?.floor, asset?.room].filter(Boolean).join(" / ") || "-",
        owner: document.uploadedBy || asset?.assignedSupervisorEmail || asset?.assignedTeamCode || "Document Management",
        provider: document.uploadedBy || "Document Management",
        scope: document.assetTag,
        sla: "-",
        expiryDate: "-",
        status: exists ? "AVAILABLE" : "MISSING FILE",
        attachment: exists ? document.fileUrl : "",
        missingFileUrl: exists ? "" : document.fileUrl,
        uploadedAt: document.createdAt,
        fileSize: document.fileSize,
        size: document.fileSize,
      };
    }));

    return NextResponse.json({ rows, total, page, pageSize });
  } catch {
    return NextResponse.json({ message: "Unable to load documents." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { error, user } = await requireAdmin();
    if (error) return error;
    const searchParams = new URL(request.url).searchParams;
    const id = searchParams.get("id");
    const category = searchParams.get("category");
    const confirm = searchParams.get("confirm");
    if (category) {
      if (!documentCategories[category]) return NextResponse.json({ message: "Invalid document category." }, { status: 400 });
      if (confirm !== "DELETE_ALL") return NextResponse.json({ message: "Bulk document delete confirmation is required." }, { status: 400 });
      const result = await prisma.documentUpload.deleteMany({ where: { category } });
      await auditAction({
        user,
        action: "DOCUMENT_UPLOAD_BULK_DELETE",
        entity: "document_upload",
        entityId: category,
        details: { category, deletedCount: result.count },
      });
      return NextResponse.json({ ok: true, deletedCount: result.count });
    }
    if (!id) return NextResponse.json({ message: "Document id is required." }, { status: 400 });
    const current = await prisma.documentUpload.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ message: "Document not found." }, { status: 404 });
    await prisma.documentUpload.delete({ where: { id } });
    await auditAction({ user, action: "DOCUMENT_UPLOAD_DELETE", entity: "document_upload", entityId: id, details: { deletedRecord: current } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: "Unable to delete document." }, { status: 500 });
  }
}

function hasExecutableSignature(buffer: Buffer) {
  const start = buffer.subarray(0, 4).toString("utf8");
  return start.startsWith("MZ") || start.startsWith("\u007fELF") || start.startsWith("#!");
}

export async function POST(request: Request) {
  try {
    const { error, user } = await requireAdmin();
    if (error) return error;
    const formData = await request.formData();
    const category = String(formData.get("category") || "");
    const assetTag = String(formData.get("assetTag") || "").trim();
    const assetFolder = safeSegment(assetTag);
    const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    const folder = documentCategories[category];

    if (!folder) return NextResponse.json({ message: "Invalid document category." }, { status: 400 });
    if (!assetTag || !assetFolder) return NextResponse.json({ message: "Asset Number is required." }, { status: 400 });
    if (!files.length) return NextResponse.json({ message: "Select at least one file." }, { status: 400 });

    const asset = await prisma.asset.findUnique({ where: { tag: assetTag } });
    if (!asset) return NextResponse.json({ message: "Asset Number was not found." }, { status: 404 });

    const uploadDir = path.join(privateUploadRoot, "document-management", folder, assetFolder);
    await mkdir(uploadDir, { recursive: true });

    const saved = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ message: `${file.name} exceeds the 60 MB file size limit.` }, { status: 400 });
      }

      const originalName = file.name || "document";
      const ext = path.extname(originalName).toLowerCase();
      if (!allowedExtensions.has(ext)) {
        return NextResponse.json({ message: `${originalName} is not an allowed document type.` }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      if (hasExecutableSignature(buffer)) {
        return NextResponse.json({ message: `${originalName} was rejected by security checks.` }, { status: 400 });
      }

      const baseName = safeSegment(path.basename(originalName, ext)) || "document";
      const fileName = `${Date.now()}-${randomUUID()}-${baseName}${ext}`;
      await writeFile(path.join(uploadDir, fileName), buffer, { mode: 0o644 });

      const fileUrl = privateFileUrl(`document-management/${folder}/${assetFolder}/${fileName}`);
      const record = await prisma.documentUpload.create({
        data: {
          category,
          assetTag,
          fileName: originalName,
          fileUrl,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          checksum: createHash("sha256").update(buffer).digest("hex"),
          uploadedBy: user?.email || user?.name || null,
        },
      });
      saved.push(record);
      await auditAction({
        user,
        action: "DOCUMENT_UPLOAD_CREATE",
        entity: "document_upload",
        entityId: record.id,
        details: {
          category,
          assetTag,
          originalName,
          storedUrl: fileUrl,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          checksum: record.checksum,
          uploadedBy: record.uploadedBy,
        },
      });
    }

    return NextResponse.json({ documents: saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Unable to upload document." }, { status: 500 });
  }
}
