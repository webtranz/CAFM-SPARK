import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/api-auth";
import { privateFileUrl, privateUploadRoot } from "@/lib/private-files";

const MAX_DOCUMENT_FILE_SIZE = 60 * 1024 * 1024;
const folder = "operation-maintenance-management";
const uploadDir = path.join(privateUploadRoot, "document-management", folder, "_manual-library");
const manifestPath = path.join(uploadDir, "manifest.json");
const allowedExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".txt", ".csv", ".xlsx", ".docx", ".pptx"]);

type ManualManifest = Record<string, { checksum: string; fileName: string; fileSize: number; fileUrl: string; mimeType: string; originalName: string }>;

export async function POST(request: Request) {
  try {
    const { error } = await requireAnyPermission(["documents.upload"]);
    if (error) return error;

    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    if (!files.length) return NextResponse.json({ message: "Select at least one manual file." }, { status: 400 });

    await mkdir(uploadDir, { recursive: true });
    const manifest = await readManifest();
    const saved = [];

    for (const file of files) {
      const originalName = file.name || "document";
      const ext = path.extname(originalName).toLowerCase();
      if (!allowedExtensions.has(ext)) return NextResponse.json({ message: `${originalName} is not an allowed document type.` }, { status: 400 });
      if (file.size > MAX_DOCUMENT_FILE_SIZE) return NextResponse.json({ message: `${originalName} exceeds the 60 MB document size limit.` }, { status: 400 });

      const buffer = Buffer.from(await file.arrayBuffer());
      const checksum = createHash("sha256").update(buffer).digest("hex");
      const storedName = `${checksum}-${safeSegment(path.basename(originalName, ext)) || "document"}${ext}`;
      await writeFile(path.join(uploadDir, storedName), buffer, { mode: 0o644 });

      const record = {
        checksum,
        fileName: storedName,
        fileSize: file.size,
        fileUrl: privateFileUrl(`document-management/${folder}/_manual-library/${storedName}`),
        mimeType: mimeTypeFromExtension(ext),
        originalName,
      };
      manifest[originalName.trim().toLowerCase()] = record;
      saved.push(record);
    }

    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    return NextResponse.json({ saved, total: Object.keys(manifest).length });
  } catch {
    return NextResponse.json({ message: "Manual library upload failed." }, { status: 500 });
  }
}

async function readManifest(): Promise<ManualManifest> {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    return {};
  }
}

function safeSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function mimeTypeFromExtension(ext: string) {
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".csv") return "text/csv";
  if (ext === ".txt") return "text/plain";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}
