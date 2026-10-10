import { create } from "zustand";
import type { Track } from "../types";
import * as offlineDb from "../engine/offlineDb";
import { downloadTrackForOffline } from "../engine/downloadManager";

export type DownloadStatus = "none" | "downloading" | "downloaded" | "error";

type DownloadEntry = { status: DownloadStatus; progress: number; error?: string };

type DownloadsState = {
  statuses: Record<string, DownloadEntry>;
  download: (track: Track) => Promise<void>;
  remove: (trackId: string) => Promise<void>;
  hydrate: () => Promise<void>;
};

const IDLE: DownloadEntry = { status: "none", progress: 0 };

/**
 * UI-facing download status only — IndexedDB (offlineDb) is the durable
 * source of truth for "is this track downloaded". If storage is cleared
 * outside the app, this store just goes stale until the next hydrate();
 * playbackStore always checks offlineDb directly rather than trusting this.
 */
export const useDownloadsStore = create<DownloadsState>((set, get) => ({
  statuses: {},

  download: async (track) => {
    if (get().statuses[track.id]?.status === "downloading") return;
    set((s) => ({ statuses: { ...s.statuses, [track.id]: { status: "downloading", progress: 0 } } }));
    try {
      await downloadTrackForOffline(track, (fraction) => {
        set((s) => ({
          statuses: { ...s.statuses, [track.id]: { status: "downloading", progress: fraction } },
        }));
      });
      set((s) => ({ statuses: { ...s.statuses, [track.id]: { status: "downloaded", progress: 1 } } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed.";
      set((s) => ({ statuses: { ...s.statuses, [track.id]: { status: "error", progress: 0, error: message } } }));
      setTimeout(() => {
        // Only clear back to "none" if it's still showing this same error
        // (a retry in the meantime shouldn't get stomped).
        if (get().statuses[track.id]?.status === "error") {
          set((s) => ({ statuses: { ...s.statuses, [track.id]: IDLE } }));
        }
      }, 4000);
    }
  },

  remove: async (trackId) => {
    await offlineDb.deleteTrack(trackId);
    set((s) => ({ statuses: { ...s.statuses, [trackId]: IDLE } }));
  },

  hydrate: async () => {
    const ids = await offlineDb.listDownloadedIds().catch(() => [] as string[]);
    if (ids.length === 0) return;
    set((s) => {
      const statuses = { ...s.statuses };
      for (const id of ids) statuses[id] = { status: "downloaded", progress: 1 };
      return { statuses };
    });
  },
}));

void useDownloadsStore.getState().hydrate();
