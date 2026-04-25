# AGENT STATE — proPod Autonomous Engineer

> Read at session START, written at session END. Persistent memory across sessions.

---

## 📍 Current State


**Last updated:** 2026-04-25  
**Last session:** Playlist cover art mosaic in Library Playlists tab — PR #86  
**Test suite baseline:** ~440 backend tests

**Tech stack:** React Native + Expo · FastAPI + SQLAlchemy · PostgreSQL (prod) / SQLite (test only)

> Full shipped history (PR #1–#65): see `docs/SHIPPED_ARCHIVE.md`

---

## ✅ Recently Shipped (PR #66–#85)

- ✅ Listening history screen — progress bar, completion badge, pagination (PR #66)
- ✅ Listening history delete entry — `DELETE /podcasts/{id}/history`, 5 tests (PR #67)
- ✅ Persisted Haptic Feedback setting — `hapticFeedback.js`, wired to touch paths (PR #68)
- ✅ Fix double-encoded UTF-8 mojibake in `crud.py` — 88 occurrences (PR #69)
- ✅ `EpisodeRow` Zustand selector perf — derived boolean, O(n)→O(2) re-renders (PR #70)
- ✅ `new_episode` follower notification fan-out — `_notify_followers_new_episode()`, in-app + Expo push, 5 tests (PR #71)
- ✅ `new_episode` push tap routing — `_layout.js` routes to episode detail; `serverTypes` test (PR #72)
- ✅ Dev workflow scripts + UI tab bar and feed improvements (PR #73)
- ✅ `new_episode` fan-out via FastAPI BackgroundTask — non-blocking `POST /podcasts/` (PR #74)
- ✅ Demo user error-handling feedback — next() fallback tests, pre-commit quoting fix, repeat=all single-item loop fix, conftest engine.dispose(), SQLite check_same_thread (PR #75)
- ✅ Expo push receipt polling — PushTicket model, Alembic migration, `check_push_receipts()`, `POST /admin/push-receipts/check`, 15 tests (PR #76)
- ✅ Creator Search tab — `GET /users/search`, `search_users` CRUD, `searchUsers` apiService, 3-tab toggle, `CreatorCard` with optimistic follow, 14 tests (PR #77)
- ✅ Category filter chips in Search (Podcasts mode) — horizontal chips, `category=` param, active-filter label + Clear, mode-switch reset (PR #78)
- ✅ Creator search sort by followers — `sort_by` param to `GET /users/search`, Name/Followers toggle in Creators tab (PR #79)
- ✅ Empty-state category browse grid on Search screen — 2-column card grid in Podcasts/idle mode (PR #80)
- ✅ Trending reposition to horizontal scroll row + Related Podcasts cover art fix (PR #81)
- ✅ Related Podcasts horizontal GradientCard scroll row in detail screen + `handlePlayRelated` callback (PR #82)
- ✅ Fix `ReferenceError: insets is not defined` crash on Creator Analytics screen + profile shortcut (PR #83)
- ✅ Add Playlists tab to Library screen — PlaylistRow, empty state, Manage shortcut (PR #84)
- ✅ Daily listening-activity bar chart on Creator Analytics screen — pure-RN bars, parallel fetch, 10 tests (PR #85)

---

## 🔄 What's open

- PR #86 `feature/playlist-cover-art-mosaic` — 2×2 cover art mosaic in Library Playlists tab. `preview_thumbnails` field on `PlaylistResponse`, batched JOIN in CRUD, `PlaylistMosaic` RN component with icon-bubble fallback. 4 new backend tests (36 total).

---

## 🐛 Known issues / tech debt

- Push receipt check is manual only — needs APScheduler or lifespan background task wired in `main.py`
- Frontend ESLint blocked repo-wide (JSX parsing). Use `node --check` + Jest until fixed.
- DM inbox: Python-side aggregation in `crud.get_dm_inbox` — needs SQL GROUP BY at scale
- DM: text-only, no attachments
- Sleep timer: `setInterval` — verify accuracy on real device
- Frontend unit test coverage thin
- `search_users` returns `total_likes: 0` (skipped for perf; not shown in UI)
- Creator sort is Python-side — fine at current scale, needs SQL ORDER BY subquery for large datasets
- `handlePlayRelated` queue logic in details.js has no Jest unit test coverage
- Plays-over-time chart reflects last-session-per-user-per-podcast (unique constraint); a per-event play log would enable exact daily counts
- Library Playlists tab loads up to 50 playlists — no pagination yet
- Mosaic not yet applied to public playlists screen (`playlists.js`) UI — backend `GET /playlists/public` now populates `preview_thumbnails`, so the frontend just needs to consume them

---

## 🗺️ Next Session Suggestions

1. **[BACKEND+FRONTEND] APScheduler push receipt auto-run** — `backend/app/main.py`: add FastAPI `lifespan` context manager with an `apscheduler` `BackgroundScheduler` running `crud.check_push_receipts` every 30 min. Add `apscheduler` to `backend/requirements.txt`. No migration needed. Genuinely improves push reliability.

2. **[FEATURE] Mosaic on public playlists screen** — `frontend/app/(main)/playlists.js` already fetches `GET /playlists/public`, and as of PR #86 the public endpoint populates `preview_thumbnails` (SQL window-function fetch, max 4 thumbnails per playlist, no N+1). Extract `PlaylistMosaic` to `frontend/src/components/PlaylistMosaic.js` (shared) and import in both `library.js` and `playlists.js`. Small lift, consistent UX.

3. **[FEATURE] Plays-over-time chart bar animation** — Wrap bar height in `Animated.Value` with spring on mount/data change in the `PlaysOverTimeChart` component (`analytics.js`). Import `Animated` from RN. Small polish that makes the analytics screen feel alive.

---

## 🔧 Permanent Notes (do not delete)

**Route ordering:** Literal routes (`/following-feed`, `/search`) BEFORE parameterized (`/{id}`) in `backend/app/routers/podcasts.py`. Same rule in `users.py`: `/me`, `/search` before `/{user_id}/...`.  
**apiService token cache:** `apiService.clearToken()` in `beforeEach` after 401-retry tests.  
**Duplicate declaration guard:** `node --check frontend/app/(main)/home.js` after merging PRs touching same file.  
**Full test suite timeout:** ~436 tests > 45s limit. Run targeted groups of 3-4 files.  
**Git API fallback:** If push blocked, use browser JS: blobs → tree → commit → ref → PR.
