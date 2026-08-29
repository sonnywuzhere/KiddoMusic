import type { Album } from "../../types";

type Props = {
  album: Album;
  onOpen: (album: Album) => void;
};

/** Album cover card for the albums grid — cover from the first track's art. */
export default function AlbumCard({ album, onOpen }: Props) {
  return (
    <li>
      <button
        onClick={() => onOpen(album)}
        className="group block w-full text-left"
      >
        <div className="relative overflow-hidden rounded-xl border border-white/10 transition-colors group-hover:border-white/25">
          {album.coverUrl ? (
            <img
              src={album.coverUrl}
              alt=""
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-white/10 to-white/[0.02] text-3xl text-white/25">
              ♫
            </div>
          )}
        </div>
        <p className="mt-2 truncate text-sm font-medium text-white">
          {album.name}
        </p>
        <p className="truncate text-xs text-white/50">
          {album.trackCount} track{album.trackCount === 1 ? "" : "s"}
        </p>
      </button>
    </li>
  );
}
