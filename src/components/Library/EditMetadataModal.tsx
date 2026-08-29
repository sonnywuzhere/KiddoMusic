import { useState } from "react";
import { updateTrack } from "../../api/client";
import type { Track } from "../../types";

type Props = {
  track: Track;
  onClose: () => void;
  onSaved: (track: Track) => void;
};

/** Manual metadata editor for tracks with missing/incorrect tags (PRD 7.1). */
export default function EditMetadataModal({ track, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist ?? "");
  const [album, setAlbum] = useState(track.album ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) {
      setError("Title can't be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateTrack(track.id, {
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim(),
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#14141c] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Edit track details</h2>

        <div className="space-y-3">
          <Field label="Title" value={title} onChange={setTitle} autoFocus />
          <Field label="Artist" value={artist} onChange={setArtist} />
          <Field label="Album" value={album} onChange={setAlbum} />
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-white/40">
        {label}
      </span>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
      />
    </label>
  );
}
