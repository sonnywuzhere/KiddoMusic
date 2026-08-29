import type { TrackRow } from "./db.ts";

/** The track shape sent to the client — bare filenames resolved to URLs. */
export type ApiTrack = {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration: number | null;
  artworkUrl: string | null;
  streamUrl: string; // served by GET /api/stream/:id (Phase 3)
  dateAdded: number;
};

export function toApiTrack(row: TrackRow): ApiTrack {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    duration: row.duration,
    artworkUrl: row.artwork_path ? `/api/artwork/${row.artwork_path}` : null,
    streamUrl: `/api/stream/${row.id}`,
    dateAdded: row.date_added,
  };
}
