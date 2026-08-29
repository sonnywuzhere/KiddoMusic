import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// All runtime data is colocated under server/storage (gitignored together):
//   storage/kiddomusic.db  — SQLite file
//   storage/audio/         — uploaded audio files
//   storage/artwork/       — extracted album art
export const storageDir = join(__dirname, "storage");
export const audioDir = join(storageDir, "audio");
export const artworkDir = join(storageDir, "artwork");
for (const dir of [storageDir, audioDir, artworkDir]) {
  mkdirSync(dir, { recursive: true });
}

const dbPath = join(storageDir, "kiddomusic.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/** A row in the `tracks` table, as stored. Paths are bare filenames. */
export type TrackRow = {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration: number | null;
  artwork_path: string | null; // filename within storage/artwork, or null
  file_path: string; // filename within storage/audio
  date_added: number; // unix ms
};

/**
 * Schema as idempotent CREATE-IF-NOT-EXISTS. Matches the Phase 1 spec in
 * CLAUDE.md; kept storage-agnostic (bare filenames, not absolute paths) so the
 * storage layer can be swapped without a migration.
 */
export function initDb(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id           TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      artist       TEXT,
      album        TEXT,
      duration     REAL,
      artwork_path TEXT,
      file_path    TEXT NOT NULL,
      date_added   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tracks_date_added ON tracks(date_added);

    -- User-created albums (grouping only; independent of the embedded album tag).
    CREATE TABLE IF NOT EXISTS albums (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- Many-to-many: a track can live in multiple albums. ON DELETE CASCADE
    -- cleans up memberships when either an album or a track is deleted.
    CREATE TABLE IF NOT EXISTS album_tracks (
      album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
      track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      PRIMARY KEY (album_id, track_id)
    );
    CREATE INDEX IF NOT EXISTS idx_album_tracks_album ON album_tracks(album_id, position);
  `);
}

// Create the schema at import time, before any prepared statement below is
// built — better-sqlite3 prepares eagerly, so the table must already exist.
// initDb() remains exported (and idempotent) for an explicit call from index.ts.
initDb();

const insertStmt = db.prepare(`
  INSERT INTO tracks (id, title, artist, album, duration, artwork_path, file_path, date_added)
  VALUES (@id, @title, @artist, @album, @duration, @artwork_path, @file_path, @date_added)
`);

export function insertTrack(row: TrackRow): void {
  insertStmt.run(row);
}

export type SortKey = "title" | "artist" | "album" | "dateAdded";
export type SortOrder = "asc" | "desc";

export type ListOptions = {
  sort?: SortKey;
  order?: SortOrder;
  search?: string;
};

// Whitelist sort keys → real columns (never interpolate user input into SQL).
const SORT_COLUMNS: Record<SortKey, string> = {
  title: "title",
  artist: "artist",
  album: "album",
  dateAdded: "date_added",
};

export function listTracks(opts: ListOptions = {}): TrackRow[] {
  const sort: SortKey = opts.sort && opts.sort in SORT_COLUMNS ? opts.sort : "dateAdded";
  const order: SortOrder = opts.order === "asc" ? "asc" : "desc";
  const column = SORT_COLUMNS[sort];

  const params: unknown[] = [];
  let where = "";
  const search = opts.search?.trim();
  if (search) {
    where = "WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?";
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  // NOCASE for text sorts; title as a stable tiebreak. date_added stays numeric.
  const collate = column === "date_added" ? "" : "COLLATE NOCASE";
  const orderBy =
    column === "date_added"
      ? `date_added ${order}`
      : `${column} ${collate} ${order}, title COLLATE NOCASE ASC`;

  return db
    .prepare(`SELECT * FROM tracks ${where} ORDER BY ${orderBy}`)
    .all(...params) as TrackRow[];
}

export function getTrack(id: string): TrackRow | undefined {
  return db.prepare("SELECT * FROM tracks WHERE id = ?").get(id) as
    | TrackRow
    | undefined;
}

/** Update the user-editable metadata fields. Only provided fields change. */
export function updateTrackMetadata(
  id: string,
  fields: Partial<Pick<TrackRow, "title" | "artist" | "album">>,
): TrackRow | undefined {
  const current = getTrack(id);
  if (!current) return undefined;
  const next = {
    title: fields.title ?? current.title,
    artist: fields.artist ?? current.artist,
    album: fields.album ?? current.album,
    id,
  };
  db.prepare(
    "UPDATE tracks SET title = @title, artist = @artist, album = @album WHERE id = @id",
  ).run(next);
  return getTrack(id);
}

// ---------------------------------------------------------------------------
// Custom albums (user-created track collections)
// ---------------------------------------------------------------------------

export type AlbumRow = {
  id: string;
  name: string;
  created_at: number;
};

export type AlbumSummary = AlbumRow & {
  track_count: number;
  cover_artwork_path: string | null; // first track (by position) that has art
};

export function createAlbum(id: string, name: string, createdAt: number): AlbumRow {
  db.prepare(
    "INSERT INTO albums (id, name, created_at) VALUES (?, ?, ?)",
  ).run(id, name, createdAt);
  return { id, name, created_at: createdAt };
}

export function getAlbum(id: string): AlbumRow | undefined {
  return db.prepare("SELECT * FROM albums WHERE id = ?").get(id) as
    | AlbumRow
    | undefined;
}

export function listAlbums(): AlbumSummary[] {
  const albums = db
    .prepare("SELECT * FROM albums ORDER BY created_at DESC")
    .all() as AlbumRow[];
  const countStmt = db.prepare(
    "SELECT COUNT(*) AS c FROM album_tracks WHERE album_id = ?",
  );
  const coverStmt = db.prepare(`
    SELECT t.artwork_path AS p
    FROM album_tracks at JOIN tracks t ON t.id = at.track_id
    WHERE at.album_id = ? AND t.artwork_path IS NOT NULL
    ORDER BY at.position ASC LIMIT 1
  `);
  return albums.map((a) => ({
    ...a,
    track_count: (countStmt.get(a.id) as { c: number }).c,
    cover_artwork_path:
      ((coverStmt.get(a.id) as { p: string } | undefined)?.p) ?? null,
  }));
}

export function renameAlbum(id: string, name: string): AlbumRow | undefined {
  const info = db
    .prepare("UPDATE albums SET name = ? WHERE id = ?")
    .run(name, id);
  return info.changes > 0 ? getAlbum(id) : undefined;
}

export function deleteAlbum(id: string): boolean {
  // album_tracks rows cascade away; the tracks themselves are untouched.
  return db.prepare("DELETE FROM albums WHERE id = ?").run(id).changes > 0;
}

/** Tracks in an album, ordered by their stored position. */
export function getAlbumTracks(albumId: string): TrackRow[] {
  return db
    .prepare(`
      SELECT t.* FROM album_tracks at
      JOIN tracks t ON t.id = at.track_id
      WHERE at.album_id = ?
      ORDER BY at.position ASC
    `)
    .all(albumId) as TrackRow[];
}

/**
 * Append the given tracks to an album (skipping ones that don't exist or are
 * already members). Returns the number actually added.
 */
export const addTracksToAlbum = db.transaction(
  (albumId: string, trackIds: string[]): number => {
    const maxRow = db
      .prepare("SELECT MAX(position) AS m FROM album_tracks WHERE album_id = ?")
      .get(albumId) as { m: number | null };
    let pos = maxRow.m ?? -1;
    const exists = db.prepare("SELECT 1 FROM tracks WHERE id = ?");
    const member = db.prepare(
      "SELECT 1 FROM album_tracks WHERE album_id = ? AND track_id = ?",
    );
    const insert = db.prepare(
      "INSERT INTO album_tracks (album_id, track_id, position) VALUES (?, ?, ?)",
    );
    let added = 0;
    for (const tid of trackIds) {
      if (!exists.get(tid)) continue;
      if (member.get(albumId, tid)) continue;
      pos++;
      insert.run(albumId, tid, pos);
      added++;
    }
    return added;
  },
);

export function removeTrackFromAlbum(albumId: string, trackId: string): boolean {
  return (
    db
      .prepare("DELETE FROM album_tracks WHERE album_id = ? AND track_id = ?")
      .run(albumId, trackId).changes > 0
  );
}

/** Set the full track order for an album (ids not in the album are ignored). */
export const reorderAlbumTracks = db.transaction(
  (albumId: string, orderedTrackIds: string[]): void => {
    const update = db.prepare(
      "UPDATE album_tracks SET position = ? WHERE album_id = ? AND track_id = ?",
    );
    orderedTrackIds.forEach((tid, i) => update.run(i, albumId, tid));
  },
);
