import { usePlaybackStore } from "../store/playbackStore";

type Props = {
  className?: string;
};

/**
 * Shuffle mode toggle. Pressed state is the accent tint; the icon itself
 * stays a single shape so the control reads the same in the mini-player
 * and the full-screen takeover.
 */
export default function ShuffleButton({ className = "" }: Props) {
  const shuffle = usePlaybackStore((s) => s.shuffle);
  const toggleShuffle = usePlaybackStore((s) => s.toggleShuffle);

  return (
    <button
      type="button"
      onClick={toggleShuffle}
      aria-label="Shuffle"
      aria-pressed={shuffle}
      title={shuffle ? "Shuffle is on" : "Shuffle is off"}
      className={`flex items-center justify-center rounded-full transition-colors ${
        shuffle
          ? "bg-indigo-400/20 text-indigo-300 hover:bg-indigo-400/30"
          : "text-white/45 hover:bg-white/10 hover:text-white/80"
      } ${className}`}
    >
      <ShuffleIcon />
    </button>
  );
}

function ShuffleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  );
}
