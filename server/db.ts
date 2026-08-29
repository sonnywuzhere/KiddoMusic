import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// SQLite file lives alongside the storage dir so all runtime data is colocated
// (and gitignored together).
const storageDir = join(__dirname, "storage");
mkdirSync(storageDir, { recursive: true });

const dbPath = join(storageDir, "kiddomusic.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/**
 * Schema lives here as idempotent CREATE-IF-NOT-EXISTS statements. Phase 1
 * fills out the tracks table properly; for Phase 0 we only need a connection
 * that opens cleanly and a place to grow.
 */
export function initDb(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      artist      TEXT,
      album       TEXT,
      duration    REAL,
      artwork_path TEXT,
      file_path   TEXT NOT NULL,
      date_added  INTEGER NOT NULL
    );
  `);
}
