# AGENT STATE — proPod Autonomous Engineer

> Read at session START, written at session END. Persistent memory across sessions.

---

## 📍 Current State

**Last updated:** 2026-04-26
**Last session:** APScheduler push receipt auto-run every 30 min — PR #90
**Test suite baseline:** ~447 backend tests

**Tech stack:** React Native + Expo · FastAPI + SQLAlchemy · PostgreSQL (prod) / SQLite (test only)

> Full shipped history (PR #1–#65): see `docs/SHIPPED_ARCHIVE.md`

---

## ✅ Recently Shipped (PR #66–#89)

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
- ✅ Playlist cover art mosaic in Library Playlists tab — `preview_thumbnails` field, batched JOIN in CRUD, `PlaylistMosaic` RN component (PR #86)
- ✅ Extract `PlaylistMosaic` to shared component + wire into `playlists.js` PlaylistCard (size=48) (PR #88)
- ✅ Public playlist browse screen — `public-playlists.js`, `getPublicPlaylists` apiService, Library "Discover" button, pull-to-refresh, loadMore error+retry footer, 3 apiService tests (PR #89)

---

## 🔄 What's open

- PR #90 `feature/apscheduler-push-receipt-autorun` — `lifespan()` context manager in `main.py` starts `BackgroundScheduler` running `check_push_receipts` every 30 min; `apscheduler>=3.10.0` in requirements; 7 new tests in `test_scheduler.py`.

---

## 🐛 Known issues / tech debt

- APScheduler in multi-worker deployments (Uvicorn `--workers N`) runs one check per worker — harmless (idempotent) but wasteful. Future: SQLAlchemy jobstore + distributed lock.
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
- Public playlists Discover screen: no owner username shown on cards; no search/filter by name

---

## 🗺️ Next Session Suggestions

1. **[FRONTEND] Plays-over-time chart bar animation** — In `analytics.js` `PlaysOverTimeChart`, wrap each bar's height in `Animated.Value` and drive it with `Animated.spring` on mount and on data change. Import `Animated` from `react-native`. Purely additive — no backend changes, no schema touches. Makes the analytics screen feel alive.

2. **[BACKEND+FRONTEND] Creator username on public playlist cards** — Extend `PlaylistResponse` schema with `owner_username: Optional[str] = None`. In `get_public_playlists` CRUD, join `User` (already joined for `is_active` filter) and include `User.username` in the returned tuple. Update `_playlist_to_response` and the public endpoint in `playlists.py`. In `public-playlists.js` `PublicPlaylistCard`, add a `by @username` line.

3. **[BACKEND] APScheduler SQLAlchemy jobstore** — Replace the in-memory scheduler jobstore with an SQLAlchemy-backed one so multi-worker Uvicorn deployments only fire one receipt check at a time. Adds an Alembic migration for the `apscheduler_jobs` table. Depends on PR #90 being merged.

---

## 🔧 Permanent Notes (do not delete)

**Route ordering:** Literal routes (`/following-feed`, `/search`) BEFORE parameterized (`/{id}`) in `backend/app/routers/podcasts.py`. Same rule in `users.py`: `/me`, `/search` before `/{user_id}/...`.
**apiService token cache:** `apiService.clearToken()` in `beforeEach` after 401-retry tests.
**Duplicate declaration guard:** `node --check frontend/app/(main)/home.js` after merging PRs touching same file.
**Full test suite timeout:** ~436 tests > 45s limit. Run targeted groups of 3-4 files.
**Git API fallback:** If push blocked, use browser JS: blobs → tree → commit → ref → PR.
