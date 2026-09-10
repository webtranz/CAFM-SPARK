import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { auditAction } from "@/lib/audit";
import { privateFileUrl, privateUploadRoot } from "@/lib/private-files";
import { validateIncidentMedia } from "@/lib/incident-media";

export async function POST(request: Request) {
  const { error, user } = await requirePermission("servicerequests.create");
  if (error) return error;
  try {
    const form = await request.formData();
    const files = form.getAll("files");
    if (!files.length || files.length > 10 || files.some((file) => !(file instanceof File))) {
      return NextResponse.json({ message: "Select between 1 and 10 photos or videos." }, { status: 400 });
    }
    const selected = files as File[];
    if (selected.reduce((size, file) => size + file.size, 0) > 100 * 1024 * 1024) {
      return NextResponse.json({ message: "Upload up to 100 MB at a time." }, { status: 400 });
    }
    const validated = [];
    for (const file of selected) {
      const buffer = Buffer.from(await file.arrayBuffer());
      validated.push({ file, buffer, ext: validateIncidentMedia(file.name, buffer) });
    }
    const directory = path.join(privateUploadRoot, "incident-media");
    await mkdir(directory, { recursive: true });
    const urls: string[] = [];
    for (const { file, buffer, ext } of validated) {
      const filename = `${randomUUID()}${ext}`;
      await writeFile(path.join(directory, filename), buffer);
      const storedUrl = privateFileUrl(`incident-media/${filename}`);
      urls.push(storedUrl);
      await auditAction({ user, action: "FILE_UPLOAD", entity: "incident_media", entityId: filename,
        details: { originalName: file.name, storedUrl, size: file.size } });
    }
    return NextResponse.json({ urls });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to upload media." }, { status: 400 });
  }
}
