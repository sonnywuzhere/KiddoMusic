import { useCallback, useEffect, useRef, useState } from "react";
import { getTracks, type SortKey, type SortOrder } from "../../api/client";
import type { Track } from "../../types";
import UploadZone from "../Upload/UploadZone";
import TrackList from "./TrackList";
import TrackGrid from "./TrackGrid";
import EditMetadataModal from "./EditMetadataModal";
import LibrarySkeleton from "./LibrarySkeleton";
import EmptyLibrary from "./EmptyLibrary";

type ViewMode = "grid" | "list";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "dateAdded", label: "Date added" },
  { value: "title", label: "Title" },
  { value: "artist", label: "Artist" },
  { value: "album", label: "Album" },
];

export default function LibraryView() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("dateAdded");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [view, setView] = useState<ViewMode>("grid");
  const [editing, setEditing] = useState<Track | null>(null);

  // Debounce the search box so we don't hit the server on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const reload = useCallback(() => {
    setError(null);
    return getTracks({ sort, order, search: debouncedSearch })
      .then(setTracks)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load library."),
      )
      .finally(() => setLoading(false));
  }, [sort, order, debouncedSearch]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // After an upload, jump to the default ordering so new tracks are visible.
  const searchActive = debouncedSearch.trim().length > 0;
  const isEmpty = !loading && !error && tracks.length === 0;

  // Keep a stable ref for onUploaded so UploadZone doesn't re-run effects.
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  return (
    <div className="flex flex-col gap-6">
      <UploadZone onUploaded={() => void reloadRef.current()} />

      <section>
        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[180px] flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, artist, album…"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-400"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-white/50">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-white/10 bg-[#14141c] px-2 py-2 text-sm text-white outline-none focus:border-indigo-400"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
            title={order === "asc" ? "Ascending" : "Descending"}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            {order === "asc" ? "↑" : "↓"}
          </button>

          <div className="flex overflow-hidden rounded-lg border border-white/10">
            {(["grid", "list"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setView(m)}
                className={
                  "px-3 py-2 text-sm capitalize transition-colors " +
                  (view === m
                    ? "bg-indigo-500/20 text-indigo-200"
                    : "text-white/50 hover:bg-white/5")
                }
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <LibrarySkeleton view={view} />
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={() => {
                setLoading(true);
                void reload();
              }}
              className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
            >
              Try again
            </button>
          </div>
        ) : isEmpty ? (
          <EmptyLibrary searchTerm={searchActive ? debouncedSearch : undefined} />
        ) : view === "grid" ? (
          <TrackGrid tracks={tracks} onEdit={setEditing} />
        ) : (
          <TrackList tracks={tracks} onEdit={setEditing} />
        )}
      </section>

      {editing && (
        <EditMetadataModal
          track={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setTracks((prev) =>
              prev.map((t) => (t.id === updated.id ? updated : t)),
            );
          }}
        />
      )}
    </div>
  );
}
