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

### Phase 5 — Polish & Edge Cases ✅ COMPLETE
- [x] Empty states — `EmptyLibrary` (icon + guidance) for no-library and no-search-match; no-track-playing hides the mini-player and gates the takeover
- [x] Loading/skeleton states — `LibrarySkeleton` (grid/list shimmer) replaces the plain "Loading…"; takeover shows the buffering spinner
- [x] Error states — failed upload (clear message + per-file errors), library load error (with a Try again button), playback failure surfaced in **both** the mini-player and the takeover (red banner)
- [x] Responsive check — verified at 375px: library 2-col grid + wrapping toolbar, mini-player (time/volume hidden on narrow), and takeover (hero + scrub + transport all fit)
- [x] Performance pass — backdrop respects `prefers-reduced-motion` (freezes blob drift) and marks blobs `will-change: transform` (GPU compositing)

**Done when:** app feels finished at the edges. ✅ Verified — empty/loading/error states, mobile layout, and reduced-motion all confirmed in-browser.

---

### Phase 4 — Custom Albums (Organization) ✅ COMPLETE
*(Added feature from the updated plan. Shares the "Phase 4" label but is distinct from the Now Playing Takeover above; built after Phase 5. Not yet in PRD.md — consider adding to PRD Section 7 if treated as core v1 scope. A track can belong to multiple albums.)*

- [x] DB schema: `albums` (id, name, created_at) + `album_tracks` join (album_id, track_id, position) with `ON DELETE CASCADE` both ways
- [x] `POST /api/albums` — create (name only, no tracks required)
- [x] `GET /api/albums` — list all (summaries: track count + cover from first track's art)
- [x] `GET /api/albums/:id` — detail + tracks ordered by position
- [x] `PATCH /api/albums/:id` — rename
- [x] `DELETE /api/albums/:id` — delete grouping only (tracks untouched)
- [x] `POST /api/albums/:id/tracks` — add one or many (dedupe + skip nonexistent)
- [x] `DELETE /api/albums/:id/tracks/:trackId` — remove from album
- [x] `PATCH /api/albums/:id/order` — reorder (extra endpoint for the detail view's up/down)
- [x] "Create Album" UI — name-only modal (`CreateAlbumModal`)
- [x] Albums list view (`components/Albums/`) — cards using the first track's artwork, Library/Albums nav tabs in `App`
- [x] Album detail view — ordered tracks, play/rename/delete, per-track remove + move up/down
- [x] "Add to Album" action on library tracks (♫) — picker of existing albums + create-new (`AddToAlbumModal`)
- [x] "Play album" — loads the album's tracks into the queue via `playbackStore.playTrack`
- [x] Edge cases: delete album (tracks survive), delete track (CASCADE clears memberships), empty album (message + disabled Play)

**Done when:** you can create a named album, add existing tracks to it from the library, and hit play on the album to queue it through the mini-player. ✅ Verified end-to-end in the browser — create-and-add via the picker, album card with cover, play-album queues all tracks, reorder/remove persist to the server, rename, and delete (tracks survive). Full API lifecycle also verified via curl (create/validate/add/dedupe/list/reorder/remove/rename/delete). No console errors.

---

### Track Deletion (Added Feature)
*(Added feature — a track has never been fully removable before this; only rename/edit and album-membership removal existed. Built after Custom Albums. Not yet in PRD.md — consider adding to PRD Section 7 if treated as core v1 scope.)*

- [x] `DELETE /api/tracks/:id` — deletes the DB row (`album_tracks` memberships cascade via the existing FK) and best-effort removes the audio + artwork objects from R2
- [x] Client `deleteTrack` API helper (`src/api/client.ts`)
- [x] Delete action (🗑) on library tracks in both `TrackList` and `TrackGrid`, confirm-before-delete via `window.confirm` (matches the existing album-delete pattern in `AlbumDetail`)
- [x] `playbackStore.removeTrack` — if the deleted track is currently loaded, stops playback cleanly (empty queue) or slides the next queued track into its place; otherwise just drops it from the queue and fixes up the current index
- [x] Edge cases: track belongs to one or more albums (memberships cascade, album cover/track-count reflect it next load), track is mid-playback when deleted, track is the last one in the library, storage object already missing (delete still succeeds — DB row is authoritative)

**Done when:** you can delete a track from the library and it's gone from disk, the DB, any albums, and — if it was playing — playback stops or advances cleanly. ✅ Verified via curl (DELETE returns 204, re-GET 404, second DELETE 404) and in the browser (delete while a track is playing advances/stops correctly, delete from grid and list, no console errors).

---

### Background/Lock-Screen Playback (Added Feature)
*(Added feature — mobile playback previously had no OS-level media integration: no lock-screen controls, and no recovery if the browser suspended the underlying AudioContext while backgrounded. Built after Track Deletion. Scoped to browser-tab playback per an explicit decision below — not an installable home-screen PWA. Not yet in PRD.md — consider adding to PRD Section 7/10 if treated as core v1 scope.)*

- [x] `src/engine/mediaSession.ts` — wraps `navigator.mediaSession`: `setMetadata`, `setPlaybackState`, `setPositionState`, `clear`, `bindActionHandlers` (play/pause/previoustrack/nexttrack/seekto/seekbackward/seekforward/stop). Every export no-ops if the API is unsupported; each `setActionHandler` call is individually try/catched since unsupported action types throw per-call, not module-wide.
- [x] `playbackStore.ts` — added explicit `play()`/`pause()` actions (Media Session's handlers are start/stop, not toggle); `togglePlay()` now composes them. Wired `mediaSession.setMetadata` into `loadIndex()`, `setPlaybackState`/`setPositionState`/`clear` into the existing engine event-wiring block, and `bindActionHandlers` once at module load, mapping lock-screen transport actions to the same store actions the on-screen UI uses.
- [x] `AudioEngine.ts` — added a `visibilitychange`/`focus` handler that resumes a suspended `AudioContext` on return-to-foreground, gated on `!audio.paused` (never resumes a genuinely paused track's context) — mitigates the same underlying issue below for whenever the Web Audio graph *is* in use, but on its own was insufficient (see below).
- [x] **Bug found on first real-device test:** lock screen showed "playing" with no sound. Root cause: `AudioEngine.play()` unconditionally built a Web Audio graph (`AudioContext → MediaElementSource(audio) → Analyser → destination`) for an audio-reactive-visualizer feature (`getAnalyser()`) that has **no callers anywhere in the app**. Once `createMediaElementSource()` taps the `<audio>` element, all of its output is rerouted through the `AudioContext` — and mobile Safari/Chrome routinely suspend that context on backgrounding/lock, silencing playback while the element itself still reports `paused: false` (so Media Session kept showing "playing"). The `visibilitychange`/`focus` resume above only helps *after* returning to the foreground, not while still locked — the actual case being tested. **Fix:** `ensureGraph()` is no longer called from `play()`; it's now built lazily only inside `getAnalyser()`, so normal playback stays on the audio element's native output path (unaffected by AudioContext suspension) until something actually requests analyser data.
- [ ] Real-device re-verification (iOS Safari + Android Chrome, over HTTPS): lock-screen survives screen lock and app-switch **with actual sound**, lock-screen metadata/controls work (play/pause/skip/seek), queue auto-advance still fires while backgrounded, desktop sanity pass shows no console errors from unsupported action types

**Explicit non-goals (decided with the user, not silently assumed):** no web app manifest/icons/"Add to Home Screen" support, no service worker, no Wake Lock API (the goal is letting the screen sleep while audio continues, not preventing sleep), no multi-size artwork generation (the existing single `artworkUrl` is used as-is for Media Session artwork).

**Done when:** starting playback, then locking the phone or switching apps, audio keeps playing (with sound) with working lock-screen metadata and transport controls, and returning to the tab never finds playback silently stalled. ⏳ First on-device test caught a real silent-playback bug (see above); root cause fixed and typechecks clean, but not yet re-verified on a physical device.

---

### Offline Downloads (Added Feature)
*(Added feature — tracks currently always stream from R2 over the network with no local persistence; this adds a per-track offline copy stored in IndexedDB. Built after Background/Lock-Screen Playback. Not yet in PRD.md — consider adding to PRD Section 7 if treated as core v1 scope.)*

- [x] `src/engine/offlineDb.ts` — hand-rolled, promisified IndexedDB wrapper (no `idb` dependency, matching `colorExtraction.ts`'s existing precedent). One object store (`tracks`, keyed by track id) holds a record with both the audio blob and the artwork blob together, since they're always written/read/removed as a unit: `putTrack`, `getTrack`, `deleteTrack`, `listDownloadedIds`.
- [x] `src/engine/downloadManager.ts` — `downloadTrackForOffline(track, onProgress)`: fetches audio via XHR with `responseType: "blob"` and `xhr.onprogress` (mirrors `uploadTracks`'s existing upload-progress pattern in `api/client.ts`, just the receive side), fetches artwork via plain `fetch` in parallel (small, no progress needed, and a failed artwork fetch never fails the whole download), then writes both through `offlineDb.putTrack`. Wraps `QuotaExceededError` into a plain, user-readable message.
- [x] `src/store/downloadsStore.ts` — Zustand store holding only *ephemeral UI status* per track id (`none`/`downloading`/`downloaded`/`error` + progress) — IndexedDB (`offlineDb`) remains the actual source of truth for "is this downloaded," so if site data is cleared outside the app this store just goes stale until the next `hydrate()`, which runs once at module load.
- [x] `src/components/Library/DownloadButton.tsx` — shared 4-state icon button (⬇ not-downloaded / progress-ring downloading / ✓ downloaded-click-to-remove / ! error-click-to-retry), reused by both `TrackList` and `TrackGrid` next to the existing Add-to-album/Edit/Delete row actions. No confirm-before-remove — unlike track deletion, a local copy is low-stakes and instantly redownloadable.
- [x] `playbackStore.ts` — `loadIndex` is now `async` and always checks `offlineDb.getTrack()` before loading: if a local copy exists it's preferred **regardless of connectivity** (`navigator.onLine` is unreliable — e.g. true on a captive portal with no real internet — so "local copy present" is the only signal trusted for source selection); a shallow-copied `playableTrack` carries `blob:` URLs for `streamUrl`/`artworkUrl` so the pristine, network-URL `Track` objects held in `queue` (and rendered elsewhere, e.g. the library list) are never mutated. A `loadToken` counter guards against a stale async lookup clobbering state from a newer skip. Blob URLs are tracked at module scope and revoked on every subsequent track change and in `removeTrack`'s empty-queue branch, to avoid leaking them.
- [x] `playbackStore.ts` — offline error messaging: a proactive check in `loadIndex` (no local copy + `navigator.onLine === false`) sets a clear "you're offline and this track isn't downloaded" error before ever hitting the network; the existing `onError` wiring also gets an enrichment for the case where `navigator.onLine` reports `true` but the request still fails. Both reuse the existing `error`-state red-banner UI already rendered in `MiniPlayer` and `NowPlayingTakeover` — no new error UI.
- [x] `AudioEngine.ts` deliberately untouched — it already accepts any URL string (`blob:` included), and this feature must not reintroduce eager Web Audio graph building in `play()` (that was the fix for the earlier silent-background-playback bug, see above).

**Explicit non-goals for this pass (decided with the user, not silently assumed):** no service worker/Cache API (IndexedDB blobs only — simpler, and doesn't revisit the earlier no-service-worker decision); no bulk "download whole album" yet (the per-track `download(track)` primitive is trivially loop-able later — no architecture change needed when that's wanted); no dedicated Downloads nav view/filter (in-place indicators on existing library rows only); no visible "storage used" indicator (`navigator.storage.estimate()` + summed `size` — noted as a v1.1 idea).

**Done when:** a track can be downloaded from the library (list or grid) with visible progress, plays from the local copy with DevTools set to Offline, survives a page reload, and can be removed to free space (after which it requires network again) — with a clear, specific error message if you try to play a non-downloaded track while offline. ⏳ Implemented and typechecks clean; not yet manually verified in-browser (download progress/checkmark, actual offline playback via DevTools, reload persistence, and removal) — that's the next step, not done in this session.

---

### Shuffle (Added Feature) ✅ COMPLETE
*(Added feature — playback was linear only. Not yet in PRD.md — consider adding to PRD Section 7.3 if treated as core v1 scope.)*

- [x] `src/store/queueOrder.ts` — Fisher–Yates helpers. Shuffle never restarts the current track. Turning it on keeps already-played history and shuffles only the upcoming tail (and avoids leaving the same song "up next" when there's another choice). Turning it off restores the original context order (library list, album, plus explicit "add to queue" appends) with the playhead on the song that's already playing. Starting a song while shuffle is already on plays that song now and shuffles the rest of its context.
- [x] `playbackStore.ts` — `shuffle` flag + `toggleShuffle()`. `playTrack` / `addToQueue` / `removeTrack` keep the original order in a module-scoped `sourceQueue`. Next, previous, auto-advance, and lock-screen skip all walk whatever order `queue` is in, so they pick up shuffle without a separate path. An explicit "add to queue" still appends at the end while shuffle is on.
- [x] Shuffle button in the mini-player (left of previous) and in the Now Playing transport (left of previous, with a matching spacer so play stays centered). Pressed state is `aria-pressed` plus the indigo accent tint. Same store, so the two buttons stay in sync and the mode survives opening and closing the takeover.
- [x] `AudioEngine.play()` ignores `AbortError`. A fast skip replaces the source while the previous `play()` is still pending; the browser aborts that promise, and reporting it left a false "Couldn't start playback." on screen while audio continued.

**Done when:** with a song playing, turning shuffle on does not restart it, the next song is not the linear successor, previous still returns to what just played, and turning shuffle off makes the next song the original successor again. Choosing another song while shuffle is on shuffles that new context. ✅ Verified in the browser (library of 92 tracks): shuffle on → next left library order, previous returned to the song that was playing, shuffle off → next was the original successor (including two tracks that share a title, distinguished by row), takeover button toggles the same flag, pause still works, and the control stays on screen at 375px with play still centered. No console errors.

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

**Phase 5 — Polish & Edge Cases (complete)**
- **Empty/loading:** `components/Library/EmptyLibrary.tsx` (distinct copy for empty-library vs no-search-match) and `LibrarySkeleton.tsx` (shimmer matching the active grid/list view). `LibraryView` error branch gained a "Try again" retry.
- **Error coverage:** upload errors were already handled (Phase-1/patch); added playback-failure surfacing in the takeover (reads `store.error`, red banner under the title) to match the mini-player. Verified by deleting audio files on disk and reloading a track → stream 404 → error shown in both places; the backdrop still renders (art is served separately from audio).
- **Responsive:** confirmed at 375px — the library toolbar already flex-wraps, grid is 2-col on mobile, the mini-player hides time (<sm) and volume (<md), and the takeover hero/scrub/transport fit.
- **Performance:** `Backdrop` uses Framer's `useReducedMotion` to freeze the drifting blobs when the OS requests reduced motion, and sets `will-change: transform` so the blobs composite on the GPU. Blob motion is transform-only (no layout/paint thrash).

**Phase 4 — Custom Albums (complete; built after Phase 5)**
- **Data model:** two new tables — `albums` and an `album_tracks` join carrying `position`. Membership is many-to-many (a track can be in multiple albums). `ON DELETE CASCADE` on both FKs means deleting an album drops its memberships (tracks untouched) and deleting a track (no endpoint yet, but structurally ready) drops its memberships. `foreign_keys = ON` was already set.
- **Server:** `server/routes/albums.ts` mounted under `/api`. Full REST surface per the spec plus a `PATCH /albums/:id/order` reorder endpoint. Add is idempotent (skips duplicates via the composite PK and skips nonexistent track ids); positions are append-at-end and reassigned by index on reorder. `db.ts` gained album helpers (`addTracksToAlbum`/`reorderAlbumTracks` are `db.transaction`s); `serialize.ts` gained `toApiAlbum`/`toApiAlbumDetail` (cover = first track-by-position with art).
- **Client:** `components/Albums/` — `AlbumsView` (list↔detail nav), `AlbumCard`, `AlbumDetail` (play/rename/delete + per-row move-up/down + remove, optimistic reorder), `CreateAlbumModal`, `AddToAlbumModal` (picker + create-new, used from the library). `App` now has Library/Albums nav tabs. `TrackList`/`TrackGrid` gained a ♫ "Add to album" action next to Edit. `api/albums.ts` wraps the endpoints; `asError` exported from `api/client.ts` for reuse.
- **Playback:** "Play album" and clicking a track in the detail both call the existing `playbackStore.playTrack(track, album.tracks)` so the album becomes the queue — no new playback code. Deleting the currently-playing album doesn't stop playback (the queue is a store copy).
- **Note:** this feature is not yet reflected in `PRD.md`. If it's core v1 scope rather than an add-on, add it to PRD Section 7.

**Track Deletion (complete; built after Custom Albums)**
- **Server:** `deleteTrack(id)` in `db.ts` fetches the row, deletes it (`album_tracks` rows cascade via the existing `ON DELETE CASCADE` FK — no extra cleanup code needed), and returns the deleted row so the route knows which storage objects to remove. `DELETE /api/tracks/:id` in `routes/tracks.ts` calls it, 404s if the track never existed, then `Promise.allSettled`s the R2 object deletes (audio + artwork if present) — storage cleanup is best-effort since the DB row (the source of truth for "does this track exist") is already gone by that point, so a stray/missing object shouldn't turn a successful delete into an error response.
- **Client:** `deleteTrack(id)` added to `api/client.ts`. `LibraryView` owns the confirm dialog (mirrors `AlbumDetail`'s `handleDelete` pattern) and a small red error banner; on success it filters the track out of local state and calls the new `playbackStore.removeTrack(id)`.
- **`playbackStore.removeTrack`:** handles three cases — the id isn't in the current queue (no-op), it's queued but not playing (drop it, shift `index` if the removal was before the current position), or it *is* the current track (load whatever slides into its slot, or fully clear playback state if the queue is now empty). Reuses the existing `loadIndex` helper.
- **Decision — no undo/soft-delete:** deletion is immediate and permanent (matches the PRD's single-user, personal-app framing); the confirm dialog is the only safety net, consistent with album deletion elsewhere in the app.

**Background/Lock-Screen Playback (complete; built after Track Deletion)**
- **New `src/engine/mediaSession.ts`:** a thin wrapper around `navigator.mediaSession`, mirroring `AudioEngine.ts`'s "degrade gracefully" style — a single module-scoped `"mediaSession" in navigator` check means every export (`setMetadata`, `setPlaybackState`, `setPositionState`, `clear`, `bindActionHandlers`) no-ops on unsupported browsers, so callers never carry their own guards. `bindActionHandlers` wraps each `setActionHandler` call in its own try/catch — unsupported action types throw individually, not module-wide, so one failing type (e.g. `seekbackward` on an older browser) doesn't stop the rest from registering. `setPositionState` has an extra guard/try-catch of its own for transient bad values (a stale `timeupdate` tick can report `position` briefly ahead of `duration` right after a track change, before `durationchange` lands).
- **`playbackStore.ts`:** added explicit `play()`/`pause()` actions alongside the existing `togglePlay()` — Media Session's `play`/`pause` handlers are semantically start/stop, not toggle, so `togglePlay` now just composes the two. `loadIndex()` (the single choke point every track change already goes through) calls `mediaSession.setMetadata`; the existing module-load `audioEngine.setEvents({...})` block now also fans `onPlay`/`onPause`/`onTime`/`onEnded` out to `setPlaybackState`/`setPositionState` (end-of-queue sets `"paused"`, not `"none"` — the track is still loaded); `removeTrack`'s empty-queue branch calls `mediaSession.clear()`. `bindActionHandlers` is wired once at module load, mapping `previoustrack`/`nexttrack`/`seekto`/`seekbackward`/`seekforward` to the same `prev`/`next`/`seek` actions the on-screen UI already uses.
- **`AudioEngine.ts`:** added a `handleForeground` handler on `visibilitychange` + `focus` that calls `ctx.resume()` if the context is suspended when the tab becomes visible again — gated on `!audio.paused` (reusing the audio element's own flag as the "we intend to be playing" signal, the same one `onPlay`/`onPause` already derive from) so a genuinely paused track's context is never resumed. This closes a real gap: once `createMediaElementSource` reroutes the element's output through the Web Audio graph, a browser suspending that graph while backgrounded can leave `<audio>` still reporting "playing" (and `timeupdate` still firing) with no sound actually reaching the speaker.
- **Decision — no manifest/service worker/Wake Lock:** scoped to browser-tab playback only (confirmed with the user) — installable home-screen PWA support is a separate, larger phase if ever pursued. Wake Lock was deliberately not used — the goal is letting the screen sleep while audio continues, not preventing sleep. Multi-size artwork generation was also out of scope; Media Session artwork uses the existing single `artworkUrl` as-is.
- **Verification gap, noted honestly:** this is not curl-testable — Media Session and `AudioContext` suspend/resume are real browser/OS behavior with no headless equivalent, and reliable testing needs physical iOS/Android devices over an HTTPS-reachable deployment (mobile background-audio behavior differs from `localhost`), neither available in this session. Code was typecheck-clean and merged to `main` without device testing first — see the bug found below.

**Background/Lock-Screen Playback — bug fix (first real-device test)**
- User tested on a physical phone: lock screen showed "playing," but no sound came out at all after locking or backgrounding.
- **Root cause:** `AudioEngine.play()` was unconditionally calling `ensureGraph()`, building `AudioContext → MediaElementSource(audio) → Analyser → destination` on every play — for the `getAnalyser()` audio-reactive-visualizer feature, which grep confirmed has **zero callers anywhere in the app**. Once `createMediaElementSource()` taps an `<audio>` element, all of its output is captured and must flow through the `AudioContext`; mobile Safari/Chrome routinely suspend that context on backgrounding/lock (battery/policy behavior), silencing playback — while the `<audio>` element itself keeps reporting `paused: false` and firing `timeupdate`, so Media Session kept showing "playing." The `visibilitychange`/`focus` resume handler added earlier only fires on *return* to foreground, so it never helped the actual "still locked" case being tested.
- **Fix:** removed the `ensureGraph()` call from `play()` entirely; it's now called lazily from inside `getAnalyser()` only. Normal playback never touches Web Audio at all right now, so there's no context for mobile OSes to suspend — playback stays on the `<audio>` element's native output path, which backgrounds reliably (this is the same fallback path the code already had for when Web Audio fails to init, just now the default rather than the exception). If/when the audio-reactive backdrop is actually implemented (v2), whoever builds it will need to re-examine this trade-off — likely only building the graph while the tab is foregrounded, or accepting reduced background reliability while a visualizer is actively open.
- Updated `AudioEngine.ts`'s doc comments (class-level and on `play()`/`getAnalyser()`) to describe the new lazy-on-`getAnalyser()` behavior so this isn't accidentally "fixed" back to eager in a future edit.
- Not yet re-verified on a physical device — that's the next step, not this session.

**Shuffle (complete)**
- **Model:** `queue` is the playback order; `sourceQueue` (module-scoped, not rendered) is the order the listener asked for. Shuffle reorders `queue` only — `loadIndex` is not called — so the current song, its position, and playback keep going. History stays in front of the playhead so Previous still walks back through what already played. Shuffle off copies `sourceQueue` back and moves `index` to the current track's place in that order.
- **Why the "up next" bias:** a fair shuffle can leave the original successor in front, which makes the button feel broken. When there are at least two candidates, the helper swaps the original successor out of the immediate next slot.
- **"Add to queue" stays an append** even while shuffle is on. The listener asked for that track; it isn't dropped into a random slot.
- **False playback error on fast skip:** `audio.play()` rejects with `AbortError` when `load()` replaces the source mid-promise. That rejection was reported as "Couldn't start playback." Found while skipping around a shuffled queue; `play()` now ignores `AbortError` and still reports real failures (missing gesture, bad source).
- Verified in headless Chrome against the running app: order change, restore, takeover toggle, pause, and 375px layout. Play stays centered because the takeover row has a trailing spacer the same width as the shuffle button.

**Next:** re-verify background/lock-screen playback on a physical device now that the silent-playback bug is fixed. Offline downloads are implemented but not yet manually verified in-browser. Then Phase 6 (optional, non-blocking) — v2 groundwork: DB room for future fields (notes, lyrics, mood tags), storage layer swappable for cloud. Then release prep.