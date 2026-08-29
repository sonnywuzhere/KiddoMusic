import { usePlaybackStore } from "../../store/playbackStore";
import { formatDuration } from "../../utils/format";

/**
 * Persistent bottom now-playing bar, bound to the real AudioEngine via the
 * store. Lives at the app root so it survives screen changes. Phase 4 makes it
 * the entry point into the full-screen Now Playing takeover.
 */
export default function MiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    buffering,
    queue,
    index,
    currentTime,
    duration,
    volume,
    error,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
  } = usePlaybackStore();

  if (!currentTrack) return null;

  const hasPrev = index > 0;
  const hasNext = index < queue.length - 1;
  const total = duration || currentTrack.duration || 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0d0d14]/95 backdrop-blur">
      {/* Scrub bar spans the full width at the very top of the bar. */}
      <input
        type="range"
        min={0}
        max={total || 0}
        step={0.1}
        value={Math.min(currentTime, total || 0)}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="Seek"
        className="mp-range absolute -top-1 left-0 h-1 w-full cursor-pointer"
        style={{ ["--pct" as string]: `${total ? (currentTime / total) * 100 : 0}%` }}
      />

      <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-3">
        {currentTrack.artworkUrl ? (
          <img
            src={currentTrack.artworkUrl}
            alt=""
            className="h-12 w-12 flex-none rounded-md object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-white/5 text-white/30">
            ♪
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {currentTrack.title}
          </p>
          <p className="truncate text-xs text-white/50">
            {error ? (
              <span className="text-red-400">{error}</span>
            ) : (
              <>
                {currentTrack.artist || "Unknown artist"}
                {buffering && <span className="ml-2 text-white/30">buffering…</span>}
              </>
            )}
          </p>
        </div>

        <span className="hidden tabular-nums text-xs text-white/40 sm:inline">
          {formatDuration(currentTime)} / {formatDuration(total || null)}
        </span>

        <div className="flex items-center gap-1">
          <ControlButton onClick={prev} disabled={!hasPrev && currentTime <= 3} label="Previous">
            ⏮
          </ControlButton>
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>
          <ControlButton onClick={next} disabled={!hasNext} label="Next">
            ⏭
          </ControlButton>
        </div>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
          className="mp-range hidden h-1 w-20 cursor-pointer md:block"
          style={{ ["--pct" as string]: `${volume * 100}%` }}
        />
      </div>
    </div>
  );
}

function ControlButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
