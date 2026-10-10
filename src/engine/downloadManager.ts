import type { Track } from "../types";
import * as offlineDb from "./offlineDb";

/**
 * Fetches a track's audio + artwork and persists them to IndexedDB for
 * offline playback. Audio uses XHR (mirrors uploadTracks' upload-progress
 * pattern in api/client.ts, just the receive side — xhr.onprogress instead
 * of xhr.upload.onprogress) so callers get byte-accurate progress; artwork
 * is small enough that a plain fetch without progress is fine.
 */
export function downloadTrackForOffline(
  track: Track,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const audioPromise = new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", track.streamUrl);
    xhr.responseType = "blob";
    xhr.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as Blob);
      } else {
        reject(new Error(`Couldn't download this track (HTTP ${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error("Couldn't reach the server to download this track."));
    xhr.send();
  });

  const artworkPromise: Promise<Blob | null> = track.artworkUrl
    ? fetch(track.artworkUrl)
        .then((res) => (res.ok ? res.blob() : null))
        .catch(() => null) // artwork is a nice-to-have offline — never fail the download over it
    : Promise.resolve(null);

  return Promise.all([audioPromise, artworkPromise]).then(async ([audioBlob, artworkBlob]) => {
    try {
      await offlineDb.putTrack({
        id: track.id,
        audioBlob,
        artworkBlob,
        downloadedAt: Date.now(),
        size: audioBlob.size + (artworkBlob?.size ?? 0),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "QuotaExceededError") {
        throw new Error("Not enough storage space on this device to download this track.");
      }
      throw err instanceof Error ? err : new Error("Couldn't save this track for offline listening.");
    }
  });
}
