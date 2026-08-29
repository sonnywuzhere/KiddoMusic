import { useCallback, useEffect, useState } from "react";
import type { Album } from "../../types";
import { listAlbums } from "../../api/albums";
import AlbumCard from "./AlbumCard";
import AlbumDetail from "./AlbumDetail";
import CreateAlbumModal from "./CreateAlbumModal";

export default function AlbumsView() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(() => {
    setError(null);
    return listAlbums()
      .then(setAlbums)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Couldn't load albums."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (selectedId) {
    return (
      <AlbumDetail
        albumId={selectedId}
        onBack={() => {
          setSelectedId(null);
          void reload();
        }}
        onChanged={() => void reload()}
        onDeleted={() => {
          setSelectedId(null);
          void reload();
        }}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-white/40">
          Albums
        </h2>
        <button
          onClick={() => setCreating(true)}
          className="rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
        >
          + New album
        </button>
      </div>

      {loading ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="animate-pulse">
              <div className="aspect-square w-full rounded-xl bg-white/[0.06]" />
              <div className="mt-2 h-3 w-2/3 rounded bg-white/[0.06]" />
            </li>
          ))}
        </ul>
      ) : error ? (
        <p className="py-12 text-center text-sm text-red-400">{error}</p>
      ) : albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] text-3xl text-white/30">
            ♫
          </div>
          <p className="text-sm font-medium text-white/70">No albums yet</p>
          <p className="max-w-xs text-xs text-white/40">
            Create an album, then add tracks to it from your library with the “+”
            action.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="mt-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            + New album
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {albums.map((a) => (
            <AlbumCard key={a.id} album={a} onOpen={(al) => setSelectedId(al.id)} />
          ))}
        </ul>
      )}

      {creating && (
        <CreateAlbumModal
          onClose={() => setCreating(false)}
          onCreated={() => void reload()}
        />
      )}
    </div>
  );
}
