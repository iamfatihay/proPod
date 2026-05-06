# AGENT STATE -- proPod Autonomous Engineer

> Read at session start, written at session end. This file is working state, not historical source-of-truth.

---

## Current State

**Last updated:** 2026-05-06
**Last session (5):** Follow notification tap routing -- push notification tap navigates to follower creator profile (PR #116)
**Test suite baseline:** ~486 backend tests

**Tech stack:** React Native + Expo Router + NativeWind frontend; FastAPI + SQLAlchemy backend; PostgreSQL (prod) / SQLite (local and test)

**MVP priority:** The most important product goal is reliable podcast creation plus multi-host remote recording. The app needs to let users in different countries and network conditions join the same session, talk smoothly, and finish with a high-quality usable recording before broader feature work takes precedence.

> Full shipped history (PR #1--#65) lives in `docs/SHIPPED_ARCHIVE.md`.

---

## Recently Shipped

- DM unread badge wired end-to-end (PR #102)
- DM badge 30s polling interval (PR #103)
- Playlist now-playing indicator in Library (PR #104)
- Discover Playlists now-playing indicator (PR #105)
- Fix dm/new_episode notification types (PR #107)
- Follow notification -- backend + frontend bell badge + tap routing (PR #108)
- Follow push notification -- `_send_expo_push` in `follow_creator` (PR #110)
- Like/comment push notifications -- `_send_expo_push` in `like_podcast` and `create_comment` (PR #111)
- New episode push notification -- fan-out background task (PR #112)
- DM push notification -- `_send_expo_push` in message creation (PR #113)
- Notification badge stability via `lastReadTimestamp` (PR #114)
- Test-run stabilization, JSX lint parsing, and UI defect cleanup (PR #115)

> Verified on 2026-05-06: DM notification tap routing, playlist share, haptic feedback toggle, and follow notification tap routing are already in `master`.

---

## Open PRs

| PR | Branch | Status |
|----|--------|--------|
| #116 | feature/follow-notification-tap-routing | open -- awaiting review |

Priority note:
- Existing review comments or failing CI still come first, but when that is clear, favor the multi-host recording MVP over secondary product work.

---

## Tech Debt

- Multi-host recording quality and reliability still need stronger end-to-end validation under real remote conditions.
- Podcast/session creation, invite, join, reconnect, and recording-completion flows remain the core product path.
- DM inbox aggregation: Python-side aggregation in `crud.get_dm_inbox` is fine for now, but should become SQL `GROUP BY` at scale.
- APScheduler jobstore: in-memory scheduler will not survive worker restarts in multi-worker prod; replace with SQLAlchemy jobstore.
- Route ordering: literal routes (`/following-feed`, `/search`) must stay before parameterized (`/{id}`) in `backend/app/routers/podcasts.py`.
- `expo-video` flows still need rebuilt dev-client or real-device validation after changes.
- DM remains text-only; attachments are not implemented.
- Sleep timer uses `setInterval`; verify timing accuracy on real devices.
- Frontend unit-test coverage is still thin in several user-facing flows.
- `search_users` returns `total_likes: 0` by design for performance; UI should not depend on it.
- Creator sorting is still Python-side; acceptable at current scale.
- `handlePlayRelated` queue logic in `frontend/app/(main)/details.js` lacks focused Jest coverage.
- Share web pages still contain placeholder CTA behavior and need production-ready app-open/download handling.
- Full test suite timeout: ~486 tests exceeds the practical sandbox budget; run targeted groups of 3-4 files max.

---

## Validation Notes

- Frontend ESLint is no longer blocked by JSX parsing; targeted lint is valid again.
- Prefer focused validation only: a few pytest files max on backend, and targeted lint or `node --check` for frontend JS files.
- Do not report validation as passing unless it actually ran.

---

## Next Session Suggestions

1. **RTC MVP** -- improve session creation, join reliability, reconnect behavior, and recording completion for remote multi-user podcast sessions.
2. **RTC UX** -- tighten invite, live monitoring, and failure recovery so hosts can run remote sessions confidently.
3. **Frontend AI UX** -- continue AI-result visibility only after the primary recording path is dependable enough.

---

## Permanent Notes

- Route ordering: literal routes (`/following-feed`, `/search`) must be before parameterized (`/{id}`) in `backend/app/routers/podcasts.py`.
- `apiService.clearToken()` in `beforeEach` after 401-retry tests.
- Run `node --check frontend/app/(main)/home.js` after merging PRs touching that file.
- If working from roadmap/TODO docs, verify against code before acting.
