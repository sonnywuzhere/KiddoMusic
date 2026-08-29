import { usePlaybackStore } from "../../store/playbackStore";

/**
 * Persistent bottom now-playing bar. Phase 2 renders the selected track and
 * reflects playback state from the store; the controls drive the store but
 * produce no audio yet. Phase 3 binds this to the AudioEngine (real play/pause/
 * seek) and makes it the entry point into the full-screen Now Playing takeover.
 */
export default function MiniPlayer() {
  const { currentTrack, isPlaying, queue, index, togglePlay, next, prev } =
    usePlaybackStore();

  if (!currentTrack) return null;

  const hasPrev = index > 0;
  const hasNext = index < queue.length - 1;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0d0d14]/95 backdrop-blur">
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
            {currentTrack.artist || "Unknown artist"}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <ControlButton onClick={prev} disabled={!hasPrev} label="Previous">
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

        <span className="hidden text-[11px] text-white/25 sm:inline">
          audio in Phase 3
        </span>
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
