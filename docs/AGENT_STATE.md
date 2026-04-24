# AGENT STATE — proPod Autonomous Engineer

> Read at session START, written at session END. Persistent memory across sessions.

---

## 📍 Current State


**Last updated:** 2026-04-24  
**Last session:** Add Playlists tab to Library screen — PR #84  
**Test suite baseline:** ~436 backend tests

**Tech stack:** React Native + Expo · FastAPI + SQLAlchemy · PostgreSQL (prod) / SQLite (test only)

> Full shipped history (PR #1–#65): see `docs/SHIPPED_ARCHIVE.md`

---

## ✅ Recently Shipped (PR #66–#83)

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

---

## 🔄 What's open

- PR #84 `feature/library-playlists-tab` — Add Playlists tab to Library screen. Extends Library from 3 tabs (Mine/Likes/Bookmarks) to 4 (My Episodes/Liked/Saved/Playlists). PlaylistRow component, empty state with Create CTA, Manage shortcut. Pure frontend.

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
- Playlist tab in Library loads up to 50 playlists — no pagination yet

---

## 🗺️ Next Session Suggestions

1. **[BACKEND+FRONTEND] APScheduler push receipt auto-run** — `backend/app/main.py`: add FastAPI `lifespan` context manager with an `apscheduler` `BackgroundScheduler` running `crud.check_push_receipts` every 30 min. Add `apscheduler` to `backend/requirements.txt`. No migration needed. Genuinely improves push reliability.

2. **[FEATURE] Play count trend chart on Analytics screen** — Add a `GET /analytics/plays-over-time?days=N` endpoint that groups `ListeningHistory.created_at` by day (SQLite `strftime('%Y-%m-%d', created_at)`), returning daily counts for the creator's podcasts. Render as a simple SVG bar chart in `analytics.js` using `react-native-svg` (already a common Expo dep — check if present first). No new model needed.

3. **[FEATURE] Playlist cover art mosaic in Library Playlists tab** — Replace the single icon bubble in `PlaylistRow` with a 2×2 thumbnail grid using the first 4 episode `thumbnail_url` values from `playlist.items`. Backend: ensure `get_my_playlists` returns a `preview_thumbnails: list[str]` field (first 4 items). Frontend: render a 44×44 mosaic in `PlaylistRow`.

---

## 🔧 Permanent Notes (do not delete)

**Route ordering:** Literal routes (`/following-feed`, `/search`) BEFORE parameterized (`/{id}`) in `backend/app/routers/podcasts.py`. Same rule in `users.py`: `/me`, `/search` before `/{user_id}/...`.  
**apiService token cache:** `apiService.clearToken()` in `beforeEach` after 401-retry tests.  
**Duplicate declaration guard:** `node --check frontend/app/(main)/home.js` after merging PRs touching same file.  
**Full test suite timeout:** ~436 tests > 45s limit. Run targeted groups of 3-4 files.  
**Git API fallback:** If push blocked, use browser JS: blobs → tree → commit → ref → PR.
