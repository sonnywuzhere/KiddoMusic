import { useEffect, useState } from "react";
import type { Album, Track } from "../../types";
import {
  listAlbums,
  addTracksToAlbum,
  createAlbum,
} from "../../api/albums";

type Props = {
  track: Track;
  onClose: () => void;
};

/**
 * Add a single track to one or more custom albums, or create a new album for
 * it. Clicking an album adds the track (server skips duplicates), and we mark
 * it added locally.
 */
export default function AddToAlbumModal({ track, onClose }: Props) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listAlbums()
      .then(setAlbums)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Couldn't load albums."),
      )
      .finally(() => setLoading(false));
  }, []);

  async function add(albumId: string) {
    setBusyId(albumId);
    setError(null);
    try {
      await addTracksToAlbum(albumId, [track.id]);
      setAddedIds((prev) => new Set(prev).add(albumId));
      setAlbums((prev) =>
        prev.map((a) =>
          a.id === albumId
            ? {
                ...a,
                trackCount: a.trackCount + 1,
                coverUrl: a.coverUrl ?? track.artworkUrl,
              }
            : a,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add to album.");
    } finally {
      setBusyId(null);
    }
  }

  async function createAndAdd() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const album = await createAlbum(newName.trim());
      await addTracksToAlbum(album.id, [track.id]);
      setNewName("");
      setAlbums((prev) => [
        {
          id: album.id,
          name: album.name,
          createdAt: album.createdAt,
          trackCount: 1,
          coverUrl: track.artworkUrl,
        },
        ...prev,
      ]);
      setAddedIds((prev) => new Set(prev).add(album.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create album.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-2xl border border-white/10 bg-[#14141c] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Add to album</h2>
        <p className="mb-4 mt-1 truncate text-sm text-white/50">{track.title}</p>

        {/* Create new */}
        <div className="mb-3 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void createAndAdd()}
            placeholder="New album name…"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
          />
          <button
            onClick={() => void createAndAdd()}
            disabled={creating || !newName.trim()}
            className="flex-none rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            Create
          </button>
        </div>

        {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

        {/* Existing albums */}
        <div className="-mx-2 flex-1 overflow-y-auto px-2">
          {loading ? (
            <p className="py-6 text-center text-sm text-white/40">Loading…</p>
          ) : albums.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/40">
              No albums yet — create one above.
            </p>
          ) : (
            <ul className="space-y-1">
              {albums.map((a) => {
                const added = addedIds.has(a.id);
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">{a.name}</p>
                      <p className="text-xs text-white/40">
                        {a.trackCount} track{a.trackCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <button
                      onClick={() => !added && void add(a.id)}
                      disabled={added || busyId === a.id}
                      className={
                        "flex-none rounded-lg px-3 py-1.5 text-xs font-medium " +
                        (added
                          ? "text-emerald-400"
                          : "border border-white/10 text-white/70 hover:bg-white/10")
                      }
                    >
                      {added ? "✓ Added" : busyId === a.id ? "…" : "Add"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
