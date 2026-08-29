import type { Track } from "../../types";
import { formatDuration } from "../../utils/format";
import { usePlaybackStore } from "../../store/playbackStore";

type Props = {
  tracks: Track[];
  onEdit: (track: Track) => void;
};

/** Artwork-forward grid presentation of the library. Cards are click-to-play. */
export default function TrackGrid({ tracks, onEdit }: Props) {
  const currentId = usePlaybackStore((s) => s.currentTrack?.id);
  const playTrack = usePlaybackStore((s) => s.playTrack);

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {tracks.map((track) => {
        const active = track.id === currentId;
        return (
          <li key={track.id} className="group">
            <div
              onClick={() => playTrack(track, tracks)}
              className={
                "relative cursor-pointer overflow-hidden rounded-xl border transition-colors " +
                (active
                  ? "border-indigo-400/60"
                  : "border-white/10 hover:border-white/25")
              }
            >
              <Cover track={track} />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(track);
                }}
                className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white/80 opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 focus:opacity-100 group-hover:opacity-100"
              >
                Edit
              </button>

              {track.duration != null && (
                <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] tabular-nums text-white/80 backdrop-blur-sm">
                  {formatDuration(track.duration)}
                </span>
              )}
            </div>

            <div className="mt-2 px-0.5">
              <p
                className={
                  "truncate text-sm font-medium " +
                  (active ? "text-indigo-300" : "text-white")
                }
              >
                {track.title}
              </p>
              <p className="truncate text-xs text-white/50">
                {track.artist || "Unknown artist"}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Cover({ track }: { track: Track }) {
  if (track.artworkUrl) {
    return (
      <img
        src={track.artworkUrl}
        alt=""
        className="aspect-square w-full object-cover"
      />
    );
  }
  return (
    <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-white/10 to-white/[0.02] text-3xl text-white/25">
      ♪
    </div>
  );
}
