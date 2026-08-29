# PRD: [Name TBD] — An Immersive Personal Music Player

**Status:** Draft v1
**Owner:** You
**Last updated:** August 29, 2026

---

## 1. Overview

A personal music player where you upload your own songs and listen through an experience designed to feel cinematic and alive, rather than utilitarian. The anchor feature is a **full-screen "Now Playing" takeover** that replaces the typical static player bar with an immersive, transition-driven visual experience.

This is not a Spotify/Apple Music competitor — it's a personal listening environment for your own library, built to make the *act* of listening feel intentional and beautiful.

---

## 2. Problem Statement

Most music players treat "now playing" as a utility screen: album art thumbnail, a progress bar, some buttons. Even the full-screen views in mainstream apps are functional, not experiential — they don't change based on the music, and transitioning between songs is instant and forgettable.

For someone who wants listening to feel like a moment rather than a background task, there's no lightweight, personal tool that turns your own uploaded music into something visually and emotionally immersive.

---

## 3. Goals

- Make playing a song feel like an event, not a UI interaction
- Support uploading and playing a personal library of audio files with rich metadata
- Build a full-screen, cinematic "Now Playing" experience as the primary way you interact with the app
- Make track-to-track transitions feel designed, not abrupt
- Create a foundation that can be extended later (moods, memories, stems, sharing) without a rewrite

### Non-Goals (for v1)
- Streaming/licensing other artists' catalogs
- Social features (shared listening rooms, comments) — future consideration
- Mobile native apps — web-first for v1
- Offline-first / PWA installability — future consideration
- Collaborative playlists or multi-user accounts

---

## 4. Target User

**Primary:** You — someone who has a personal library of songs (uploaded audio files) and wants a more emotionally engaging way to listen than a standard player.

**Secondary (future):** Friends/family you might eventually invite to experience your library or their own.

---

## 5. Assumptions

- **Platform:** Web app for v1. Chosen for upload flexibility, no app-store friction, and easier iteration on visual/motion design using modern web tech (CSS, Canvas/WebGL, Web Audio API).
- **Hosting:** Personal use initially — a single-user (or small, invite-based) system rather than a public multi-tenant product.
- **Audio format:** Standard formats supported natively by browsers (MP3, AAC/M4A, WAV, FLAC where supported).
- These assumptions are flagged as open decisions — see Section 10.

---

## 6. Core Feature: Full-Screen "Now Playing" Takeover

This is the heart of the product. It replaces the conventional mini-player-as-primary-interface pattern.

### 6.1 Entry into the takeover
- Triggered by tapping/clicking the mini-player (or auto-triggered when playback starts, configurable)
- Transition: album art scales and blurs into a full-bleed backdrop; standard UI chrome (nav, library list) fades out
- Duration: fast enough to feel responsive (~400–600ms), slow enough to register as intentional

### 6.2 Backdrop & atmosphere
- Dominant/accent colors extracted from the album art drive a slow-moving gradient, blurred color field, or subtle particle system behind the content
- Backdrop motion should be ambient — never distracting from the music itself
- Optional: intensity/motion subtly responds to the track's tempo or amplitude (stretch goal, see Section 9)

### 6.3 Foreground content
- Track title and artist treated typographically as the "hero" of the screen — large, confident, film-title-card feeling
- Album art present but not necessarily dominant — it can inform the mood without being the literal focal point
- Optional secondary content: synced lyrics (if available/transcribed), a personal note/memory attached to the track (future)

### 6.4 Track-to-track transitions
- When a track changes (skip, autoplay to next, etc.), the transition itself is a designed moment:
  - Crossfade of backdrop colors and art
  - Directional wipe or dissolve
  - Optional "cut" style transition for a punchier feel
- Transition style may be a fixed default for v1, with style options considered for v2

### 6.5 Controls & chrome
- Minimal by default — play/pause, scrub bar, skip forward/back
- Controls fade in on mouse movement/tap, fade out after a few seconds of inactivity
- Exit from takeover via a clear but unobtrusive affordance (e.g., swipe down, escape key, small collapse icon)

### 6.6 States to design for
- First launch / empty library (no song playing)
- Track loading/buffering
- Playing
- Paused
- Scrubbing/seeking
- Track ending → auto-advancing to next
- Manual skip (forward/back)
- Exiting takeover back to library view

---

## 7. Supporting Features (Foundation)

The takeover experience depends on a functional foundation underneath it:

### 7.1 Upload
- Upload one or multiple audio files at a time (drag-and-drop + file picker)
- Extract metadata automatically where embedded (title, artist, album, artwork, duration)
- Manual metadata editing for files with missing/incorrect tags
- Upload progress and error handling (unsupported format, file too large, etc.)

### 7.2 Library
- A visual library view (grid or list) of all uploaded tracks
- Basic sorting/filtering (by title, artist, album, date added)
- Search across the library

### 7.3 Playback
- Standard playback engine: play, pause, seek, skip, volume, queue
- Persistent playback state across navigation (i.e., leaving the takeover doesn't stop the music)
- Basic queue management (play next, add to queue)

### 7.4 Storage
- Audio files and metadata persisted (cloud storage + database, or local storage depending on final architecture decision — see Section 10)

### 7.5 Albums (Organization)
- Manually create named albums/collections to organize the library beyond embedded metadata (e.g. mixes, moods, groupings that don't map to a real "album" tag)
- A track can belong to multiple albums — membership is many-to-many, not a single-parent relationship
- Add existing library tracks to one or more albums; remove a track from an album without affecting the track itself or its other memberships
- Reorder tracks within an album (position is per-album, independent of library sort order)
- Rename or delete an album; deleting an album removes the grouping only — member tracks and their other album memberships are untouched
- Album list view (card per album, cover drawn from its first track's artwork) and an album detail view (ordered track list, play/rename/delete, per-track remove/reorder)
- "Play album" loads the album's tracks into the queue in order, using the same playback engine and queue as the library (Section 7.3) — no separate playback path

---

## 8. Success Criteria

Since this is a personal project rather than a metrics-driven product, success is qualitative first:

- You choose to use this over your default music player for personal listening
- The full-screen takeover feels genuinely different/better than a standard "now playing" screen — not just decorative
- Uploading and organizing your library is low-friction enough that you actually populate it
- The transition system feels intentional, not gimmicky, after repeated use

If/when this expands to other users, quantitative signals (session length, return visits, tracks uploaded per user) would be layered in.

---

## 9. Future Considerations (v2+)

Pulled from the broader brainstorm — not in scope for v1, but the architecture should not preclude these:

- **Mood/atmosphere layer:** ambient ligting integration (Philips Hue/LIFX), audio-reactive backdrop intensity
- **Personal/reflective layer:** attach notes, photos, or voice memos to specific tracks or moments; a passive listening journal
- **Interactive audio:** on-the-fly stem separation (vocals/instrumental), auto-transcribed synced lyrics with karaoke-style highlighting
- **Social layer:** shared listening rooms, invite-based library sharing, timestamped comments
- **Smart queues:** mood/activity-based playlists generated from your own library

---

## 10. Open Questions

- **Platform confirmation:** Is web-first the right call, or is a native mobile/desktop app preferred for v1? (Currently assumed: web)
- ~~**Hosting/storage:** Self-hosted, or a managed backend (e.g., cloud storage + a lightweight database)?~~ **Decided (Aug 29, 2026):** managed hosting, not self-hosted — the deploy target is a host you don't manage/maintain yourself. Audio/artwork storage moves to a cloud object store; see Build Log for the specific service selection and migration.
- ~~**Audience scope:** Strictly personal, or should the data model support inviting others from day one?~~ **Decided (Aug 29, 2026):** strictly personal — no `user`/ownership scoping added to the data model for v1. Revisit only if invite/sharing becomes an actual roadmap item; adding it later means a migration (new `users` table + `user_id` FKs on `tracks`/`albums`), which is accepted as a future cost.
- ~~**Transition style:** Should v1 ship with one fixed transition style, or a small set of selectable styles?~~ **Decided (Aug 29, 2026):** one fixed style only — the crossfade already built in Phase 4 (`AnimatePresence popLayout`). No style picker/settings surface for v1 or planned for v2.
- **Legal/licensing:** Confirm all uploaded content is music you own or have rights to use, since this stores and plays personal files rather than licensed catalog content.

---

## 11. Rough Scope for v1

**In:**
- Upload + metadata extraction
- Library view with search/sort
- Standard playback engine
- Full-screen Now Playing takeover with color-extracted backdrop, hero typography, and designed track transitions
- Minimal, auto-hiding playback controls
- Custom albums — manual, many-to-many organization of the library, independent of embedded metadata

**Out (deferred to v2+):**
- Lighting integration
- Memories/journal
- Stem separation
- Lyrics
- Social/sharing features
- Native mobile/desktop apps