/**
 * Hand-rolled, promisified IndexedDB wrapper for offline track storage
 * (deliberately no `idb` dependency — same "raw browser API is enough"
 * philosophy as colorExtraction.ts). One record per track holds both the
 * audio and artwork blobs together, since they're always read/written/
 * removed as a unit — there's no case where you'd want one without the
 * other. This module is the single source of truth for "is this track
 * downloaded"; nothing else durably tracks that state.
 */

const DB_NAME = "kiddomusic-offline";
const DB_VERSION = 1;
const STORE_NAME = "tracks";

export type OfflineRecord = {
  id: string;
  audioBlob: Blob;
  artworkBlob: Blob | null;
  downloadedAt: number;
  size: number; // bytes (audio + artwork), for a future storage-used display
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open offline storage."));
  });
  return dbPromise;
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed."));
  });
}

/** Writes (or overwrites) a track's offline record. Rejects with the
 * original DOMException (e.g. QuotaExceededError) so callers can branch on
 * `err.name`. */
export async function putTrack(record: OfflineRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to save offline track."));
    tx.onabort = () => reject(tx.error ?? new Error("Offline save was aborted."));
  });
}

export async function getTrack(id: string): Promise<OfflineRecord | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const result = await promisifyRequest(tx.objectStore(STORE_NAME).get(id));
  return (result as OfflineRecord | undefined) ?? null;
}

export async function deleteTrack(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Failed to remove offline track."));
    tx.onabort = () => reject(tx.error ?? new Error("Offline removal was aborted."));
  });
}

/** Track ids that currently have an offline copy — used to hydrate UI status
 * at startup without loading every blob into memory. */
export async function listDownloadedIds(): Promise<string[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const keys = await promisifyRequest(tx.objectStore(STORE_NAME).getAllKeys());
  return keys as string[];
}
