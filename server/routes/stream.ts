import { Router } from "express";
import { createReadStream, statSync } from "node:fs";
import { join, extname } from "node:path";
import { audioDir, getTrack } from "../db.ts";

export const streamRouter = Router();

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

// GET /api/stream/:id — serve the audio file with HTTP Range support so the
// browser can seek without downloading the whole file.
streamRouter.get("/stream/:id", (req, res) => {
  const track = getTrack(req.params.id);
  if (!track) {
    res.status(404).json({ error: "Track not found." });
    return;
  }

  const filePath = join(audioDir, track.file_path);
  let size: number;
  try {
    size = statSync(filePath).size;
  } catch {
    res.status(404).json({ error: "Audio file missing." });
    return;
  }

  const contentType =
    CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Accept-Ranges", "bytes");

  const range = req.headers.range;
  if (!range) {
    // No range: whole file.
    res.setHeader("Content-Length", size);
    createReadStream(filePath).pipe(res);
    return;
  }

  // Parse "bytes=start-end" (either bound may be absent).
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    res.status(416).setHeader("Content-Range", `bytes */${size}`).end();
    return;
  }

  const startStr = match[1];
  const endStr = match[2];
  let start = startStr ? parseInt(startStr, 10) : 0;
  let end = endStr ? parseInt(endStr, 10) : size - 1;

  // Suffix range "bytes=-N" → last N bytes.
  if (!startStr && endStr) {
    start = Math.max(0, size - parseInt(endStr, 10));
    end = size - 1;
  }

  if (start > end || start >= size) {
    res.status(416).setHeader("Content-Range", `bytes */${size}`).end();
    return;
  }
  end = Math.min(end, size - 1);

  res.status(206);
  res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
  res.setHeader("Content-Length", end - start + 1);
  createReadStream(filePath, { start, end }).pipe(res);
});
