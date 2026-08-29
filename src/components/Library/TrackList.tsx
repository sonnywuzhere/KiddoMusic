import type { Track } from "../../types";
import { formatDuration } from "../../utils/format";
import { usePlaybackStore } from "../../store/playbackStore";

type Props = {
  tracks: Track[];
  onEdit: (track: Track) => void;
};

/** List (row) presentation of the library. Rows are click-to-play. */
export default function TrackList({ tracks, onEdit }: Props) {
  const currentId = usePlaybackStore((s) => s.currentTrack?.id);
  const playTrack = usePlaybackStore((s) => s.playTrack);
  const addToQueue = usePlaybackStore((s) => s.addToQueue);

  return (
    <ul className="divide-y divide-white/5">
      {tracks.map((track) => {
        const active = track.id === currentId;
        return (
          <li
            key={track.id}
            onClick={() => playTrack(track, tracks)}
            className={
              "group flex cursor-pointer items-center gap-4 rounded-lg px-2 py-3 transition-colors " +
              (active ? "bg-indigo-500/10" : "hover:bg-white/[0.04]")
            }
          >
            <Artwork track={track} />

            <div className="min-w-0 flex-1">
              <p
                className={
                  "truncate font-medium " +
                  (active ? "text-indigo-300" : "text-white")
                }
              >
                {track.title}
              </p>
              <p className="truncate text-sm text-white/50">
                {track.artist || "Unknown artist"}
                {track.album ? ` · ${track.album}` : ""}
              </p>
            </div>

            <span className="tabular-nums text-sm text-white/40">
              {formatDuration(track.duration)}
            </span>

            <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addToQueue(track);
                }}
                title="Add to queue"
                aria-label="Add to queue"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-sm text-white/70 hover:bg-white/5"
              >
                +
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(track);
                }}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
              >
                Edit
              </button>
            </div>
          </li>
        );
      })}
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
