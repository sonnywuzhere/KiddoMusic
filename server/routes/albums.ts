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

async function detail(id: string) {
  const album = await getAlbum(id);
  if (!album) return undefined;
  return toApiAlbumDetail(album, await getAlbumTracks(id));
}

// GET /api/albums — all albums (summaries with cover + track count).
albumsRouter.get("/albums", async (_req, res, next) => {
  try {
    res.json({ albums: (await listAlbums()).map(toApiAlbum) });
  } catch (err) {
    next(err);
  }
});

// POST /api/albums — create a named album (no tracks required).
albumsRouter.post("/albums", async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "Album name is required." });
      return;
    }
    const album = await createAlbum(randomUUID(), name, Date.now());
    res.status(201).json({
      album: { id: album.id, name: album.name, createdAt: album.created_at },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/albums/:id — album detail + ordered tracks.
albumsRouter.get("/albums/:id", async (req, res, next) => {
  try {
    const d = await detail(req.params.id);
    if (!d) {
      res.status(404).json({ error: "Album not found." });
      return;
    }
    res.json({ album: d });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/albums/:id — rename.
albumsRouter.patch("/albums/:id", async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "Album name cannot be empty." });
      return;
    }
    const updated = await renameAlbum(req.params.id, name);
    if (!updated) {
      res.status(404).json({ error: "Album not found." });
      return;
    }
    res.json({ album: await detail(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/albums/:id — delete the album (grouping only; tracks untouched).
albumsRouter.delete("/albums/:id", async (req, res, next) => {
  try {
    if (!(await deleteAlbum(req.params.id))) {
      res.status(404).json({ error: "Album not found." });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /api/albums/:id/tracks — add one or many tracks. Body: { trackIds } or { trackId }.
albumsRouter.post("/albums/:id/tracks", async (req, res, next) => {
  try {
    if (!(await getAlbum(req.params.id))) {
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
    const added = await addTracksToAlbum(req.params.id, ids);
    res.status(200).json({ added, album: await detail(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/albums/:id/order — set the full track order. Body: { trackIds }.
albumsRouter.patch("/albums/:id/order", async (req, res, next) => {
  try {
    if (!(await getAlbum(req.params.id))) {
      res.status(404).json({ error: "Album not found." });
      return;
    }
    const ids = req.body?.trackIds;
    if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) {
      res.status(400).json({ error: "trackIds must be an array of ids." });
      return;
    }
    await reorderAlbumTracks(req.params.id, ids as string[]);
    res.json({ album: await detail(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/albums/:id/tracks/:trackId — remove a track from the album.
albumsRouter.delete("/albums/:id/tracks/:trackId", async (req, res, next) => {
  try {
    if (!(await getAlbum(req.params.id))) {
      res.status(404).json({ error: "Album not found." });
      return;
    }
    await removeTrackFromAlbum(req.params.id, req.params.trackId);
    res.json({ album: await detail(req.params.id) });
  } catch (err) {
    next(err);
  }
});
