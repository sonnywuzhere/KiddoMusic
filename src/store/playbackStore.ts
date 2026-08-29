import { create } from "zustand";
import type { Track } from "../types";
import { audioEngine } from "../engine/AudioEngine";

/**
 * Playback state, bound to the shared AudioEngine. Components read this store;
 * the engine (an out-of-React singleton) does the actual audio, so playback
 * persists across screen/component changes.
 */
type PlaybackState = {
  currentTrack: Track | null;
  queue: Track[];
  index: number; // position of currentTrack within queue
  isPlaying: boolean;
  buffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  error: string | null;

  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  addToQueue: (track: Track) => void;
  removeTrack: (id: string) => void;
};

export const usePlaybackStore = create<PlaybackState>((set, get) => {
  // Load a track at a given queue index into the engine and start playing.
  function loadIndex(index: number, queue: Track[]) {
    const track = queue[index];
    if (!track) return;
    set({
      currentTrack: track,
      index,
      queue,
      error: null,
      currentTime: 0,
      duration: track.duration ?? 0,
      buffering: true,
    });
    audioEngine.load(track.streamUrl);
    void audioEngine.play();
  }

  return {
    currentTrack: null,
    queue: [],
    index: -1,
    isPlaying: false,
    buffering: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    error: null,

    playTrack: (track, queue) => {
      const q = queue && queue.length > 0 ? queue : [track];
      const index = Math.max(
        0,
        q.findIndex((t) => t.id === track.id),
      );
      loadIndex(index, q);
    },

    togglePlay: () => {
      const { isPlaying, currentTrack } = get();
      if (!currentTrack) return;
      if (isPlaying) audioEngine.pause();
      else void audioEngine.play();
    },

    next: () => {
      const { queue, index } = get();
      if (index < queue.length - 1) loadIndex(index + 1, queue);
    },

    prev: () => {
      const { queue, index, currentTime } = get();
      // Standard behavior: restart the track unless we're near the start.
      if (currentTime > 3) {
        audioEngine.seek(0);
        return;
      }
      if (index > 0) loadIndex(index - 1, queue);
      else audioEngine.seek(0);
    },

    seek: (seconds) => {
      audioEngine.seek(seconds);
      set({ currentTime: seconds });
    },

    setVolume: (v) => {
      const vol = Math.min(1, Math.max(0, v));
      audioEngine.setVolume(vol);
      set({ volume: vol });
    },

    addToQueue: (track) => {
      const { queue, currentTrack } = get();
      // If nothing is playing, start it; otherwise append.
      if (!currentTrack) {
        loadIndex(0, [track]);
      } else {
        set({ queue: [...queue, track] });
      }
    },

    // Called after a track is deleted from the library, so a currently-loaded
    // (or merely queued) copy of it doesn't linger in playback state.
    removeTrack: (id) => {
      const { queue, currentTrack, index } = get();
      const removedAt = queue.findIndex((t) => t.id === id);
      if (removedAt === -1) return; // not in this queue — nothing to do

      const newQueue = queue.filter((t) => t.id !== id);

      if (currentTrack?.id !== id) {
        // Removing an unrelated queue entry — just shift the current index
        // down if the removed track sat before it.
        set({ queue: newQueue, index: removedAt < index ? index - 1 : index });
        return;
      }

      if (newQueue.length === 0) {
        audioEngine.pause();
        audioEngine.load("");
        set({
          currentTrack: null,
          queue: [],
          index: -1,
          isPlaying: false,
          buffering: false,
          currentTime: 0,
          duration: 0,
          error: null,
        });
        return;
      }

      // The next track slides into the removed one's position; clamp at the end.
      loadIndex(Math.min(removedAt, newQueue.length - 1), newQueue);
    },
  };
});

// Wire engine events → store. Done once at module load.
audioEngine.setEvents({
  onTime: (t) => usePlaybackStore.setState({ currentTime: t }),
  onDuration: (d) => usePlaybackStore.setState({ duration: d }),
  onPlay: () => usePlaybackStore.setState({ isPlaying: true, buffering: false }),
  onPause: () => usePlaybackStore.setState({ isPlaying: false }),
  onWaiting: () => usePlaybackStore.setState({ buffering: true }),
  onCanPlay: () => usePlaybackStore.setState({ buffering: false }),
  onError: (message) =>
    usePlaybackStore.setState({ error: message, isPlaying: false, buffering: false }),
  onEnded: () => {
    const { index, queue } = usePlaybackStore.getState();
    if (index < queue.length - 1) {
      usePlaybackStore.getState().next();
    } else {
      usePlaybackStore.setState({ isPlaying: false, currentTime: 0 });
    }
  },
});
