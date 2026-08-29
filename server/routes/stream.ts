import { Router } from "express";
import type { Readable } from "node:stream";
import { extname } from "node:path";
import { NoSuchKey } from "@aws-sdk/client-s3";
import { getTrack } from "../db.ts";
import { audioKey, getObject } from "../storage/r2.ts";

export const streamRouter = Router();

// Fallback only — R2 normally returns the Content-Type we set at upload time.
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
// browser can seek without downloading the whole file. R2 mirrors S3's range
// semantics, so the incoming Range header is passed straight through to
// GetObject rather than re-implemented by hand.
streamRouter.get("/stream/:id", async (req, res, next) => {
  try {
    const track = await getTrack(req.params.id);
    if (!track) {
      res.status(404).json({ error: "Track not found." });
      return;
    }

    const range = req.headers.range;
    let obj;
    try {
      obj = await getObject(audioKey(track.file_path), range);
    } catch (err) {
      if (err instanceof NoSuchKey) {
        res.status(404).json({ error: "Audio file missing." });
        return;
      }
      const name = (err as { name?: string; Code?: string } | undefined)?.name;
      const code = (err as { name?: string; Code?: string } | undefined)?.Code;
      if (name === "InvalidRange" || code === "InvalidRange") {
        const size = (err as { ActualObjectSize?: string } | undefined)?.ActualObjectSize;
        res
          .status(416)
          .setHeader("Content-Range", `bytes */${size ?? "*"}`)
          .end();
        return;
      }
      throw err;
    }

    const contentType =
      obj.ContentType ??
      CONTENT_TYPES[extname(track.file_path).toLowerCase()] ??
      "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    if (obj.ContentLength != null) {
      res.setHeader("Content-Length", obj.ContentLength);
    }

    if (obj.ContentRange) {
      res.status(206);
      res.setHeader("Content-Range", obj.ContentRange);
    }

    if (!obj.Body) {
      res.status(500).json({ error: "Empty response from storage." });
      return;
    }
    (obj.Body as Readable).pipe(res);
  } catch (err) {
    next(err);
  }
});
