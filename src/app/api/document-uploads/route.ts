import { createHash, randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { privateFileUrl, privateUploadRoot } from "@/lib/private-files";
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

export async function DELETE(request: Request) {
  try {
    const { error, user } = await requireAdmin();
    if (error) return error;
    const id = new URL(request.url).searchParams.get("id");
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
