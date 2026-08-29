import { useRef, useState, type DragEvent } from "react";
import { uploadTracks } from "../../api/client";
import type { Track, UploadError } from "../../types";

const ACCEPT = ".mp3,.m4a,.aac,.wav,.flac,.ogg,.oga,.opus,audio/*";

type Status =
  | { phase: "idle" }
  | { phase: "uploading"; fraction: number; count: number }
  | { phase: "error"; message: string };

type Props = {
  /** Called with newly-created tracks so the parent can refresh the library. */
  onUploaded: (tracks: Track[]) => void;
};

export default function UploadZone({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [fileErrors, setFileErrors] = useState<UploadError[]>([]);

  async function handleFiles(fileList: FileList | null) {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;

    setFileErrors([]);
    setStatus({ phase: "uploading", fraction: 0, count: files.length });
    try {
      const result = await uploadTracks(files, (fraction) =>
        setStatus({ phase: "uploading", fraction, count: files.length }),
      );
      setFileErrors(result.errors);
      if (result.tracks.length > 0) onUploaded(result.tracks);
      setStatus({ phase: "idle" });
    } catch (err) {
      setStatus({
        phase: "error",
        message: err instanceof Error ? err.message : "Upload failed.",
      });
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    void handleFiles(e.dataTransfer.files);
  }

  const uploading = status.phase === "uploading";

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !uploading)
            inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors " +
          (dragging
            ? "border-indigo-400 bg-indigo-500/10"
            : "border-white/15 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05]")
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = ""; // allow re-selecting the same file
          }}
        />

        {uploading ? (
          <div className="w-full max-w-xs">
            <p className="mb-2 text-sm text-white/70">
              Uploading {status.count} file{status.count > 1 ? "s" : ""}…
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-indigo-400 transition-[width] duration-150"
                style={{ width: `${Math.round(status.fraction * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-white/40">
              {Math.round(status.fraction * 100)}%
            </p>
          </div>
        ) : (
          <>
            <div className="text-3xl">♪</div>
            <p className="text-sm text-white/80">
              Drag audio files here, or{" "}
              <span className="text-indigo-300 underline">browse</span>
            </p>
            <p className="text-xs text-white/40">
              MP3, M4A, AAC, WAV, FLAC, OGG, Opus · up to 250&nbsp;MB each
            </p>
          </>
        )}
      </div>

      {status.phase === "error" && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {status.message}
        </p>
      )}

      {fileErrors.length > 0 && (
        <ul className="mt-3 space-y-1">
          {fileErrors.map((fe) => (
            <li
              key={fe.filename}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
            >
              <span className="font-medium">{fe.filename}</span> — {fe.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
