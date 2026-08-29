import express from "express";
import { db, initDb, artworkDir } from "./db.ts";
import { uploadRouter, uploadErrorHandler } from "./routes/upload.ts";
import { tracksRouter } from "./routes/tracks.ts";
import { streamRouter } from "./routes/stream.ts";
import { albumsRouter } from "./routes/albums.ts";

const PORT = Number(process.env.PORT ?? 3001);

initDb();

const app = express();
app.use(express.json());

// Health check — confirms the server is up and the DB connection is live.
app.get("/api/health", (_req, res) => {
  const row = db.prepare("SELECT 1 AS ok").get() as { ok: number };
  res.json({
    status: "ok",
    db: row.ok === 1 ? "connected" : "unknown",
    time: new Date().toISOString(),
  });
});

// Extracted album art. Served under /api so the Vite dev proxy forwards it.
app.use(
  "/api/artwork",
  express.static(artworkDir, {
    immutable: true,
    maxAge: "1y",
  }),
);

// API routes
app.use("/api", uploadRouter);
app.use("/api", tracksRouter);
app.use("/api", streamRouter);
app.use("/api", albumsRouter);

// Upload-specific error handling (unsupported format, file too large).
app.use(uploadErrorHandler);

app.listen(PORT, () => {
  console.log(`[server] KiddoMusic API listening on http://localhost:${PORT}`);
});
