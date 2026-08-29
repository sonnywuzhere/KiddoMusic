import type { TrackRow, AlbumSummary, AlbumRow } from "./db.ts";

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

/** Album summary for list/card views. */
export type ApiAlbum = {
  id: string;
  name: string;
  createdAt: number;
  trackCount: number;
  coverUrl: string | null;
};

export function toApiAlbum(row: AlbumSummary): ApiAlbum {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    trackCount: row.track_count,
    coverUrl: row.cover_artwork_path
      ? `/api/artwork/${row.cover_artwork_path}`
      : null,
  };
}

/** Album detail (metadata + ordered tracks). */
export type ApiAlbumDetail = {
  id: string;
  name: string;
  createdAt: number;
  tracks: ApiTrack[];
};

export function toApiAlbumDetail(
  row: AlbumRow,
  tracks: TrackRow[],
): ApiAlbumDetail {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    tracks: tracks.map(toApiTrack),
  };
}
