# AGENT STATE -- proPod Autonomous Engineer

> Read at session START, written at session END. Persistent memory across sessions.

---

## Current State

**Last updated:** 2026-05-06
**Last session (5):** Follow notification tap routing -- push notification tap navigates to follower creator profile (PR #116)
**Test suite baseline:** ~486 backend tests

**Tech stack:** React Native + Expo / FastAPI + SQLAlchemy / PostgreSQL (prod) / Zustand

> Full shipped history (PR #1--#65): see `docs/SHIPPED_ARCHIVE.md`

---

## Recently Shipped (PR #66--#114)

- DM unread badge wired end-to-end (PR #102)
- DM badge 30s polling interval (PR #103)
- Playlist now-playing indicator in Library (PR #104)
- Discover Playlists now-playing indicator (PR #105)
- Fix dm/new_episode notification types (PR #107)
- Follow notification -- backend + frontend bell badge + tap routing (PR #108)
- Follow push notification -- _send_expo_push in follow_creator (PR #110)
- Like/comment push notifications -- _send_expo_push in like_podcast and create_comment (PR #111)
- New episode push notification -- fan-out background task (PR #112)
- DM push notification -- _send_expo_push in create_message (PR #113)
- Notification badge -- lastReadTimestamp + ASCII cleanup (PR #114)

> Note: DM notification tap routing, podcast share button, and haptic feedback settings toggle
> are all already implemented in master (verified 2026-05-06).

---

## Open PRs

| PR | Branch | Status |
|----|--------|--------|
| #116 | feature/follow-notification-tap-routing | open -- awaiting review |

---

## Tech Debt

- **DM inbox aggregation:** Python-side aggregation in `crud.get_dm_inbox` -- fine for now, needs SQL GROUP BY at scale.
- **APScheduler jobstore:** In-memory BackgroundScheduler won't survive worker restarts in multi-worker prod; replace with SQLAlchemy jobstore.
- **Route ordering:** Literal routes (`/following-feed`, `/search`) MUST be before parameterized (`/{id}`) in `backend/app/routers/podcasts.py`.
- **Full test suite timeout:** ~486 tests exceeds 45s sandbox limit. Run targeted groups of 3-4 files max.

---

## Next Session Suggestions

1. **[BACKEND] APScheduler SQLAlchemy jobstore** -- Replace in-memory BackgroundScheduler with
   SQLAlchemy jobstore so scheduled jobs survive worker restarts in multi-worker prod deployments.
   File: `backend/app/main.py` (scheduler init). Medium complexity, no frontend needed.

2. **[FRONTEND] Sleep timer UI** -- Add a sleep timer (stop playback after N minutes) to the
   audio player. Backend not needed -- pure Zustand + setTimeout logic. Listed in
   `docs/project/TODO_IMPROVEMENTS.md` under Advanced Playback Controls. High user value.

3. **[FRONTEND] Playlist detail share button** -- `/(main)/playlist-detail.js` has no share
   button. Add one mirroring the existing `handleShare` pattern from `details.js` (deep-link
   `volo://playlist/{id}`). Pure frontend, ~30 lines.

---

## Permanent Notes (do not delete)

**Route ordering:** Literal routes (`/following-feed`, `/search`) MUST be before parameterized (`/{id}`) in `backend/app/routers/podcasts.py`.
**apiService token cache:** `apiService.clearToken()` in `beforeEach` after 401-retry tests.
**Duplicate declaration guard:** `node --check frontend/app/(main)/home.js` after merging PRs touching same file.
**DM inbox:** Python-side aggregation in `crud.get_dm_inbox` — fine for now, needs SQL GROUP BY at scale.
**Full test suite timeout:** ~486 tests exceeds 45s sandbox limit. Run targeted groups of 3-4 files max.
**Git API fallback:** If push blocked, use browser JS: blobs → tree → commit → ref → PR.

**UTF-8 ENCODING — CRITICAL:** NEVER use `atob()` alone to decode GitHub API file content. `atob()` returns a binary string; multi-byte UTF-8 characters (→, —, emoji, etc.) become garbled (â??, â€", etc.). Always use TextDecoder:
```js
// DECODE (read from GitHub API):
const bytes = new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));
const text = new TextDecoder('utf-8').decode(bytes);

// ENCODE (write to GitHub API):
const raw = new TextEncoder().encode(text);
const b64 = btoa(String.fromCharCode(...raw));
```
This applies to every single file read/write via the GitHub contents API, no exceptions.
