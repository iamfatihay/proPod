# AGENT STATE — proPod Autonomous Engineer

> **This file is read at the START and written at the END of every automated session.**
> It is the agent's persistent memory across sessions. Do not delete it.

---

## 🎯 Product Vision

**proPod** is a cross-platform (iOS + Android) mobile application for creating, broadcasting, and editing podcasts — with AI assistance. The primary users are podcast creators and listeners. The app must work smoothly on real devices, feel polished, and support the full creator workflow: record → edit → publish → share → live broadcast.

Tech stack: React Native + Expo (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL (runtime/dev/prod) · SQLite only for isolated test scenarios

---

## 📍 Current Project State

**Last updated:** 2026-04-12
**Last session (PR #53):** Reconciled stale AGENT_STATE (PRs #50 sleep-timer and #51 follow-creator were already merged by Fay). Implemented "End of Episode" sleep timer option (PR #53). Added `sleepOnEpisodeEnd` flag to useAudioStore, intercept in `onPlaybackStatusUpdate`, new button in SleepTimerModal, active indicator in ModernAudioPlayer. 12 Jest tests passing. Then addressed Copilot review comments: replaced silent pause() try/catch with `get().pause()`, fixed `COLORS.surface` fallback to literal `"#fff"`, renamed `audioUrl` → `uri` in test fixtures.
**Last session (PR #54):** Implemented Following Feed (PR #54). Closes the follow UX loop from PR #51: new `GET /podcasts/following-feed` endpoint (single JOIN query, is_active guard, enrich_podcast_with_stats), `FOLLOWING_CATEGORY` pill in home.js, `getFollowingFeed()` in apiService, dedicated empty state. Addressed Copilot review comments: removed extra `)}` JSX crash, trimmed blank lines in router, added is_active join, added `enrich_podcast_with_stats` call. 10 backend tests (10/10 PASS).
**Test suite baseline:** 220 frontend tests (208 + 12 from PR #53). Backend: 10 new tests in test_following_feed.py (10/10 PASS).

### What's shipped (merged to master)
- ✅ Auth (login, register, Google OAuth, forgot/reset password)
- ✅ Podcast CRUD (create, edit, delete, list, search)
- ✅ Audio playback + listening history update
- ✅ Like, bookmark, comments
- ✅ AI transcription/keywords/summary
- ✅ Audio performance optimizations (non-blocking playback)
- ✅ Library screen (my podcasts / liked / bookmarked tabs)
- ✅ Public user profiles backend + frontend screen
- ✅ Creator analytics dashboard backend + frontend screen
- ✅ Continue-listening endpoint + UI widget (ContinueListeningRow)
- ✅ Podcast playlist system — full CRUD backend + frontend screens
- ✅ Discover/categories endpoint + dynamic category filters in home
- ✅ Backend search + thumbnail normalization
- ✅ Bug fixes: comment stats sync, sharing cover_image_url, test isolation
- ✅ Continue Listening seek-to-position (PR #39)
- ✅ loadContinueListening URL normalization + decoupled from main-feed repaint (PR #40)
- ✅ Hotfix: duplicate `loadContinueListening` declaration removed (PR #40 follow-up)
- ✅ Deep link handling `volo://podcast/{id}` with auth-race guard (PR #41)
- ✅ Native Google Sign-In hardened — server-side token validation (PR #42, PR #44)
- ✅ Notifications backend + API wiring (PR #45)
- ✅ Notification badge wired to server unread_count (PR #46)
- ✅ Alembic migrations for `playlists`, `playlist_items`, `notifications` (PR #47)
- ✅ Notification store + API coverage; `markAsReadWithSync` no-op guard fix (PR #48)
- ✅ Navigation wiring, creator inbox/activity flows, NotificationAdmin (PR #49)
- ✅ Playback speed selector modal (6 presets, 9 tests) — PR #52
- ✅ Sleep timer — auto-pause after chosen duration — PR #50
- ✅ Follow/unfollow creator — backend + frontend — PR #51

### What's open / in-progress
- **PR #53**: `feat(player): "End of Episode" sleep timer option` — https://github.com/iamfatihay/proPod/pull/53 — branch `feature/sleep-on-episode-end`
  - `useAudioStore`: `sleepOnEpisodeEnd` flag; `setSleepOnEpisodeEnd(enabled)`; intercepts `didJustFinish` in `onPlaybackStatusUpdate`; `cancelSleepTimer`/`cleanup`/`setSleepTimer` all reset the flag
  - `SleepTimerModal`: "End of episode" button; active highlight; `anyActive` guard
  - `ModernAudioPlayer`: moon icon + "End" label turn red when armed
  - 12 Jest tests + Copilot review comments addressed (pause() reuse, COLORS.surface, uri fix)

- **PR #54**: `feat(feed): Following Feed — personalised podcast feed from followed creators` — https://github.com/iamfatihay/proPod/pull/54 — branch `feature/following-feed`
  - `backend/app/crud.py`: `get_following_feed()` — JOIN query + `is_active` guard + `enrich_podcast_with_stats`
  - `backend/app/routers/podcasts.py`: `GET /podcasts/following-feed` (auth required; before `/{podcast_id}`)
  - `frontend/src/services/api/apiService.js`: `getFollowingFeed({ skip, limit })`
  - `frontend/app/(main)/home.js`: `FOLLOWING_CATEGORY` pill; `load()` branches on "following"; empty state with Discover Creators CTA
  - `backend/tests/test_following_feed.py`: 10 tests (10/10 PASS)
  - Copilot review comments addressed: extra `)}` JSX fix, blank lines, is_active join, enrich call

### Known issues / tech debt
- No real DM/user-to-user messaging backend yet; `chat-details.js` is still a comment-detail surface
- Pre-existing failure: `test_follow.py::TestGetFollowingList` (3 tests) — `ImportError: cannot import name 'models' from 'app.routers'` in `users.py:395`. Fix: remove `from . import models as _models` inside function body; use top-level `models` import already available. Not introduced by any agent session.
- Frontend tests: 220 passing; component-level coverage still thin
- `sleepOnEpisodeEnd` not persisted across app restarts (AsyncStorage)
- Sleep timer uses `setInterval` — verify accuracy on real device

---

## 🗺️ Roadmap Priority (agent perspective)

1. **Merge PR #53 (end-of-episode sleep)** — all review comments addressed; ready
2. **Merge PR #54 (following feed)** — all review comments addressed; ready
3. **Fix pre-existing `TestGetFollowingList` ImportError** — 1-line fix in `users.py:395`
4. **DM/chat backend** — `messages` model + router so `chat-details.js` becomes a true conversation surface
5. **Push notifications (APNs/FCM)** — out-of-app delivery for likes/comments

---

## 🔧 Permanent Agent Notes (Do Not Delete)

### GitHub API Access — Sandbox Constraint

**The terminal sandbox proxy blocks all outbound HTTPS to `api.github.com`.**
Do not rely on terminal REST calls to GitHub. `git` commands still work.

Use `mcp__Claude_in_Chrome__javascript_tool` with `fetch()` after navigating to github.com.

### Merge safety rule

When multiple PRs touch the same file, always check for duplicate declarations after merging:
```bash
grep -n "const funcName" frontend/app/(main)/home.js
```
A `const` redeclaration in the same scope = SyntaxError crash. Fix immediately on master.

### apiService token cache

`ApiService` keeps an in-memory `this.token` cache. In tests, after the 401-retry test, subsequent tests see a stale token. Fix: call `apiService.clearToken()` in `beforeEach` in any new `describe` block.

### Route ordering in podcasts router

Literal-path routes (`/following-feed`, `/search`, `/discover/categories`) MUST be declared BEFORE parameterized routes (`/{podcast_id}`) in `backend/app/routers/podcasts.py`. FastAPI matches in definition order; a parameterized int route returns 422 (not 404) for non-integer segments, blocking subsequent literal routes.

---

## 🧠 Agent Instructions: How to Use This File

### At session START
1. Read this file completely before doing anything else
2. Check "What's open / in-progress"
3. Run `git log --oneline -10` and `git ls-remote origin "refs/heads/feature/*"` to catch outside changes
4. After multiple PR merges: check master for duplicate declarations in heavily-edited files

### At session END
Update: Last updated · What's shipped · What's open · Known issues · Next session suggestions

---

## 💡 Next Session Suggestions

*(Ranked by user-facing impact — pick #1 unless blocked)*

1. **[FIX] Pre-existing `TestGetFollowingList` ImportError** — In `backend/app/routers/users.py` around line 395, remove `from . import models as _models` inside the `get_my_following` function body; replace `_models.*` with the top-level `models.*`. Fixes 3 failing tests. Zero risk.

2. **[FEATURE] DM / direct messaging backend** — `DirectMessage` model in `backend/app/models.py`, new `backend/app/routers/messages.py` (POST/GET), Alembic migration. Transforms `chat-details.js` from a comment-detail view into a real conversation surface. High social-layer impact.

3. **[FEATURE] Persist `sleepOnEpisodeEnd` across restarts** — `AsyncStorage` read/write in `frontend/src/context/useAudioStore.js` only. Companion polish to the sleep timer shipped in PR #50/#53.
