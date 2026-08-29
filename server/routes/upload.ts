import { Router, type ErrorRequestHandler } from "express";
import multer, { MulterError } from "multer";
import { randomUUID } from "node:crypto";
import { extname, basename } from "node:path";
import { insertTrack, type TrackRow } from "../db.ts";
import { audioKey, artworkKey, putObject } from "../storage/r2.ts";
import { extractMetadata, imageExtension } from "../metadata/extract.ts";
import { toApiTrack, type ApiTrack } from "../serialize.ts";

const MAX_FILE_BYTES = 250 * 1024 * 1024; // 250 MB — FLAC/WAV can be large

// Accepted container extensions (mimetypes are unreliable across browsers/OSes).
const ALLOWED_EXTENSIONS = new Set([
  ".mp3",
  ".m4a",
  ".aac",
  ".wav",
  ".flac",
  ".ogg",
  ".oga",
  ".opus",
]);

const CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/ogg",
};

// Buffer uploads in memory rather than writing to local disk first — the
// destination is R2, not a local path, and we want metadata validated before
// anything is actually stored (see the loop below: nothing is put to R2
// unless extraction succeeds, so there's no orphaned-file cleanup to do).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported format: ${ext || "unknown"}`));
    }
  },
});

export const uploadRouter = Router();

type UploadError = { filename: string; error: string };

// POST /api/upload — one or many audio files under field name "files".
uploadRouter.post("/upload", upload.array("files"), async (req, res, next) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    res.status(400).json({ error: "No files uploaded." });
    return;
  }

  const tracks: ApiTrack[] = [];
  const errors: UploadError[] = [];

  try {
    for (const file of files) {
      const ext = extname(file.originalname).toLowerCase();
      const contentType = CONTENT_TYPES[ext] ?? file.mimetype ?? "application/octet-stream";

      try {
        const meta = await extractMetadata(file.buffer, contentType);

        const filename = `${randomUUID()}${ext}`;
        await putObject(audioKey(filename), file.buffer, contentType);

        // Persist embedded artwork, if any. A problem with the image must not
        // fail the whole track — save it without artwork instead.
        let artworkFilename: string | null = null;
        if (meta.picture) {
          try {
            artworkFilename = `${basename(filename, ext)}.${imageExtension(meta.picture.format)}`;
            await putObject(artworkKey(artworkFilename), meta.picture.data, meta.picture.format);
          } catch {
            artworkFilename = null;
          }
        }

        // Fallback title: original filename without extension.
        const fallbackTitle =
          basename(file.originalname, extname(file.originalname)) || "Untitled";

        const row: TrackRow = {
          id: randomUUID(),
          title: meta.title ?? fallbackTitle,
          artist: meta.artist,
          album: meta.album,
          duration: meta.duration,
          artwork_path: artworkFilename,
          file_path: filename,
          date_added: Date.now(),
        };
        await insertTrack(row);
        tracks.push(toApiTrack(row));
      } catch (err) {
        // Corrupt/unreadable audio, or an R2 write failure — nothing was
        // written for this file (extraction runs before any R2 put), so
        // there's nothing to clean up. Report and continue with the rest.
        errors.push({
          filename: file.originalname,
          error: err instanceof Error ? err.message : "Failed to process file",
        });
      }
    }
  } catch (err) {
    next(err);
    return;
  }

  res.status(errors.length && !tracks.length ? 422 : 201).json({
    tracks,
    errors,
  });
});

// Multer/upload-specific errors → clean JSON (unsupported format, too large).
export const uploadErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? `File too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB).`
        : err.message;
    res.status(413).json({ error: message });
    return;
  }
  if (err instanceof Error && err.message.startsWith("Unsupported format")) {
    res.status(415).json({ error: err.message });
    return;
  }
  next(err);
};
