import { useEffect, useState } from "react";
import UploadZone from "./components/Upload/UploadZone";
import TrackList from "./components/Library/TrackList";
import EditMetadataModal from "./components/Library/EditMetadataModal";
import { getTracks } from "./api/client";
import type { Track } from "./types";

/**
 * Phase 1 shell: upload + a minimal library list with manual metadata editing.
 * Phases 2–4 add the real Library view, playback engine, and Now Playing
 * takeover.
 */
export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Track | null>(null);

  useEffect(() => {
    getTracks()
      .then(setTracks)
      .catch((err: unknown) =>
        setLoadError(err instanceof Error ? err.message : "Failed to load library."),
      )
      .finally(() => setLoading(false));
  }, []);

  function handleUploaded(created: Track[]) {
    // Prepend new tracks (newest first), de-duplicating by id.
    setTracks((prev) => {
      const ids = new Set(created.map((t) => t.id));
      return [...created, ...prev.filter((t) => !ids.has(t.id))];
    });
  }

  function handleSaved(updated: Track) {
    setTracks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-8 px-5 py-10">
      <header>
        <h1 className="bg-gradient-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          KiddoMusic
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Your library — upload audio and it appears below.
        </p>
      </header>

      <UploadZone onUploaded={handleUploaded} />

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-white/40">
            Library
          </h2>
          {tracks.length > 0 && (
            <span className="text-xs text-white/30">
              {tracks.length} track{tracks.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-white/40">Loading…</p>
        ) : loadError ? (
          <p className="py-10 text-center text-sm text-red-400">{loadError}</p>
        ) : (
          <TrackList tracks={tracks} onEdit={setEditing} />
        )}
      </section>

      {editing && (
        <EditMetadataModal
          track={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
