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
