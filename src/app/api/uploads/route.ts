import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { privateFileUrl, privateUploadRoot } from "@/lib/private-files";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_PDF_SIZE = 50 * 1024 * 1024;
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

function hasImageSignature(buffer: Buffer, ext: string) {
  if (ext === ".png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === ".jpg" || ext === ".jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (ext === ".gif") return buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a";
  if (ext === ".webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

function hasPdfSignature(buffer: Buffer) {
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

export async function POST(request: Request) {
  const { error, user } = await requireUser();
  if (error) return error;
  const formData = await request.formData();
  const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length) return NextResponse.json({ message: "Select at least one image or PDF file." }, { status: 400 });

  const urls: string[] = [];
  for (const file of files) {
    const ext = (path.extname(file.name || "") || ".png").toLowerCase();
    const isPdf = ext === ".pdf";
    const isImage = imageExtensions.has(ext);
    if (!isPdf && !isImage) {
      return NextResponse.json({ message: `${file.name || "File"} must be an image or PDF.` }, { status: 400 });
    }
    if (file.type && isImage && !file.type.startsWith("image/")) {
      return NextResponse.json({ message: `${file.name || "File"} must be a valid image.` }, { status: 400 });
    }
    if (file.type && isPdf && file.type !== "application/pdf") {
      return NextResponse.json({ message: `${file.name || "File"} must be a valid PDF.` }, { status: 400 });
    }
    const limit = isPdf ? MAX_PDF_SIZE : MAX_IMAGE_SIZE;
    if (file.size > limit) return NextResponse.json({ message: `${file.name} exceeds the ${isPdf ? 50 : 5} MB ${isPdf ? "PDF" : "image"} size limit.` }, { status: 400 });
    const filename = `${Date.now()}-${randomUUID()}${ext.toLowerCase()}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (isImage && !hasImageSignature(buffer, ext)) {
      return NextResponse.json({ message: `${file.name || "File"} is not a valid image.` }, { status: 400 });
    }
    if (isPdf && !hasPdfSignature(buffer)) {
      return NextResponse.json({ message: `${file.name || "File"} is not a valid PDF.` }, { status: 400 });
    }
    const folder = isPdf ? "documents" : "images";
    const uploadDir = path.join(privateUploadRoot, folder);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);
    const storedUrl = privateFileUrl(`${folder}/${filename}`);
    urls.push(storedUrl);
    await auditAction({
      user,
      action: "FILE_UPLOAD",
      entity: "upload",
      entityId: filename,
      details: {
        originalName: file.name,
        storedUrl,
        size: file.size,
        mimeType: file.type || null,
      },
    });
  }

  return NextResponse.json({ urls });
}
