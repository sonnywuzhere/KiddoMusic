import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlaybackStore } from "../../store/playbackStore";
import {
  extractPalette,
  DEFAULT_PALETTE,
  rgbString,
  type Palette,
} from "../../engine/colorExtraction";
import Backdrop from "./Backdrop";
import Controls from "./Controls";
import TrackTransition from "./TrackTransition";

type Props = { onClose: () => void };

const IDLE_MS = 3000;

/**
 * Full-screen Now Playing takeover (PRD Section 6) — the anchor feature.
 * Composes the ambient backdrop, hero typography, per-track crossfades, and
 * auto-hiding controls. Entry/exit is animated by the parent's AnimatePresence.
 */
export default function NowPlayingTakeover({ onClose }: Props) {
  const currentTrack = usePlaybackStore((s) => s.currentTrack);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const error = usePlaybackStore((s) => s.error);

  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  const [controlsVisible, setControlsVisible] = useState(true);
  const scrubbingRef = useRef(false);
  const hideTimer = useRef<number | undefined>(undefined);

  // Extract the palette whenever the track (its artwork) changes.
  useEffect(() => {
    if (!currentTrack?.artworkUrl) {
      setPalette(DEFAULT_PALETTE);
      return;
    }
    let cancelled = false;
    extractPalette(currentTrack.artworkUrl)
      .then((p) => !cancelled && setPalette(p))
      .catch(() => !cancelled && setPalette(DEFAULT_PALETTE));
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.artworkUrl]);

  // Auto-hide controls after idle; reveal on any pointer/touch activity.
  const revealControls = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!scrubbingRef.current) setControlsVisible(false);
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    revealControls();
    return () => window.clearTimeout(hideTimer.current);
  }, [revealControls]);

  // Keyboard: Esc exits, Space toggles play.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " ") {
        e.preventDefault();
        usePlaybackStore.getState().togglePlay();
        revealControls();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, revealControls]);

  if (!currentTrack) return null;

  const title = currentTrack.title;
  const artist = currentTrack.artist || "Unknown artist";
  const textColor = palette.isDark ? "text-white" : "text-black";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      onPointerMove={revealControls}
      onTouchStart={revealControls}
      style={{ cursor: controlsVisible ? "auto" : "none" }}
    >
      {/* Backdrop, crossfaded per track */}
      <AnimatePresence>
        <motion.div
          key={currentTrack.id}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
        >
          <Backdrop artworkUrl={currentTrack.artworkUrl} palette={palette} />
        </motion.div>
      </AnimatePresence>

      {/* Top bar */}
      <motion.div
        className="relative z-10 flex items-center justify-between px-5 py-4"
        animate={{ opacity: controlsVisible ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        style={{ pointerEvents: controlsVisible ? "auto" : "none" }}
      >
        <button
          onClick={onClose}
          aria-label="Close now playing"
          className={`flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none ${textColor}/80 hover:bg-white/10`}
        >
          ⌄
        </button>
        <span className={`text-[11px] uppercase tracking-[0.2em] ${textColor}/50`}>
          Now Playing
        </span>
        <span className="h-9 w-9" />
      </motion.div>

      {/* Hero: artwork + title + artist, crossfaded per track */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        <TrackTransition trackId={currentTrack.id}>
          {currentTrack.artworkUrl ? (
            <motion.img
              layoutId="np-art"
              src={currentTrack.artworkUrl}
              alt=""
              className="mb-8 h-56 w-56 rounded-2xl object-cover shadow-2xl sm:h-64 sm:w-64"
              style={{ boxShadow: `0 25px 80px -20px ${rgbString(palette.accent, 0.7)}` }}
            />
          ) : (
            <motion.div
              layoutId="np-art"
              className="mb-8 flex h-56 w-56 items-center justify-center rounded-2xl bg-white/10 text-6xl text-white/30 shadow-2xl sm:h-64 sm:w-64"
            >
              ♪
            </motion.div>
          )}

          <h1
            className={`max-w-2xl text-center text-4xl font-semibold tracking-tight sm:text-5xl ${textColor}`}
          >
            {title}
          </h1>
          <p className={`mt-3 text-lg ${textColor}/60`}>{artist}</p>
          {error && (
            <p className="mt-4 rounded-lg bg-red-500/20 px-3 py-1.5 text-sm text-red-200 backdrop-blur-sm">
              {error}
            </p>
          )}
        </TrackTransition>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 flex justify-center px-6 pb-10 pt-4">
        <Controls
          visible={controlsVisible}
          onScrubbingChange={(scrubbing) => {
            scrubbingRef.current = scrubbing;
            if (scrubbing) setControlsVisible(true);
            else revealControls();
          }}
        />
      </div>

      {/* Accessibility: announce play state changes without visual noise. */}
      <span className="sr-only" aria-live="polite">
        {isPlaying ? "Playing" : "Paused"}
      </span>
    </motion.div>
  );
}
