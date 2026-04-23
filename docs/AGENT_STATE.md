# AGENT STATE — proPod Autonomous Engineer

> Read at session START, written at session END. Persistent memory across sessions.

---

## 📍 Current State

**Last updated:** 2026-04-23  
**Last session:** Expo push receipt polling — PushTicket model, Alembic migration, `_send_expo_push` stores ok-tickets, `check_push_receipts()` CRUD, `POST /admin/push-receipts/check` admin endpoint, 15 new tests → PR #76  
**Test suite baseline:** ~436 backend tests

**Tech stack:** React Native + Expo · FastAPI + SQLAlchemy · PostgreSQL (prod) / SQLite (test only)

> Full shipped history (PR #1–#65): see `docs/SHIPPED_ARCHIVE.md`

---

## ✅ Recently Shipped (PR #66–#75)

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

---

## 🔄 What's open

- PR #76 `feature/expo-push-receipt-polling` — Expo push receipt polling: PushTicket model, migration, `_send_expo_push` stores ok-ticket IDs, `check_push_receipts()`, `POST /admin/push-receipts/check`. 15 tests passing. Awaiting merge.

---

## 🐛 Known issues / tech debt

- Push receipt check is manual only — needs APScheduler or lifespan background task wired in `main.py`
- Frontend ESLint blocked repo-wide (JSX parsing). Use `node --check` + Jest until fixed.
- DM inbox: Python-side aggregation in `crud.get_dm_inbox` — needs SQL GROUP BY at scale
- DM: text-only, no attachments
- Sleep timer: `setInterval` — verify accuracy on real device
- Frontend unit test coverage thin

---

## 🗺️ Next Session Suggestions

1. **[FEATURE] Wire push receipt check to APScheduler** — `backend/app/main.py`: add APScheduler `BackgroundScheduler` (or `asyncio.create_task` in lifespan) running `crud.check_push_receipts` every 30 min with a fresh DB session. Add `apscheduler` to `backend/requirements.txt`. Pure backend, no migration.

2. **[FEATURE] Search screen debounce + auto-search** — `frontend/app/(main)/search.js`: add 400ms debounce on `onChangeText` so search fires automatically. Add skeleton loading state while `isSearching=true`. Pure frontend.

3. **[FEATURE] Creator search tab** — Add "Creators" toggle in `frontend/app/(main)/search.js`. Wire to `GET /users/search?q=` (check if exists; if not, add to `backend/app/routers/users.py` with `ilike` on name). Show user-card list with Follow button.

---

## 🔧 Permanent Notes (do not delete)

**Route ordering:** Literal routes (`/following-feed`, `/search`) BEFORE parameterized (`/{id}`) in `backend/app/routers/podcasts.py`.  
**apiService token cache:** `apiService.clearToken()` in `beforeEach` after 401-retry tests.  
**Duplicate declaration guard:** `node --check frontend/app/(main)/home.js` after merging PRs touching same file.  
**Full test suite timeout:** ~436 tests > 45s limit. Run targeted groups of 3-4 files.  
**Git API fallback:** If push blocked, use browser JS: blobs → tree → commit → ref → PR.
