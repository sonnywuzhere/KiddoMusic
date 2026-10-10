import type { Track } from "../../types";
import { useDownloadsStore } from "../../store/downloadsStore";

type Props = {
  track: Track;
  /** Matches the surrounding action-button styling: bordered rows (list) vs
   * a backdrop-blurred overlay (grid). */
  variant?: "list" | "grid";
};

const BASE = "flex h-7 w-7 items-center justify-center rounded-lg text-sm backdrop-blur-sm";
const LIST_CLS = "rounded-lg border border-white/10 text-white/70 hover:bg-white/5";
const GRID_CLS = "rounded-md bg-black/60 text-xs text-white/80 hover:bg-black/80";

/** Shared 4-state download control (not-downloaded / downloading / downloaded
 * / error), used by both TrackList and TrackGrid so the download status
 * logic lives in one place. */
export default function DownloadButton({ track, variant = "list" }: Props) {
  const entry = useDownloadsStore((s) => s.statuses[track.id]) ?? { status: "none", progress: 0 };
  const download = useDownloadsStore((s) => s.download);
  const remove = useDownloadsStore((s) => s.remove);

  const cls = `${BASE} ${variant === "grid" ? GRID_CLS : LIST_CLS}`;

  if (entry.status === "downloading") {
    const pct = Math.round(entry.progress * 100);
    return (
      <span
        title={`Downloading… ${pct}%`}
        aria-label={`Downloading, ${pct}%`}
        className={cls}
        style={{
          background: `conic-gradient(currentColor ${pct}%, transparent 0)`,
        }}
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[8px] text-white/80">
          {pct}
        </span>
      </span>
    );
  }

  if (entry.status === "downloaded") {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          void remove(track.id);
        }}
        title="Downloaded — click to remove"
        aria-label="Downloaded — click to remove offline copy"
        className={`${cls} text-emerald-400`}
      >
        ✓
      </button>
    );
  }

  if (entry.status === "error") {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          void download(track);
        }}
        title={entry.error ?? "Download failed — click to retry"}
        aria-label="Download failed — click to retry"
        className={`${cls} text-red-400`}
      >
        !
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        void download(track);
      }}
      title="Download for offline"
      aria-label="Download for offline"
      className={cls}
    >
      ⬇
    </button>
  );
}
