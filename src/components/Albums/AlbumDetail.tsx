import { useEffect, useState } from "react";
import type { AlbumDetail as AlbumDetailType } from "../../types";
import {
  getAlbum,
  renameAlbum,
  deleteAlbum,
  removeTrackFromAlbum,
  reorderAlbum,
} from "../../api/albums";
import { usePlaybackStore } from "../../store/playbackStore";
import { formatDuration } from "../../utils/format";

type Props = {
  albumId: string;
  onBack: () => void;
  /** Called after a change that affects the albums list (rename/delete/tracks). */
  onChanged: () => void;
  onDeleted: () => void;
};

export default function AlbumDetail({
  albumId,
  onBack,
  onChanged,
  onDeleted,
}: Props) {
  const [album, setAlbum] = useState<AlbumDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const playTrack = usePlaybackStore((s) => s.playTrack);
  const currentId = usePlaybackStore((s) => s.currentTrack?.id);

  useEffect(() => {
    setLoading(true);
    getAlbum(albumId)
      .then((a) => {
        setAlbum(a);
        setNameDraft(a.name);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Couldn't load album."),
      )
      .finally(() => setLoading(false));
  }, [albumId]);

  async function commitRename() {
    if (!album) return;
    const name = nameDraft.trim();
    if (!name || name === album.name) {
      setRenaming(false);
      setNameDraft(album.name);
      return;
    }
    try {
      const updated = await renameAlbum(album.id, name);
      setAlbum(updated);
      setRenaming(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't rename.");
    }
  }

  async function handleDelete() {
    if (!album) return;
    if (!window.confirm(`Delete album “${album.name}”? Your tracks stay in the library.`))
      return;
    try {
      await deleteAlbum(album.id);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete album.");
    }
  }

  async function removeTrack(trackId: string) {
    if (!album) return;
    try {
      const updated = await removeTrackFromAlbum(album.id, trackId);
      setAlbum(updated);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove track.");
    }
  }

  async function move(index: number, dir: -1 | 1) {
    if (!album) return;
    const target = index + dir;
    if (target < 0 || target >= album.tracks.length) return;
    const tracks = [...album.tracks];
    [tracks[index], tracks[target]] = [tracks[target], tracks[index]];
    setAlbum({ ...album, tracks }); // optimistic
    try {
      const updated = await reorderAlbum(
        album.id,
        tracks.map((t) => t.id),
      );
      setAlbum(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reorder.");
      // reload true order
      getAlbum(album.id).then(setAlbum).catch(() => {});
    }
  }

  if (loading) {
    return <p className="py-16 text-center text-sm text-white/40">Loading album…</p>;
  }
  if (error && !album) {
    return <p className="py-16 text-center text-sm text-red-400">{error}</p>;
  }
  if (!album) return null;

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-5 flex items-center gap-1 text-sm text-white/60 hover:text-white"
      >
        ← Albums
      </button>

      {/* Album header */}
      <div className="mb-6 flex items-end gap-5">
        {album.tracks[0]?.artworkUrl ? (
          <img
            src={album.tracks[0].artworkUrl}
            alt=""
            className="h-32 w-32 flex-none rounded-xl object-cover shadow-lg"
          />
        ) : (
          <div className="flex h-32 w-32 flex-none items-center justify-center rounded-xl bg-white/5 text-4xl text-white/25">
            ♫
          </div>
        )}

        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => void commitRename()}
              onKeyDown={(e) => {
                if (e.key === "Enter") void commitRename();
                if (e.key === "Escape") {
                  setRenaming(false);
                  setNameDraft(album.name);
                }
              }}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-2xl font-semibold text-white outline-none focus:border-indigo-400"
            />
          ) : (
            <h1
              className="cursor-text truncate text-3xl font-semibold text-white"
              onClick={() => setRenaming(true)}
              title="Click to rename"
            >
              {album.name}
            </h1>
          )}
          <p className="mt-1 text-sm text-white/50">
            {album.tracks.length} track{album.tracks.length === 1 ? "" : "s"}
          </p>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() =>
                album.tracks[0] && playTrack(album.tracks[0], album.tracks)
              }
              disabled={album.tracks.length === 0}
              className="rounded-full bg-indigo-500 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-40"
            >
              ▶ Play album
            </button>
            <button
              onClick={() => setRenaming(true)}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
            >
              Rename
            </button>
            <button
              onClick={() => void handleDelete()}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {/* Tracks */}
      {album.tracks.length === 0 ? (
        <p className="py-12 text-center text-sm text-white/40">
          This album is empty. Add tracks from your library with the “+” action.
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {album.tracks.map((track, i) => {
            const active = track.id === currentId;
            return (
              <li key={track.id} className="group flex items-center gap-3 py-2.5">
                <span className="w-5 flex-none text-right text-xs tabular-nums text-white/30">
                  {i + 1}
                </span>
                <div
                  onClick={() => playTrack(track, album.tracks)}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                >
                  {track.artworkUrl ? (
                    <img
                      src={track.artworkUrl}
                      alt=""
                      className="h-10 w-10 flex-none rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded bg-white/5 text-white/30">
                      ♪
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        "truncate text-sm " +
                        (active ? "text-indigo-300" : "text-white")
                      }
                    >
                      {track.title}
                    </p>
                    <p className="truncate text-xs text-white/50">
                      {track.artist || "Unknown artist"}
                    </p>
                  </div>
                  <span className="tabular-nums text-xs text-white/40">
                    {formatDuration(track.duration)}
                  </span>
                </div>

                {/* Reorder + remove */}
                <div className="flex flex-none items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <button
                    onClick={() => void move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="flex h-7 w-7 items-center justify-center rounded text-white/60 hover:bg-white/10 disabled:opacity-20"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => void move(i, 1)}
                    disabled={i === album.tracks.length - 1}
                    aria-label="Move down"
                    className="flex h-7 w-7 items-center justify-center rounded text-white/60 hover:bg-white/10 disabled:opacity-20"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => void removeTrack(track.id)}
                    aria-label="Remove from album"
                    className="flex h-7 w-7 items-center justify-center rounded text-white/60 hover:bg-red-500/20 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
