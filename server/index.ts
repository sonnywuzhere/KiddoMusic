import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db, initDb } from "./db.ts";
import { uploadRouter, uploadErrorHandler } from "./routes/upload.ts";
import { tracksRouter } from "./routes/tracks.ts";
import { streamRouter } from "./routes/stream.ts";
import { albumsRouter } from "./routes/albums.ts";
import { artworkRouter } from "./routes/artwork.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(express.json());

// Health check — confirms the server is up and the DB connection is live.
app.get("/api/health", async (_req, res, next) => {
  try {
    const result = await db.execute("SELECT 1 AS ok");
    const row = result.rows[0] as unknown as { ok: number };
    res.json({
      status: "ok",
      db: row.ok === 1 ? "connected" : "unknown",
      time: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// Extracted album art — proxied out of R2 (see routes/artwork.ts). Kept
// under /api so the Vite dev proxy forwards it.
app.use("/api", artworkRouter);

// API routes
app.use("/api", uploadRouter);
app.use("/api", tracksRouter);
app.use("/api", streamRouter);
app.use("/api", albumsRouter);

// Upload-specific error handling (unsupported format, file too large).
app.use(uploadErrorHandler);

// Catch-all for anything else that reached next(err) — R2/Turso failures,
// unexpected exceptions from the now-async route handlers.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error("[server] unhandled error:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error." });
};
app.use(errorHandler);

// Serve the built client (dev runs it separately via the Vite dev server —
// this only kicks in once `vite build` has produced dist/, i.e. in
// production). One Render web service exposes a single port, so Express is
// what serves the frontend there; everything else stays behind /api above.
const distDir = join(__dirname, "..", "dist");
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (_req, res) => {
    res.sendFile(join(distDir, "index.html"));
  });
}

async function main() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`[server] KiddoMusic API listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
