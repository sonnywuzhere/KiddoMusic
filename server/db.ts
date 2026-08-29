import { createClient, type Client, type InValue } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error(
    "Missing Turso configuration — set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env",
  );
}

export const db: Client = createClient({ url, authToken });

/** A row in the `tracks` table, as stored. Paths are bare filenames — the
 * storage layer (server/storage/r2.ts) resolves them to actual object keys,
 * keeping this table storage-agnostic. */
export type TrackRow = {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration: number | null;
  artwork_path: string | null; // filename within the artwork/ prefix, or null
  file_path: string; // filename within the audio/ prefix
  date_added: number; // unix ms
};

/**
 * Schema as idempotent CREATE-IF-NOT-EXISTS, run as a single script via
 * executeMultiple. Matches the Phase 1 spec in CLAUDE.md.
 */
export async function initDb(): Promise<void> {
  await db.executeMultiple(`
    PRAGMA foreign_keys = ON;

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

export async function insertTrack(row: TrackRow): Promise<void> {
  await db.execute({
    sql: `
      INSERT INTO tracks (id, title, artist, album, duration, artwork_path, file_path, date_added)
      VALUES (:id, :title, :artist, :album, :duration, :artwork_path, :file_path, :date_added)
    `,
    args: row,
  });
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

export async function listTracks(opts: ListOptions = {}): Promise<TrackRow[]> {
  const sort: SortKey = opts.sort && opts.sort in SORT_COLUMNS ? opts.sort : "dateAdded";
  const order: SortOrder = opts.order === "asc" ? "asc" : "desc";
  const column = SORT_COLUMNS[sort];

  const args: InValue[] = [];
  let where = "";
  const search = opts.search?.trim();
  if (search) {
    where = "WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?";
    const like = `%${search}%`;
    args.push(like, like, like);
  }

  // NOCASE for text sorts; title as a stable tiebreak. date_added stays numeric.
  const collate = column === "date_added" ? "" : "COLLATE NOCASE";
  const orderBy =
    column === "date_added"
      ? `date_added ${order}`
      : `${column} ${collate} ${order}, title COLLATE NOCASE ASC`;

  const result = await db.execute({
    sql: `SELECT * FROM tracks ${where} ORDER BY ${orderBy}`,
    args,
  });
  return result.rows as unknown as TrackRow[];
}

export async function getTrack(id: string): Promise<TrackRow | undefined> {
  const result = await db.execute({
    sql: "SELECT * FROM tracks WHERE id = ?",
    args: [id],
  });
  return (result.rows[0] as unknown as TrackRow) ?? undefined;
}

/** Update the user-editable metadata fields. Only provided fields change. */
export async function updateTrackMetadata(
  id: string,
  fields: Partial<Pick<TrackRow, "title" | "artist" | "album">>,
): Promise<TrackRow | undefined> {
  const current = await getTrack(id);
  if (!current) return undefined;
  await db.execute({
    sql: "UPDATE tracks SET title = :title, artist = :artist, album = :album WHERE id = :id",
    args: {
      title: fields.title ?? current.title,
      artist: fields.artist ?? current.artist,
      album: fields.album ?? current.album,
      id,
    },
  });
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

export async function createAlbum(
  id: string,
  name: string,
  createdAt: number,
): Promise<AlbumRow> {
  await db.execute({
    sql: "INSERT INTO albums (id, name, created_at) VALUES (?, ?, ?)",
    args: [id, name, createdAt],
  });
  return { id, name, created_at: createdAt };
}

export async function getAlbum(id: string): Promise<AlbumRow | undefined> {
  const result = await db.execute({
    sql: "SELECT * FROM albums WHERE id = ?",
    args: [id],
  });
  return (result.rows[0] as unknown as AlbumRow) ?? undefined;
}

export async function listAlbums(): Promise<AlbumSummary[]> {
  const result = await db.execute("SELECT * FROM albums ORDER BY created_at DESC");
  const albums = result.rows as unknown as AlbumRow[];

  const summaries: AlbumSummary[] = [];
  for (const a of albums) {
    const countRes = await db.execute({
      sql: "SELECT COUNT(*) AS c FROM album_tracks WHERE album_id = ?",
      args: [a.id],
    });
    const coverRes = await db.execute({
      sql: `
        SELECT t.artwork_path AS p
        FROM album_tracks at JOIN tracks t ON t.id = at.track_id
        WHERE at.album_id = ? AND t.artwork_path IS NOT NULL
        ORDER BY at.position ASC LIMIT 1
      `,
      args: [a.id],
    });
    summaries.push({
      ...a,
      track_count: Number((countRes.rows[0] as unknown as { c: number }).c),
      cover_artwork_path:
        ((coverRes.rows[0] as unknown as { p: string } | undefined)?.p) ?? null,
    });
  }
  return summaries;
}

export async function renameAlbum(
  id: string,
  name: string,
): Promise<AlbumRow | undefined> {
  const result = await db.execute({
    sql: "UPDATE albums SET name = ? WHERE id = ?",
    args: [name, id],
  });
  return result.rowsAffected > 0 ? getAlbum(id) : undefined;
}

export async function deleteAlbum(id: string): Promise<boolean> {
  // album_tracks rows cascade away; the tracks themselves are untouched.
  const result = await db.execute({
    sql: "DELETE FROM albums WHERE id = ?",
    args: [id],
  });
  return result.rowsAffected > 0;
}

/** Tracks in an album, ordered by their stored position. */
export async function getAlbumTracks(albumId: string): Promise<TrackRow[]> {
  const result = await db.execute({
    sql: `
      SELECT t.* FROM album_tracks at
      JOIN tracks t ON t.id = at.track_id
      WHERE at.album_id = ?
      ORDER BY at.position ASC
    `,
    args: [albumId],
  });
  return result.rows as unknown as TrackRow[];
}

/**
 * Append the given tracks to an album (skipping ones that don't exist or are
 * already members). Returns the number actually added. Runs as one
 * interactive transaction so the position sequence stays consistent.
 */
export async function addTracksToAlbum(
  albumId: string,
  trackIds: string[],
): Promise<number> {
  const tx = await db.transaction("write");
  try {
    const maxRes = await tx.execute({
      sql: "SELECT MAX(position) AS m FROM album_tracks WHERE album_id = ?",
      args: [albumId],
    });
    let pos = Number((maxRes.rows[0] as unknown as { m: number | null }).m ?? -1);

    let added = 0;
    for (const tid of trackIds) {
      const existsRes = await tx.execute({
        sql: "SELECT 1 FROM tracks WHERE id = ?",
        args: [tid],
      });
      if (existsRes.rows.length === 0) continue;

      const memberRes = await tx.execute({
        sql: "SELECT 1 FROM album_tracks WHERE album_id = ? AND track_id = ?",
        args: [albumId, tid],
      });
      if (memberRes.rows.length > 0) continue;

      pos++;
      await tx.execute({
        sql: "INSERT INTO album_tracks (album_id, track_id, position) VALUES (?, ?, ?)",
        args: [albumId, tid, pos],
      });
      added++;
    }
    await tx.commit();
    return added;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function removeTrackFromAlbum(
  albumId: string,
  trackId: string,
): Promise<boolean> {
  const result = await db.execute({
    sql: "DELETE FROM album_tracks WHERE album_id = ? AND track_id = ?",
    args: [albumId, trackId],
  });
  return result.rowsAffected > 0;
}

/** Set the full track order for an album (ids not in the album are ignored). */
export async function reorderAlbumTracks(
  albumId: string,
  orderedTrackIds: string[],
): Promise<void> {
  if (orderedTrackIds.length === 0) return;
  await db.batch(
    orderedTrackIds.map((tid, i) => ({
      sql: "UPDATE album_tracks SET position = ? WHERE album_id = ? AND track_id = ?",
      args: [i, albumId, tid],
    })),
    "write",
  );
}
