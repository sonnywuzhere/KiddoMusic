import type { Track } from "../types";

/**
 * mediaSession — a thin wrapper around the browser's Media Session API
 * (navigator.mediaSession), which gives the OS lock-screen / notification-shade
 * transport controls (title/artist/artwork + play/pause/skip/seek) and is part
 * of what keeps mobile browsers treating a background tab as an active media
 * session rather than something safe to silence.
 *
 * Every export is a no-op if the API isn't supported, so callers (playbackStore)
 * never need their own feature-detection — this mirrors AudioEngine.ts's
 * "degrade gracefully" pattern.
 */
const isSupported = typeof navigator !== "undefined" && "mediaSession" in navigator;

type ActionHandlers = {
  play: () => void;
  pause: () => void;
  previoustrack: () => void;
  nexttrack: () => void;
  seek: (seconds: number) => void;
  seekBy: (deltaSeconds: number) => void;
};

/** setActionHandler throws per-action-type if that action isn't supported —
 * one throwing must not stop the rest from registering. */
function safeSetActionHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null) {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // Unsupported action type in this browser — ignore.
  }
}

function setMetadata(track: Track) {
  if (!isSupported) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist || "Unknown artist",
    album: track.album || "",
    artwork: track.artworkUrl ? [{ src: track.artworkUrl }] : [],
  });
}

function setPlaybackState(state: MediaSessionPlaybackState) {
  if (!isSupported) return;
  navigator.mediaSession.playbackState = state;
}

function setPositionState(duration: number, position: number) {
  if (!isSupported) return;
  try {
    // Guard against transient bad values (e.g. a stale tick right after a
    // track change, before durationchange has landed) — the spec throws a
    // TypeError for position > duration or non-finite values.
    if (!Number.isFinite(duration) || !Number.isFinite(position) || duration <= 0) return;
    navigator.mediaSession.setPositionState({
      duration,
      position: Math.min(position, duration),
      playbackRate: 1,
    });
  } catch {
    // Ignore — not worth surfacing a lock-screen scrub-bar glitch as an app error.
  }
}

function clear() {
  if (!isSupported) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = "none";
}

function bindActionHandlers(handlers: ActionHandlers) {
  if (!isSupported) return;
  safeSetActionHandler("play", () => handlers.play());
  safeSetActionHandler("pause", () => handlers.pause());
  safeSetActionHandler("previoustrack", () => handlers.previoustrack());
  safeSetActionHandler("nexttrack", () => handlers.nexttrack());
  safeSetActionHandler("seekto", (details) => {
    if (typeof details.seekTime === "number") handlers.seek(details.seekTime);
  });
  safeSetActionHandler("seekbackward", (details) => {
    handlers.seekBy(-(details.seekOffset ?? 10));
  });
  safeSetActionHandler("seekforward", (details) => {
    handlers.seekBy(details.seekOffset ?? 10);
  });
  safeSetActionHandler("stop", () => {
    handlers.pause();
    handlers.seek(0);
    setPlaybackState("none");
  });
}

export const mediaSession = {
  setMetadata,
  setPlaybackState,
  setPositionState,
  clear,
  bindActionHandlers,
};
