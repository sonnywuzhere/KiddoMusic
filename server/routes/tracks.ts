import { Router } from "express";
import {
  listTracks,
  getTrack,
  updateTrackMetadata,
  type SortKey,
  type SortOrder,
} from "../db.ts";
import { toApiTrack } from "../serialize.ts";

export const tracksRouter = Router();

const VALID_SORTS: SortKey[] = ["title", "artist", "album", "dateAdded"];

// GET /api/tracks?sort=&order=&search= — sortable, searchable library.
tracksRouter.get("/tracks", (req, res) => {
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

  res.json({ tracks: listTracks({ sort, order, search }).map(toApiTrack) });
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
