import type { Track, UploadError } from "../types";

export type UploadResult = { tracks: Track[]; errors: UploadError[] };

async function asError(res: Response): Promise<never> {
  let message = `Request failed (HTTP ${res.status})`;
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
  } catch {
    /* non-JSON error body — keep the generic message */
  }
  throw new Error(message);
}

export async function getTracks(): Promise<Track[]> {
  const res = await fetch("/api/tracks");
  if (!res.ok) return asError(res);
  const body = (await res.json()) as { tracks: Track[] };
  return body.tracks;
}

export async function updateTrack(
  id: string,
  fields: { title: string; artist: string; album: string },
): Promise<Track> {
  const res = await fetch(`/api/tracks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) return asError(res);
  const body = (await res.json()) as { track: Track };
  return body.track;
}

/**
 * Upload files with progress. Uses XMLHttpRequest because fetch() can't report
 * upload progress. Resolves with created tracks + per-file errors; rejects only
 * on a transport failure or a whole-request error (e.g. unsupported format).
 */
export function uploadTracks(
  files: File[],
  onProgress?: (fraction: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const file of files) form.append("files", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as UploadResult);
      } else {
        const msg =
          (body as { error?: string } | null)?.error ??
          `Upload failed (HTTP ${xhr.status})`;
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(form);
  });
}
