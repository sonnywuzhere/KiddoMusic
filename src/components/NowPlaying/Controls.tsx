import { motion } from "framer-motion";
import { usePlaybackStore } from "../../store/playbackStore";
import { formatDuration } from "../../utils/format";

type Props = {
  visible: boolean;
  onScrubbingChange: (scrubbing: boolean) => void;
};

/**
 * Minimal, auto-hiding transport for the takeover (PRD 6.5): scrub bar, time,
 * prev / play-pause / next, and an unobtrusive exit affordance. Visibility is
 * driven by the parent's idle timer; scrubbing is reported up so the parent
 * keeps controls visible during a drag.
 */
export default function Controls({ visible, onScrubbingChange }: Props) {
  const {
    currentTrack,
    isPlaying,
    buffering,
    queue,
    index,
    currentTime,
    duration,
    togglePlay,
    next,
    prev,
    seek,
  } = usePlaybackStore();

  if (!currentTrack) return null;
  const total = duration || currentTrack.duration || 0;
  const hasNext = index < queue.length - 1;

  return (
    <motion.div
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 12 }}
      transition={{ duration: 0.3 }}
      style={{ pointerEvents: visible ? "auto" : "none" }}
      className="w-full max-w-xl"
    >
      {/* Scrub bar + time */}
      <div className="flex items-center gap-3">
        <span className="w-10 text-right text-xs tabular-nums text-white/70">
          {formatDuration(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={total || 0}
          step={0.1}
          value={Math.min(currentTime, total || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          onPointerDown={() => onScrubbingChange(true)}
          onPointerUp={() => onScrubbingChange(false)}
          aria-label="Seek"
          className="mp-range h-1 flex-1 cursor-pointer"
          style={{ ["--pct" as string]: `${total ? (currentTime / total) * 100 : 0}%` }}
        />
        <span className="w-10 text-xs tabular-nums text-white/70">
          {formatDuration(total || null)}
        </span>
      </div>

      {/* Transport */}
      <div className="mt-5 flex items-center justify-center gap-6">
        <button
          onClick={prev}
          aria-label="Previous"
          className="text-2xl text-white/80 transition-transform hover:scale-110"
        >
          ⏮
        </button>
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xl text-black shadow-lg transition-transform hover:scale-105"
        >
          {buffering ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
          ) : isPlaying ? (
            "❚❚"
          ) : (
            "▶"
          )}
        </button>
        <button
          onClick={next}
          disabled={!hasNext}
          aria-label="Next"
          className="text-2xl text-white/80 transition-transform hover:scale-110 disabled:opacity-30"
        >
          ⏭
        </button>
      </div>
    </motion.div>
  );
}
