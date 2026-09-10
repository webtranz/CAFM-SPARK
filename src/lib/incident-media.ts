export const INCIDENT_MEDIA_ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mov";

export function validateIncidentMedia(name: string, buffer: Buffer) {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  const video = [".mp4", ".webm", ".mov"].includes(ext);
  const limit = (video ? 50 : 5) * 1024 * 1024;
  if (!buffer.length || buffer.length > limit) throw new Error(`${name}: maximum ${video ? 50 : 5} MB per file.`);
  const valid =
    ext === ".png" ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) :
    [".jpg", ".jpeg"].includes(ext) ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 :
    ext === ".gif" ? ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii")) :
    ext === ".webp" ? buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP" :
    ext === ".webm" ? buffer.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])) :
    [".mp4", ".mov"].includes(ext) ? buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp" : false;
  if (!valid) throw new Error(`${name}: unsupported or invalid photo/video. Use PNG, JPG, GIF, WebP, MP4, WebM or MOV.`);
  return ext;
}
