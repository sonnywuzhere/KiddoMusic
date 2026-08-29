import { create } from "zustand";
import type { Track } from "../types";

/**
 * Playback state, shared across the library and the (mini)player without prop
 * drilling. Phase 2 only tracks *what* is selected — clicking a track sets the
 * current track and queue. Phase 3 binds this to the real AudioEngine and adds
 * pause/seek/next/prev with actual audio.
 */
type PlaybackState = {
  currentTrack: Track | null;
  queue: Track[];
  index: number; // position of currentTrack within queue
  isPlaying: boolean;

  /** Start playback of a track, optionally within a queue (defaults to [track]). */
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
};

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  currentTrack: null,
  queue: [],
  index: -1,
  isPlaying: false,

  playTrack: (track, queue) => {
    const q = queue && queue.length > 0 ? queue : [track];
    const index = Math.max(
      0,
      q.findIndex((t) => t.id === track.id),
    );
    set({ currentTrack: q[index] ?? track, queue: q, index, isPlaying: true });
  },

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  next: () => {
    const { queue, index } = get();
    if (index < queue.length - 1) {
      const nextIndex = index + 1;
      set({ index: nextIndex, currentTrack: queue[nextIndex], isPlaying: true });
    }
  },

  prev: () => {
    const { queue, index } = get();
    if (index > 0) {
      const prevIndex = index - 1;
      set({ index: prevIndex, currentTrack: queue[prevIndex], isPlaying: true });
    }
  },
}));
