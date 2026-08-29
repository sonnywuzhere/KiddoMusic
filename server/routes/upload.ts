import { Router, type ErrorRequestHandler } from "express";
import multer, { MulterError } from "multer";
import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { extname, basename, join } from "node:path";
import { audioDir, artworkDir, insertTrack, type TrackRow } from "../db.ts";
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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, audioDir),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
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
uploadRouter.post("/upload", upload.array("files"), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    res.status(400).json({ error: "No files uploaded." });
    return;
  }

  const tracks: ApiTrack[] = [];
  const errors: UploadError[] = [];

  for (const file of files) {
    const audioPath = join(audioDir, file.filename);
    try {
      const meta = await extractMetadata(audioPath);

      // Persist embedded artwork, if any. A problem with the image must not
      // fail the whole track — save it without artwork instead.
      let artworkFilename: string | null = null;
      if (meta.picture) {
        try {
          artworkFilename = `${basename(file.filename, extname(file.filename))}.${imageExtension(meta.picture.format)}`;
          await writeFile(join(artworkDir, artworkFilename), meta.picture.data);
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
        file_path: file.filename,
        date_added: Date.now(),
      };
      insertTrack(row);
      tracks.push(toApiTrack(row));
    } catch (err) {
      // Corrupt/unreadable audio: clean up the orphaned file, report, continue.
      await unlink(audioPath).catch(() => {});
      errors.push({
        filename: file.originalname,
        error: err instanceof Error ? err.message : "Failed to process file",
      });
    }
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
