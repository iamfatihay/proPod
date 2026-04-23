# AGENT STATE — proPod Autonomous Engineer

> Read at session START, written at session END. Persistent memory across sessions.

---

## 📍 Current State

**Last updated:** 2026-04-23  
**Last session:** Creator search sort-by-followers — Name/Followers pill toggle in Creators tab, `sort_by` param in crud/router, 6 new tests → PR #79  
**Test suite baseline:** ~436 backend tests

**Tech stack:** React Native + Expo · FastAPI + SQLAlchemy · PostgreSQL (prod) / SQLite (test only)

> Full shipped history (PR #1–#65): see `docs/SHIPPED_ARCHIVE.md`

---

## ✅ Recently Shipped (PR #66–#78)

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
- ✅ Category filter chips in Search screen — horizontally scrollable chips, `category=` param, active-filter label + Clear (PR #78)

---

## 🔄 What's open

- PR #79 `feature/creator-search-sort-by` — Name / Followers pill toggle in Creators tab. `sort_by` param added to `crud.search_users` (Python-side sort after stat aggregation), router (pattern-validated), `apiService.searchUsers`, and `search.js` state. 6 new tests; 21/21 pass. Awaiting merge.

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

---

## 🗺️ Next Session Suggestions

1. **[FEATURE] Wire push receipt check to APScheduler** — `backend/app/main.py`: add APScheduler `BackgroundScheduler` (or `asyncio.create_task` in lifespan) running `crud.check_push_receipts` every 30 min with a fresh DB session. Add `apscheduler` to `backend/requirements.txt`. Pure backend, no migration needed. High reliability value.

2. **[FEATURE] Empty-state category browse** — When the Search screen opens (no query yet) and `searchMode === "all"`, show a 2-column grid of category cards instead of the empty "Search Podcasts" prompt. Tapping a category pre-fills the chips filter and calls `searchPodcasts("", {category})`. Turns the idle search screen into a discovery surface.

3. **[FEATURE] Creator profile follower list** — Add `GET /users/{user_id}/followers` endpoint (paged, reuse `UserFollow` model) and a "X Followers" tappable link on the creator profile screen that opens a bottom sheet list of followers. Surfaces social proof and encourages follows.

---

## 🔧 Permanent Notes (do not delete)

**Route ordering:** Literal routes (`/following-feed`, `/search`) BEFORE parameterized (`/{id}`) in `backend/app/routers/podcasts.py`. Same rule in `users.py`: `/me`, `/search` before `/{user_id}/...`.  
**apiService token cache:** `apiService.clearToken()` in `beforeEach` after 401-retry tests.  
**Duplicate declaration guard:** `node --check frontend/app/(main)/home.js` after merging PRs touching same file.  
**Full test suite timeout:** ~436 tests > 45s limit. Run targeted groups of 3-4 files.  
**Git API fallback:** If push blocked, use browser JS: blobs → tree → commit → ref → PR.
