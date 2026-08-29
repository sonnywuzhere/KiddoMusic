import type { Track } from "../../types";
import { formatDuration } from "../../utils/format";

type Props = {
  tracks: Track[];
  onEdit: (track: Track) => void;
};

/**
 * Minimal list of library tracks — enough for Phase 1 verification (see it
 * appear, edit metadata). Phase 2 replaces this with the full grid/list
 * Library view including sort, filter, and search.
 */
export default function TrackList({ tracks, onEdit }: Props) {
  if (tracks.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-white/40">
        No tracks yet. Upload some audio to get started.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-white/5">
      {tracks.map((track) => (
        <li
          key={track.id}
          className="group flex items-center gap-4 py-3"
        >
          <Artwork track={track} />

          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-white">{track.title}</p>
            <p className="truncate text-sm text-white/50">
              {track.artist || "Unknown artist"}
              {track.album ? ` · ${track.album}` : ""}
            </p>
          </div>

          <span className="tabular-nums text-sm text-white/40">
            {formatDuration(track.duration)}
          </span>

          <button
            onClick={() => onEdit(track)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 opacity-0 transition-opacity hover:bg-white/5 group-hover:opacity-100 focus:opacity-100"
          >
            Edit
          </button>
        </li>
      ))}
    </ul>
  );
}

function Artwork({ track }: { track: Track }) {
  if (track.artworkUrl) {
    return (
      <img
        src={track.artworkUrl}
        alt=""
        className="h-12 w-12 flex-none rounded-md object-cover"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-white/5 text-white/30">
      ♪
    </div>
  );
}
