# CLAUDE.md — Immersive Music Player Build Guide

This file is the working build plan for the project described in `PRD.md`. It exists so that any Claude Code session (or human) can pick up the project, know what phase it's in, and know what "done" looks like for each step. Work through phases in order — each one builds on the last. Check off steps as they're completed.

---

## Project Summary

A personal web app for uploading your own music and listening through an immersive, full-screen "Now Playing" experience with cinematic transitions between tracks — replacing the typical static player bar. See `PRD.md` for full product context; this file is the technical execution plan.

---

## Tech Stack & Key Decisions

These are concrete choices made to keep this buildable as a solo/personal project. Flagged assumptions map to the PRD's open questions (Section 10) — revisit if requirements change.

| Concern | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite | Fast dev loop, good ecosystem for audio/visual work |
| Styling | Tailwind CSS + CSS custom properties | Utility speed, and CSS variables make per-track dynamic theming (color extraction) easy |
| Animation | Framer Motion | Built for exactly this — cinematic enter/exit and crossfade transitions |
| Audio playback | Web Audio API (via a custom `AudioEngine` wrapper) | Native, gives access to waveform/frequency data for future audio-reactive visuals |
| Metadata extraction | `music-metadata-browser` | Reads ID3/embedded tags (title, artist, album, artwork) client-side on upload |
| Color extraction | `colorthief` or `node-vibrant` | Extracts dominant/palette colors from album art for the backdrop |
| Backend | Node + Express | Minimal, sufficient for a personal-scale app |
| Database | SQLite (`better-sqlite3`) | Zero-config, file-based, fine for single-user scale |
| File storage | Local disk (`server/storage/`) | Simplest for v1; swappable for cloud storage later without touching the frontend |
| Upload handling | `multer` | Standard, well-supported multipart upload middleware |

**Assumption carried from PRD:** web app, self-hostable, single-user for v1 (Section 5 & 10 of PRD). If multi-device sync or cloud storage becomes a requirement, the storage layer is the only piece that needs to change — routes and DB schema are designed to be storage-agnostic.

---

## Project Structure

```
music-player/
├── CLAUDE.md
├── PRD.md
├── package.json
├── server/
│   ├── index.ts              # Express app entry
│   ├── db.ts                 # SQLite setup + schema
│   ├── routes/
│   │   ├── upload.ts         # POST /upload — handles file + metadata extraction
│   │   ├── tracks.ts         # GET /tracks, /tracks/:id — library queries
│   │   └── stream.ts         # GET /stream/:id — audio file streaming
│   ├── storage/               # uploaded audio files + extracted artwork live here
│   └── metadata/
│       └── extract.ts        # wraps music-metadata for tag parsing
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── Library/           # grid/list view, search, sort
│   │   ├── Upload/            # drag-and-drop + file picker UI
│   │   ├── MiniPlayer/        # persistent bottom bar, entry point to takeover
│   │   └── NowPlaying/
│   │       ├── NowPlayingTakeover.tsx
│   │       ├── Backdrop.tsx        # color-extracted gradient/particle field
│   │       ├── TrackTransition.tsx # crossfade/wipe logic between tracks
│   │       └── Controls.tsx        # auto-hiding playback controls
│   ├── engine/
│   │   ├── AudioEngine.ts     # Web Audio API wrapper: play/pause/seek/queue
│   │   └── colorExtraction.ts # album art → palette
│   ├── store/
│   │   └── playbackStore.ts   # current track, queue, playback state (Zustand)
│   └── styles/
└── README.md
```

---

## Build Pipeline

### Phase 0 — Project Setup ✅ COMPLETE
- [x] Scaffold Vite + React + TypeScript project
- [x] Set up Tailwind CSS (v4, via `@tailwindcss/vite` plugin — CSS-first config in `src/styles/index.css`)
- [x] Set up Express server with a basic health-check route (`GET /api/health`)
- [x] Configure concurrent dev script (client + server run together via `concurrently`)
- [x] Set up SQLite DB file and connection in `server/db.ts` (`better-sqlite3`, WAL mode)
- [x] `PRD.md` already present in the repo root

**Done when:** `npm run dev` starts both client and server, and the client can hit a test API route. ✅ Verified — client at :5173 proxies `/api` → server at :3001, health pill renders "API healthy" with a live DB connection, no console errors.

---

### Phase 1 — Data Layer: Upload, Metadata, Storage
*(PRD 7.1, 7.4)*

- [x] Define DB schema: `tracks` table (id, title, artist, album, duration, artwork_path, file_path, date_added)
- [x] Build `POST /upload` route with `multer` — accepts single or multiple audio files (field name `files`)
- [x] Extract embedded metadata (title, artist, album, artwork) via `music-metadata` on upload (server-side)
- [x] Store audio file + extracted artwork in `server/storage/` (`audio/` and `artwork/` subdirs)
- [x] Insert track record into DB
- [x] Handle errors: unsupported format (415), oversized file (413, 250MB cap), missing metadata (fallback title → filename)
- [x] Build drag-and-drop + file picker upload UI in `components/Upload/`
- [x] Show upload progress (XHR progress events) and error states in the UI
- [x] Build manual metadata edit UI for tracks with missing/incorrect tags

**Done when:** you can drag in an MP3, see it appear in the DB with correct metadata, and fix metadata manually if needed. ✅ Verified end-to-end in the browser — DnD upload of a WAV (filename fallback) and API upload of a tagged MP3 (title/artist/album + cover art extracted and served), both render in the library; edit modal PATCHes and persists to the DB. All `/api` requests 200/201.

---

### Phase 2 — Library View
*(PRD 7.2)*

- [x] Build `GET /tracks` route with sort/filter query params (`sort`, `order`, `search`)
- [x] Build grid/list library view in `components/Library/`
- [x] Implement sort (title, artist, album, date added) + asc/desc toggle
- [x] Implement search across the library (title/artist/album, debounced, server-side)
- [x] Wire clicking a track to start playback (feeds into Phase 3)

**Done when:** your full uploaded library is browsable, searchable, and sortable. ✅ Verified with 5 seeded tracks — grid + list views, sort by every field (with title tiebreak), asc/desc, debounced search across all three fields, injection-safe sort whitelist, and click-to-play driving the mini-player with working next/prev queue navigation.

---

### Phase 3 — Playback Engine
*(PRD 7.3)*

- [x] Build `AudioEngine.ts`: wraps Web Audio API for play/pause/seek/volume
- [x] Build `GET /stream/:id` route to serve audio with range-request support (for seeking)
- [x] Build `playbackStore.ts`: current track, queue, play/pause state, progress
- [x] Build persistent `MiniPlayer` component (survives navigation)
- [x] Implement basic queue: play next, add to queue, skip forward/back
- [x] Confirm playback state persists when navigating away from and back to the takeover

**Done when:** playback works reliably from the mini-player, independent of which screen you're on. ✅ Verified with real audio (multi-second WAV tones): play/pause/resume, scrub-seek, volume, next/prev queue nav, auto-advance through the queue (c→b→a), clean stop at end-of-queue, and uninterrupted playback across a grid↔list view switch. Range endpoint verified (206 partial, open-ended/suffix ranges, 416 unsatisfiable, 404 missing).

---

### Phase 4 — Full-Screen "Now Playing" Takeover (Core Feature)
*(PRD Section 6 — this is the anchor feature, take the most care here)*

- [x] **4.1 Entry transition** *(PRD 6.1)*: expand from mini-player → full-screen — overlay fade + shared-`layoutId` art morph (mini-player thumb ↔ hero art) via Framer Motion
- [x] **4.2 Backdrop** *(PRD 6.2)*: color extraction from album art → blurred full-bleed cover + slow-drifting palette-colored blobs
- [x] **4.3 Foreground typography** *(PRD 6.3)*: hero title/artist, album art present but not dominant
- [x] **4.4 Track-to-track transitions** *(PRD 6.4)*: crossfade of backdrop + art + text on skip/auto-advance (AnimatePresence)
- [x] **4.5 Controls** *(PRD 6.5)*: auto-hiding transport (3s idle), reveal on pointer/touch, kept visible while scrubbing; Esc/chevron exit, Space toggles play
- [x] **4.6 State coverage** *(PRD 6.6)*: empty library (takeover gated on a current track), buffering (spinner), playing/paused, scrubbing, auto-advance, manual skip, exit

**Done when:** starting playback feels like an event — the entry, backdrop, and transitions all read as intentional, not default. ✅ Verified with real album-art tracks — backdrop palette adapts per cover (deep red for a neon cover, olive for a kitchen cover), crossfade on skip, auto-hide+reveal, Esc exit preserving playback, no console warnings.

---

### Phase 5 — Polish & Edge Cases
- [ ] Empty states (no library yet, no track playing)
- [ ] Loading/skeleton states for library and takeover
- [ ] Error states (failed upload, corrupt file, playback failure)
- [ ] Responsive check — confirm takeover and library work at different window sizes
- [ ] Performance pass — confirm backdrop animation doesn't jank on lower-end hardware

---

### Phase 6 — Groundwork for v2 (optional, do not block v1 on this)
*(PRD Section 9)*

- [ ] Confirm DB schema has room for future fields (notes/memories, lyrics, mood tags) without migration pain
- [ ] Keep `AudioEngine` structured so frequency/amplitude data is already accessible (for future audio-reactive backdrop intensity)
- [ ] Keep storage layer abstracted enough to swap local disk for cloud storage later

---

## Working Conventions

- Work one phase at a time. Don't start Phase 4 styling work before Phase 1–3 are functionally solid — the takeover is the payoff, not a shortcut.
- Commit at the level of individual checklist items where practical.
- Every phase should end in a runnable, demoable state — not partial/broken.
- When a PRD open question (Section 10) forces a decision, note the decision and rationale back in `PRD.md`'s Open Questions section rather than silently deciding.

---

## Open Decisions Carried from PRD

These aren't blockers, but should be resolved as they come up rather than assumed silently:

- Should storage stay local-disk, or move to cloud storage (S3/Supabase) — relevant once multi-device access matters
- Fixed single transition style for v1, or a small selectable set
- Whether the data model should support multiple users/invites from day one, even if unused in v1 UI

---

## Build Log

**Phase 0 — Project Setup (complete)**
- Scaffolded manually (not `create-vite`) for full control over the single-package client+server layout. Everything lives at the repo root — the `music-player/` prefix in the Project Structure diagram is illustrative of the repo name, not a nested folder.
- **Decision — Tailwind v4 over v3:** used Tailwind v4 with the `@tailwindcss/vite` plugin and CSS-first config (`@import "tailwindcss"` in `src/styles/index.css`), rather than v3's PostCSS + `tailwind.config.js`. Simpler, no config file, and CSS custom properties for per-track theming (`--bg-base`, `--accent`) sit naturally in the same stylesheet. Revisit only if a plugin needs the JS config.
- **Dev orchestration:** `npm run dev` runs both via `concurrently`; client (Vite) on :5173 proxies `/api` → Express on :3001. Server runs through `tsx watch` (no build step in dev).
- **DB:** `better-sqlite3` in WAL mode, file at `server/storage/kiddomusic.db` (gitignored). `tracks` table stubbed per the Phase 1 schema so the connection has something real to open.
- Also added: `.gitignore`, `.claude/launch.json` (dev-server launch config), `npm run typecheck`. Note: not yet a git repo — run `git init` when ready to start committing per-checklist-item.

**Phase 1 — Data Layer (complete)**
- **Decision — server-side metadata, not `music-metadata-browser`:** the tech-stack table listed `music-metadata-browser` (client-side), but the folder structure (`server/metadata/extract.ts`) and checklist point to server-side extraction. Went server-side with `music-metadata` (v11, works in Node) — single source of truth, client-agnostic, and the audio bytes are already on the server. Client never parses tags.
- **API surface:** `POST /api/upload` (multer, field `files`, single/multi), `GET /api/tracks`, `GET /api/tracks/:id`, `PATCH /api/tracks/:id` (title/artist/album edit). Artwork served static under `/api/artwork/*` (kept under `/api` so the Vite dev proxy forwards it — the proxy only covers `/api`).
- **Storage layout:** `server/storage/{audio,artwork}/` + `kiddomusic.db`, bare filenames in the DB (storage-agnostic, per the swap-friendly design). Audio streaming route (`/api/stream/:id`) is stubbed in serialized URLs but implemented in Phase 3.
- **Bug fixed:** `better-sqlite3` prepares statements eagerly, so top-level `db.prepare(INSERT…)` ran before the table existed. Moved `initDb()` (idempotent `CREATE IF NOT EXISTS`) to run at import time in `db.ts` before any prepare. Surfaced only after wiping the DB — worth remembering.
- **Client:** `src/api/client.ts` (fetch + XHR upload with progress), `components/Upload/UploadZone.tsx` (DnD + picker + progress + per-file errors), `components/Library/{TrackList,EditMetadataModal}.tsx`. `TrackList` is intentionally minimal — Phase 2 replaces it with the real Library (grid/list, sort, filter, search).
- Deps added: `multer` (2.x), `music-metadata` (11.x), `@types/multer`.

**Phase 2 — Library View (complete)**
- **Server:** `GET /api/tracks` now takes `sort` (title|artist|album|dateAdded), `order` (asc|desc), `search`. Sort keys are whitelisted → real columns (no SQL injection); text sorts use `COLLATE NOCASE` with `title` as a stable tiebreak; search is a case-insensitive `LIKE %term%` across title/artist/album.
- **Client:** `components/Library/LibraryView.tsx` owns the toolbar (search box, sort select, order toggle, grid/list toggle) + fetching (search debounced 250ms, refetch on any query change). `TrackGrid.tsx` (artwork-forward cards) and the updated `TrackList.tsx` (rows) are both click-to-play and show a current-track highlight. `EditMetadataModal` reused from Phase 1.
- **Playback wiring:** added `store/playbackStore.ts` (Zustand) — `currentTrack`, `queue`, `index`, `isPlaying`, and `playTrack/togglePlay/next/prev`. Clicking a track calls `playTrack(track, tracks)` so the whole visible list becomes the queue. `components/MiniPlayer/MiniPlayer.tsx` is a persistent bottom bar reading the store — controls mutate state but produce **no audio yet** (labeled "audio in Phase 3"). Phase 3 binds this store to the real AudioEngine.
- Dep added: `zustand`.

**Phase 3 — Playback Engine (complete)**
- **`engine/AudioEngine.ts`:** wraps a detached `HTMLAudioElement` (native streaming/buffering/range-seek) routed through a Web Audio graph — `MediaElementSource → Analyser → destination`. The `<audio>` gives real seekable playback; the `AnalyserNode` (fftSize 2048, exposed via `getAnalyser()`) is ready for Phase 4's audio-reactive backdrop. Web Audio graph is built lazily on first `play()` inside the user gesture; degrades to plain-element playback if Web Audio is unavailable. Exposed as a **module-level singleton** (`audioEngine`) so playback lives outside React and survives component/screen changes.
- **`GET /api/stream/:id`:** looks up the track, serves the file from `storage/audio` with `Accept-Ranges`, and honors `Range` — 206 Partial Content with correct `Content-Range`/`Content-Length` for normal, open-ended, and suffix ranges; 416 for unsatisfiable; 404 for missing track/file. This is what makes seeking work.
- **`store/playbackStore.ts`:** now drives the engine. Adds `currentTime`, `duration`, `volume`, `buffering`, `error`; actions `seek`, `setVolume`, `addToQueue`. Engine events are wired back into the store (`onTime/onDuration/onPlay/onPause/onWaiting/onCanPlay/onError/onEnded`). `onEnded` auto-advances to the next queue item, or stops cleanly at the end. `prev` restarts the track if >3s in, else steps back (standard behavior).
- **`MiniPlayer`:** full transport now — scrub bar (seek), current/total time, volume slider, buffering + error states, prev/play-pause/next. `.mp-range` styling (fill via `--pct`) added to `index.css`. Removed the Phase-2 "audio in Phase 3" stub label. "Add to queue" (+) affordance added to `TrackList` rows.
- **Gotcha for testing, not a code bug:** creating multiple `AudioContext`s in a page (e.g. ad-hoc console probes) can stall the app's singleton engine; a fresh page load clears it. Real playback is reliable — the earlier "stuck at 0:00" during verification was self-inflicted test pollution.

**Phase 4 — Now Playing Takeover (complete)**
- **Decision — dependency-free color extraction:** `engine/colorExtraction.ts` extracts the palette on a canvas (downsample to 48×48 → 4-bit/channel histogram → top swatches, dominant + most-saturated accent + isDark) rather than `node-vibrant`/`colorthief`. The artwork is same-origin (Vite proxy), so `getImageData` doesn't taint the canvas, and this sidesteps node-vibrant's ESM/Vite import friction. `DEFAULT_PALETTE` covers art-less tracks.
- **Components (`components/NowPlaying/`):** `Backdrop` (blurred full-bleed cover + drifting palette blobs w/ `screen` blend + contrast overlay), `Controls` (auto-hiding scrub/transport), `TrackTransition` (AnimatePresence `popLayout` crossfade), `NowPlayingTakeover` (composes them; owns palette extraction, the idle-timer for controls, and Esc/Space keybinds).
- **Entry/exit:** the mini-player artwork and the takeover hero art share `layoutId="np-art"`, so Framer morphs the thumb into the hero on open and back on close. Overlay fades. `App` gates the takeover on `takeoverOpen && currentTrack` inside `AnimatePresence`, and auto-closes it if playback clears.
- **Analyser** (from Phase 3's `AudioEngine.getAnalyser()`) is available but not yet used — audio-reactive backdrop intensity is a deliberate v2 stretch (PRD §9), not wired in.
- Dep added: `framer-motion`.

**Next:** Phase 5 — Polish & edge cases: empty/loading/skeleton states, error states (failed upload/corrupt file/playback failure), responsive check (takeover + library at different sizes), and a performance pass on the backdrop animation.