import { create } from "zustand";
import type { Track } from "../types";
import { audioEngine } from "../engine/AudioEngine";
import { mediaSession } from "../engine/mediaSession";
import * as offlineDb from "../engine/offlineDb";
import { buildPlaybackQueue, shuffleFromHere } from "./queueOrder";

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
  /** When on, upcoming tracks play in a shuffled order. The current track keeps playing. */
  shuffle: boolean;

  playTrack: (track: Track, queue?: Track[]) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  toggleShuffle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  addToQueue: (track: Track) => void;
  removeTrack: (id: string) => void;
};

// Blob URLs for the currently-loaded track's offline copy (if any), so they
// can be revoked on the next track change instead of leaking. Module-scoped
// (not component state) because playback — and now offline storage access —
// lives outside React, same as audioEngine itself.
let activeBlobUrls: { audio: string; artwork: string | null } | null = null;
let currentSourceIsLocal = false;

// Order the listener asked for (library list, album, or "add to queue"
// appends). `queue` in the store is the playback order, which diverges from
// this only while shuffle is on. Module-scoped like the blob URLs: nothing
// in the UI reads it, and it must survive across the async load in loadIndex.
let sourceQueue: Track[] = [];

function revokeActiveBlobUrls() {
  if (activeBlobUrls) {
    URL.revokeObjectURL(activeBlobUrls.audio);
    if (activeBlobUrls.artwork) URL.revokeObjectURL(activeBlobUrls.artwork);
    activeBlobUrls = null;
  }
}

export const usePlaybackStore = create<PlaybackState>((set, get) => {
  // Guards against out-of-order async resolution: a rapid skip can start a
  // second loadIndex before the first's offlineDb lookup resolves, and the
  // stale one must not clobber state set by the newer one.
  let loadToken = 0;

  // Load a track at a given queue index into the engine and start playing.
  // Prefers an offline (IndexedDB) copy when one exists, regardless of
  // connectivity — navigator.onLine is unreliable, so "local copy present"
  // is the only signal trusted for that. Only used, otherwise, to explain a
  // load/play failure for a track with no local copy.
  async function loadIndex(index: number, queue: Track[]) {
    const track = queue[index];
    if (!track) return;
    const requestId = ++loadToken;

    set({
      index,
      queue,
      error: null,
      currentTime: 0,
      duration: track.duration ?? 0,
      buffering: true,
    });

    const offline = await offlineDb.getTrack(track.id).catch(() => null);
    if (requestId !== loadToken) return; // superseded by a newer load

    if (!offline && navigator.onLine === false) {
      revokeActiveBlobUrls();
      currentSourceIsLocal = false;
      set({
        currentTrack: track,
        buffering: false,
        isPlaying: false,
        error:
          "You're offline and this track isn't downloaded. Connect to the internet or download it for offline listening.",
      });
      return;
    }

    revokeActiveBlobUrls();
    currentSourceIsLocal = !!offline;

    let playableTrack = track;
    if (offline) {
      const audioUrl = URL.createObjectURL(offline.audioBlob);
      const artUrl = offline.artworkBlob ? URL.createObjectURL(offline.artworkBlob) : null;
      activeBlobUrls = { audio: audioUrl, artwork: artUrl };
      // A fresh copy — the pristine, network-URL Track in `queue` is never
      // mutated, so other components rendering that same object are unaffected.
      playableTrack = { ...track, streamUrl: audioUrl, artworkUrl: artUrl ?? track.artworkUrl };
    }

    set({ currentTrack: playableTrack });
    audioEngine.load(playableTrack.streamUrl);
    void audioEngine.play();
    mediaSession.setMetadata(playableTrack);
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
    shuffle: false,

    playTrack: (track, queue) => {
      const source = queue && queue.length > 0 ? queue : [track];
      // findIndex is -1 when the track isn't in the list; the old behavior
      // then starts at 0. Math.max keeps that.
      const start = Math.max(0, source.findIndex((t) => t.id === track.id));
      sourceQueue = source.slice();
      const playback = buildPlaybackQueue(source, start, get().shuffle);
      loadIndex(playback.index, playback.queue);
    },

    play: () => {
      const { currentTrack, isPlaying } = get();
      if (currentTrack && !isPlaying) void audioEngine.play();
    },

    pause: () => {
      const { currentTrack, isPlaying } = get();
      if (currentTrack && isPlaying) audioEngine.pause();
    },

    togglePlay: () => {
      const { isPlaying } = get();
      if (isPlaying) get().pause();
      else get().play();
    },

    toggleShuffle: () => {
      const { shuffle, queue, index, currentTrack } = get();
      if (!shuffle) {
        // Reorder only. The current track stays loaded; history stays so
        // "previous" still walks back through what already played.
        set({ shuffle: true, queue: shuffleFromHere(queue, index) });
        return;
      }
      const origin = sourceQueue.length > 0 ? sourceQueue : queue;
      const sourceIndex = currentTrack ? origin.findIndex((t) => t.id === currentTrack.id) : -1;
      if (sourceIndex === -1) {
        set({ shuffle: false });
        return;
      }
      set({ shuffle: false, queue: origin.slice(), index: sourceIndex });
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
      // If nothing is playing, start it; otherwise append. An explicit
      // "add to queue" stays at the end even while shuffle is on — the
      // listener asked for this track, so it isn't buried in the shuffle.
      if (!currentTrack) {
        sourceQueue = [track];
        loadIndex(0, [track]);
      } else {
        sourceQueue = [...sourceQueue, track];
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
      sourceQueue = sourceQueue.filter((t) => t.id !== id);

      if (currentTrack?.id !== id) {
        // Removing an unrelated queue entry — just shift the current index
        // down if the removed track sat before it.
        set({ queue: newQueue, index: removedAt < index ? index - 1 : index });
        return;
      }

      if (newQueue.length === 0) {
        audioEngine.pause();
        audioEngine.load("");
        mediaSession.clear();
        revokeActiveBlobUrls();
        sourceQueue = [];
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

// Wire engine events → store (and the OS-level media session). Done once at
// module load.
audioEngine.setEvents({
  onTime: (t) => {
    usePlaybackStore.setState({ currentTime: t });
    mediaSession.setPositionState(usePlaybackStore.getState().duration, t);
  },
  onDuration: (d) => usePlaybackStore.setState({ duration: d }),
  onPlay: () => {
    usePlaybackStore.setState({ isPlaying: true, buffering: false });
    mediaSession.setPlaybackState("playing");
  },
  onPause: () => {
    usePlaybackStore.setState({ isPlaying: false });
    mediaSession.setPlaybackState("paused");
  },
  onWaiting: () => usePlaybackStore.setState({ buffering: true }),
  onCanPlay: () => usePlaybackStore.setState({ buffering: false }),
  onError: (message) => {
    // Defense-in-depth: navigator.onLine can report true on a connection
    // that can't actually reach the server (captive portal, etc.), so a
    // genuinely-offline failure can still surface here rather than via the
    // proactive check in loadIndex.
    const enriched =
      !currentSourceIsLocal && navigator.onLine === false
        ? "You appear to be offline, and this track hasn't been downloaded for offline listening."
        : message;
    usePlaybackStore.setState({ error: enriched, isPlaying: false, buffering: false });
  },
  onEnded: () => {
    const { index, queue } = usePlaybackStore.getState();
    if (index < queue.length - 1) {
      usePlaybackStore.getState().next();
    } else {
      // End of queue — track is still loaded, just no longer playing, so the
      // lock screen should show "paused", not clear the session entirely.
      usePlaybackStore.setState({ isPlaying: false, currentTime: 0 });
      mediaSession.setPlaybackState("paused");
    }
  },
});

// Lock-screen / notification transport controls → the same store actions the
// on-screen UI uses.
mediaSession.bindActionHandlers({
  play: () => usePlaybackStore.getState().play(),
  pause: () => usePlaybackStore.getState().pause(),
  previoustrack: () => usePlaybackStore.getState().prev(),
  nexttrack: () => usePlaybackStore.getState().next(),
  seek: (seconds) => usePlaybackStore.getState().seek(seconds),
  seekBy: (delta) => {
    const { currentTime, duration, seek } = usePlaybackStore.getState();
    seek(Math.max(0, Math.min(duration, currentTime + delta)));
  },
});
