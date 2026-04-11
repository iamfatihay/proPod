# AGENT STATE — proPod Autonomous Engineer

> **This file is read at the START and written at the END of every automated session.**
> It is the agent's persistent memory across sessions. Do not delete it.

---

## 🎯 Product Vision

**proPod** is a cross-platform (iOS + Android) mobile application for creating, broadcasting, and editing podcasts — with AI assistance. The primary users are podcast creators and listeners. The app must work smoothly on real devices, feel polished, and support the full creator workflow: record → edit → publish → share → live broadcast.

Tech stack: React Native + Expo (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL (runtime/dev/prod) · SQLite only for isolated test scenarios

---

## 📍 Current Project State

**Last updated:** 2026-04-11
**Last session:** Reconciled stale AGENT_STATE (PRs #50, #51, #52 all already merged by Fay; PR #53 end-of-episode sleep is open). Implemented new feature: Following Feed (PR #54). Added `GET /podcasts/following-feed` backend endpoint (single JOIN query, newest-first, paginated), `FOLLOWING_CATEGORY` pill in home.js, `getFollowingFeed()` in apiService, dedicated empty state with Discover Creators CTA. 10 backend tests, all passing.
**Test suite baseline:** 220 frontend tests (208 + 12 from PR #53). Backend: 10 new tests in test_following_feed.py (10/10 PASS). Pre-existing failure: `test_follow.py::TestGetFollowingList` (3 tests) — ImportError in users.py:395, unrelated to any agent session.

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
- ✅ Continue Listening seek-to-position — `play(track, { startPosition })` in audio store (PR #39)
- ✅ loadContinueListening URL normalization + decoupled from main-feed repaint (PR #40)
- ✅ Hotfix: duplicate `loadContinueListening` declaration removed (SyntaxError from merging #32 + #40)
- ✅ Deep link handling `volo://podcast/{id}` with auth-race guard (PR #41, merged by Fay)
- ✅ Native Google Sign-In hardened — server-side token validation + stale-test fix (PR #42, PR #44, merged by Fay)
- ✅ Notifications backend + API wiring — model, CRUD, REST endpoints, frontend store + screen (PR #45, merged by Fay)
- ✅ Notification badge wired to server unread_count — `fetchNotifications` on mount + AppState foreground refresh (PR #46, merged by Fay)
- ✅ Alembic migrations for `playlists`, `playlist_items`, and `notifications` tables (PR #47, merged by Fay)
- ✅ Notification store + API coverage; `markAsReadWithSync` no-op guard fix (PR #48, merged by Fay)
- ✅ Navigation wiring, creator inbox/activity flows, secondary-screen header consistency, NotificationAdmin (PR #49, merged by Fay)
- ✅ Playback speed selector modal (6 presets, 9 tests) — PlaybackSpeedModal integrated into ModernAudioPlayer (PR #52, merged by Fay)
- ✅ Sleep timer — auto-pause after chosen duration (PR #50, merged by Fay)
- ✅ Follow/unfollow creator — backend + frontend (PR #51, merged by Fay)

### What's open / in-progress
- **PR #53**: `feat(player): "End of Episode" sleep timer option` — https://github.com/iamfatihay/proPod/pull/53 — branch `feature/sleep-on-episode-end`
  - `useAudioStore`: new `sleepOnEpisodeEnd` state flag; `setSleepOnEpisodeEnd(enabled)` action; intercepts `didJustFinish` / tolerance-threshold in `onPlaybackStatusUpdate` to pause + clear flag instead of advancing; `cancelSleepTimer`, `cleanup`, and `setSleepTimer` all reset the flag
  - `SleepTimerModal`: "End of episode" full-width button below presets; active highlight (primary background); `anyActive` guard for Cancel Timer vs Dismiss
  - `ModernAudioPlayer`: subscribes to `sleepOnEpisodeEnd`; moon icon + "End" label turn red when armed
  - 12 Jest tests — all state transitions, mutual exclusion, episode-end interception, no-op guard
  - No review comments — ready to merge

- **PR #54**: `feat(feed): Following Feed — personalised podcast feed from followed creators` — https://github.com/iamfatihay/proPod/pull/54 — branch `feature/following-feed`
  - `backend/app/crud.py`: `get_following_feed()` — single JOIN (UserFollow → Podcast), public + non-deleted, newest-first, skip/limit paginated
  - `backend/app/routers/podcasts.py`: `GET /podcasts/following-feed` (auth required); placed before `/{podcast_id}` route to avoid shadowing
  - `frontend/src/services/api/apiService.js`: `getFollowingFeed({ skip, limit })`
  - `frontend/app/(main)/home.js`: `FOLLOWING_CATEGORY` pill after "All"; `load()` branches on `selectedCategory === "following"`; dedicated empty state with Discover Creators CTA
  - `backend/tests/test_following_feed.py`: 10 tests (10/10 PASS)

### Known issues / tech debt
- No real DM/user-to-user messaging backend yet; `chat-details.js` is still a comment-detail surface
- Full backend suite is green (334+ passed); pre-existing `TestGetFollowingList` ImportError (3 tests) in `users.py:395` — `from . import models as _models` inside function body; not introduced by agent
- Frontend tests: 220 passing (jest suite verified); component-level coverage still thin
- Several old feature branches on remote are likely abandoned (pre-PR #39 era)
- Sleep timer relies on `setInterval` — should smoke-test on device to verify accuracy and no battery drain
- "End of episode" mode (`sleepOnEpisodeEnd`) not yet persisted across app restarts

---

## 🗺️ Roadmap Priority (agent perspective)

1. **Merge PR #53 (end-of-episode sleep)** — 12 tests passing, no review comments; ready
2. **Merge PR #54 (following feed)** — 10 tests passing, no review comments; ready
3. **Fix pre-existing `TestGetFollowingList` ImportError** — 1-line fix in `users.py:395`: remove `from . import models as _models`, use `models` already imported at top of file
4. **DM/chat backend** — real `messages` model + router so `chat-details.js` becomes a true conversation surface
5. **Push notifications (APNs/FCM)** — out-of-app delivery for likes/comments; high user impact

---

## 🔧 Permanent Agent Notes (Do Not Delete)

### GitHub API Access — Sandbox Constraint

**The terminal sandbox proxy blocks all outbound HTTPS to `api.github.com`.**
Do not rely on terminal REST calls to GitHub. `git` commands still work.

Use `mcp__Claude_in_Chrome__javascript_tool` with `fetch()` after navigating to github.com.

If browser tooling is unavailable, push the branch and document the manual PR URL.

### Merge safety rule

When multiple PRs touch the same file, always check for duplicate declarations after merging:
```bash
grep -n "const funcName" frontend/app/(main)/home.js
```
A `const` redeclaration in the same scope = SyntaxError crash. Fix immediately on master.

### apiService token cache

`ApiService` keeps an in-memory `this.token` cache. In tests, after the 401-retry test sets a new token, subsequent tests see a stale token. Fix: call `apiService.clearToken()` in a `beforeEach` inside any `describe` block added after the Error Handling section.

### Route ordering in podcasts router

Literal-path routes (e.g. `/following-feed`, `/search`, `/discover/categories`) MUST be declared BEFORE parameterized routes (e.g. `/{podcast_id}`) in `backend/app/routers/podcasts.py`. FastAPI matches routes in definition order; a parameterized route will capture literal paths and return 422 instead of falling through.

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

1. **[FIX] Pre-existing `TestGetFollowingList` ImportError** — One-line fix: in `backend/app/routers/users.py` at the `get_my_following` function, remove the `from . import models as _models` line (around line 395) and replace `_models.UserFollow` / `_models.User` with the already-imported `models.UserFollow` / `models.User`. 3 tests will go from FAILED → PASSED. Very low risk.

2. **[FEATURE] DM / direct messaging backend** — Real `messages` model + POST/GET router so `chat-details.js` can become a true conversation surface. Files: `backend/app/models.py` (new DirectMessage model), `backend/app/routers/messages.py` (new), Alembic migration. High user impact for the social layer.

3. **[FEATURE] Persist `sleepOnEpisodeEnd` across restarts** — Small AsyncStorage addition in `useAudioStore`: read flag on hydration, write on `setSleepOnEpisodeEnd`. Files: `frontend/src/context/useAudioStore.js` only. Low risk, high polish for the sleep timer feature.
