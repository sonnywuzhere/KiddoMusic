import { Router } from "express";
import type { Readable } from "node:stream";
import { NoSuchKey } from "@aws-sdk/client-s3";
import { artworkKey, getObject } from "../storage/r2.ts";

export const artworkRouter = Router();

// GET /api/artwork/:filename — proxies extracted album art out of R2. This
// replaces the old `express.static(artworkDir)` now that artwork isn't on
// local disk; same immutable/long-cache behavior (filenames are content-
// addressed by upload UUID, so a given filename's bytes never change).
artworkRouter.get("/artwork/:filename", async (req, res, next) => {
  try {
    const obj = await getObject(artworkKey(req.params.filename));
    res.setHeader("Content-Type", obj.ContentType ?? "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (obj.ContentLength != null) {
      res.setHeader("Content-Length", obj.ContentLength);
    }
    if (!obj.Body) {
      res.status(500).json({ error: "Empty response from storage." });
      return;
    }
    (obj.Body as Readable).pipe(res);
  } catch (err) {
    if (err instanceof NoSuchKey) {
      res.status(404).end();
      return;
    }
    next(err);
  }
});
