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

export function listTracks(): TrackRow[] {
  return db
    .prepare("SELECT * FROM tracks ORDER BY date_added DESC")
    .all() as TrackRow[];
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
