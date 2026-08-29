import { Router } from "express";
import { randomUUID } from "node:crypto";
import {
  createAlbum,
  getAlbum,
  listAlbums,
  renameAlbum,
  deleteAlbum,
  getAlbumTracks,
  addTracksToAlbum,
  removeTrackFromAlbum,
  reorderAlbumTracks,
} from "../db.ts";
import { toApiAlbum, toApiAlbumDetail } from "../serialize.ts";

export const albumsRouter = Router();

function detail(id: string) {
  const album = getAlbum(id);
  if (!album) return undefined;
  return toApiAlbumDetail(album, getAlbumTracks(id));
}

// GET /api/albums — all albums (summaries with cover + track count).
albumsRouter.get("/albums", (_req, res) => {
  res.json({ albums: listAlbums().map(toApiAlbum) });
});

// POST /api/albums — create a named album (no tracks required).
albumsRouter.post("/albums", (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: "Album name is required." });
    return;
  }
  const album = createAlbum(randomUUID(), name, Date.now());
  res.status(201).json({
    album: { id: album.id, name: album.name, createdAt: album.created_at },
  });
});

// GET /api/albums/:id — album detail + ordered tracks.
albumsRouter.get("/albums/:id", (req, res) => {
  const d = detail(req.params.id);
  if (!d) {
    res.status(404).json({ error: "Album not found." });
    return;
  }
  res.json({ album: d });
});

// PATCH /api/albums/:id — rename.
albumsRouter.patch("/albums/:id", (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: "Album name cannot be empty." });
    return;
  }
  const updated = renameAlbum(req.params.id, name);
  if (!updated) {
    res.status(404).json({ error: "Album not found." });
    return;
  }
  res.json({ album: detail(req.params.id) });
});

// DELETE /api/albums/:id — delete the album (grouping only; tracks untouched).
albumsRouter.delete("/albums/:id", (req, res) => {
  if (!deleteAlbum(req.params.id)) {
    res.status(404).json({ error: "Album not found." });
    return;
  }
  res.status(204).end();
});

// POST /api/albums/:id/tracks — add one or many tracks. Body: { trackIds } or { trackId }.
albumsRouter.post("/albums/:id/tracks", (req, res) => {
  if (!getAlbum(req.params.id)) {
    res.status(404).json({ error: "Album not found." });
    return;
  }
  const body = req.body ?? {};
  const ids: string[] = Array.isArray(body.trackIds)
    ? body.trackIds.filter((x: unknown) => typeof x === "string")
    : typeof body.trackId === "string"
      ? [body.trackId]
      : [];
  if (ids.length === 0) {
    res.status(400).json({ error: "Provide trackId or trackIds." });
    return;
  }
  const added = addTracksToAlbum(req.params.id, ids);
  res.status(200).json({ added, album: detail(req.params.id) });
});

// PATCH /api/albums/:id/order — set the full track order. Body: { trackIds }.
albumsRouter.patch("/albums/:id/order", (req, res) => {
  if (!getAlbum(req.params.id)) {
    res.status(404).json({ error: "Album not found." });
    return;
  }
  const ids = req.body?.trackIds;
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) {
    res.status(400).json({ error: "trackIds must be an array of ids." });
    return;
  }
  reorderAlbumTracks(req.params.id, ids as string[]);
  res.json({ album: detail(req.params.id) });
});

// DELETE /api/albums/:id/tracks/:trackId — remove a track from the album.
albumsRouter.delete("/albums/:id/tracks/:trackId", (req, res) => {
  if (!getAlbum(req.params.id)) {
    res.status(404).json({ error: "Album not found." });
    return;
  }
  removeTrackFromAlbum(req.params.id, req.params.trackId);
  res.json({ album: detail(req.params.id) });
});
