import { Router } from "express";
import {
  listTracks,
  getTrack,
  updateTrackMetadata,
  deleteTrack,
  type SortKey,
  type SortOrder,
} from "../db.ts";
import { toApiTrack } from "../serialize.ts";
import { audioKey, artworkKey, deleteObject } from "../storage/r2.ts";

export const tracksRouter = Router();

const VALID_SORTS: SortKey[] = ["title", "artist", "album", "dateAdded"];

// GET /api/tracks?sort=&order=&search= — sortable, searchable library.
tracksRouter.get("/tracks", async (req, res, next) => {
  try {
    const sortParam = req.query.sort;
    const orderParam = req.query.order;
    const searchParam = req.query.search;

    const sort: SortKey | undefined =
      typeof sortParam === "string" && (VALID_SORTS as string[]).includes(sortParam)
        ? (sortParam as SortKey)
        : undefined;
    const order: SortOrder | undefined =
      orderParam === "asc" || orderParam === "desc" ? orderParam : undefined;
    const search = typeof searchParam === "string" ? searchParam : undefined;

    const tracks = await listTracks({ sort, order, search });
    res.json({ tracks: tracks.map(toApiTrack) });
  } catch (err) {
    next(err);
  }
});

// GET /api/tracks/:id
tracksRouter.get("/tracks/:id", async (req, res, next) => {
  try {
    const row = await getTrack(req.params.id);
    if (!row) {
      res.status(404).json({ error: "Track not found." });
      return;
    }
    res.json({ track: toApiTrack(row) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tracks/:id — manual metadata edit (title/artist/album).
tracksRouter.patch("/tracks/:id", async (req, res, next) => {
  try {
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

    const updated = await updateTrackMetadata(req.params.id, fields);
    if (!updated) {
      res.status(404).json({ error: "Track not found." });
      return;
    }
    res.json({ track: toApiTrack(updated) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tracks/:id — remove a track entirely: DB row (any album
// memberships cascade), plus its audio + artwork objects in R2.
tracksRouter.delete("/tracks/:id", async (req, res, next) => {
  try {
    const row = await deleteTrack(req.params.id);
    if (!row) {
      res.status(404).json({ error: "Track not found." });
      return;
    }
    // The DB row is already gone — the delete has succeeded from the
    // client's perspective — so storage cleanup is best-effort from here.
    await Promise.allSettled([
      deleteObject(audioKey(row.file_path)),
      row.artwork_path ? deleteObject(artworkKey(row.artwork_path)) : Promise.resolve(),
    ]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
