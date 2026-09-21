"use client";

import { useRef, useState } from "react";
import { INCIDENT_MEDIA_ACCEPT } from "@/lib/incident-media";

export function IncidentMediaGallery({ urls, onRemove }: { urls: string[]; onRemove?: (url: string) => void }) {
  const safeUrls = urls.filter((url) => url.startsWith("/api/files/") || url.startsWith("/uploads/") || /^https?:\/\//i.test(url));
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {safeUrls.map((url, index) => <div key={url} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2">
      {/\.(mp4|webm|mov)(?:[?#]|$)/i.test(url)
        ? <video controls preload="metadata" src={url} className="h-40 w-full rounded-lg bg-slate-100" />
        : <img src={url} alt={`Incident attachment ${index + 1}`} className="h-40 w-full rounded-lg object-contain" />}
      <a href={url} target="_blank" rel="noreferrer" className="text-sm font-bold text-lagoon">Open attachment {index + 1}</a>
      {onRemove && <button type="button" onClick={() => onRemove(url)} className="text-sm font-bold text-coral">Remove attachment {index + 1}</button>}
    </div>)}
  </div>;
}

export function IncidentMediaUpload({ onUploading, initialUrls = [] }: { onUploading: (busy: boolean) => void; initialUrls?: string[] }) {
  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function upload(files: File[]) {
    if (!files.length) return;
    setBusy(true); onUploading(true); setError("");
    try {
      const body = new FormData();
      files.forEach((file) => body.append("files", file));
      const response = await fetch("/api/uploads/incident-media", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Upload failed. Please retry.");
      setUrls((current) => [...current, ...result.urls]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload failed. Please retry.");
    } finally {
      setBusy(false); onUploading(false);
      if (input.current) input.current.value = "";
    }
  }
  return <div className="grid gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-3">
    <input type="hidden" name="attachmentUrls" value={urls.join("\n")} />
    <input ref={input} type="file" accept={INCIDENT_MEDIA_ACCEPT} multiple hidden disabled={busy}
      onChange={(event) => void upload(Array.from(event.target.files || []))} />
    <button type="button" disabled={busy} onClick={() => input.current?.click()}
      className="rounded-lg bg-lagoon px-4 py-2 text-sm font-black text-white disabled:bg-slate-300">
      {busy ? "Uploading media..." : "Attach photos / videos"}
    </button>
    <p className="text-xs text-slate-500">Photos up to 5 MB; MP4, WebM or MOV videos up to 50 MB. Up to 10 files / 100 MB per upload.</p>
    {error && <p role="alert" className="text-sm text-coral">{error}</p>}
    <IncidentMediaGallery urls={urls} onRemove={(url) => setUrls((current) => current.filter((item) => item !== url))} />
  </div>;
}
