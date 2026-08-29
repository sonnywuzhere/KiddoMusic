import { Router } from "express";
import { listTracks, getTrack, updateTrackMetadata } from "../db.ts";
import { toApiTrack } from "../serialize.ts";

export const tracksRouter = Router();

// GET /api/tracks — full library, newest first.
// (Phase 2 adds sort/filter/search query params.)
tracksRouter.get("/tracks", (_req, res) => {
  res.json({ tracks: listTracks().map(toApiTrack) });
});

// GET /api/tracks/:id
tracksRouter.get("/tracks/:id", (req, res) => {
  const row = getTrack(req.params.id);
  if (!row) {
    res.status(404).json({ error: "Track not found." });
    return;
  }
  res.json({ track: toApiTrack(row) });
});

// PATCH /api/tracks/:id — manual metadata edit (title/artist/album).
tracksRouter.patch("/tracks/:id", (req, res) => {
  const { title, artist, album } = (req.body ?? {}) as {
    title?: unknown;
    artist?: unknown;
    album?: unknown;
  };

  // title is required and must be non-empty if provided.
  if (title !== undefined && (typeof title !== "string" || !title.trim())) {
    res.status(400).json({ error: "Title cannot be empty." });
    return;
  }

  const fields: { title?: string; artist?: string; album?: string } = {};
  if (typeof title === "string") fields.title = title.trim();
  if (typeof artist === "string") fields.artist = artist.trim();
  if (typeof album === "string") fields.album = album.trim();

  const updated = updateTrackMetadata(req.params.id, fields);
  if (!updated) {
    res.status(404).json({ error: "Track not found." });
    return;
  }
  res.json({ track: toApiTrack(updated) });
});
