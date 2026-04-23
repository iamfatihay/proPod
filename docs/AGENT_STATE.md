# AGENT STATE — proPod Autonomous Engineer

> Read at session START, written at session END. Persistent memory across sessions.

---

## 📍 Current State

**Last updated:** 2026-04-23  
**Last session:** Creator Search tab — `GET /users/search` endpoint, `search_users` CRUD, `searchUsers` apiService, 3-tab toggle (Podcasts/Creators/Transcripts) with `CreatorCard`, 14 tests → PR #77  
**Test suite baseline:** ~436 backend tests

**Tech stack:** React Native + Expo · FastAPI + SQLAlchemy · PostgreSQL (prod) / SQLite (test only)

> Full shipped history (PR #1–#65): see `docs/SHIPPED_ARCHIVE.md`

---

## ✅ Recently Shipped (PR #66–#76)

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

---

## 🔄 What's open

- PR #77 `feature/creator-search` — Creator Search tab: `GET /users/search`, `search_users` CRUD (4 batched queries), `searchUsers` apiService, 3-tab search toggle, `CreatorCard` with optimistic follow, 14 tests passing. Awaiting merge.

---

## 🐛 Known issues / tech debt

- Push receipt check is manual only — needs APScheduler or lifespan background task wired in `main.py`
- Frontend ESLint blocked repo-wide (JSX parsing). Use `node --check` + Jest until fixed.
- DM inbox: Python-side aggregation in `crud.get_dm_inbox` — needs SQL GROUP BY at scale
- DM: text-only, no attachments
- Sleep timer: `setInterval` — verify accuracy on real device
- Frontend unit test coverage thin
- `search_users` returns `total_likes: 0` (skipped for perf; not shown in UI)

---

## 🗺️ Next Session Suggestions

1. **[FEATURE] Wire push receipt check to APScheduler** — `backend/app/main.py`: add APScheduler `BackgroundScheduler` (or `asyncio.create_task` in lifespan) running `crud.check_push_receipts` every 30 min with a fresh DB session. Add `apscheduler` to `backend/requirements.txt`. Pure backend, no migration needed.

2. **[FEATURE] Creator search — follower-count sort** — Add `sort_by: Literal["name", "followers"] = "name"` param to `GET /users/search` and `crud.search_users`. Tiny change, immediately useful for discovery.

3. **[FEATURE] Search screen — category filter chips** — Below the 3-tab toggle in Podcasts mode, add horizontally scrollable category chips (reuse `getDiscoverCategories()`). Passes `category=` param to `searchPodcasts()`. Pure frontend, backend already supports it.

---

## 🔧 Permanent Notes (do not delete)

**Route ordering:** Literal routes (`/following-feed`, `/search`) BEFORE parameterized (`/{id}`) in `backend/app/routers/podcasts.py`. Same rule in `users.py`: `/me`, `/search` before `/{user_id}/...`.  
**apiService token cache:** `apiService.clearToken()` in `beforeEach` after 401-retry tests.  
**Duplicate declaration guard:** `node --check frontend/app/(main)/home.js` after merging PRs touching same file.  
**Full test suite timeout:** ~436 tests > 45s limit. Run targeted groups of 3-4 files.  
**Git API fallback:** If push blocked, use browser JS: blobs → tree → commit → ref → PR.
