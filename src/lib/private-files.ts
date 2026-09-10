import path from "path";

export const privateUploadRoot = path.join(process.cwd(), "storage", "uploads");

const contentTypes: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".csv": "text/csv",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function privateFileUrl(relativePath: string) {
  return `/api/files/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

export function resolvePrivateUploadPath(segments: string[]) {
  if (!segments.length) return null;
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\"))) return null;
  const resolved = path.resolve(privateUploadRoot, ...segments);
  const root = path.resolve(privateUploadRoot);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

export function contentTypeForFile(filePath: string) {
  return contentTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export function safeDownloadName(filePath: string) {
  return path.basename(filePath).replace(/[^a-zA-Z0-9._-]+/g, "-") || "download";
}
