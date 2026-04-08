# AGENT STATE — proPod Autonomous Engineer

> **This file is read at the START and written at the END of every automated session.**
> It is the agent's persistent memory across sessions. Do not delete it.

---

## 🎯 Product Vision

**proPod** is a cross-platform (iOS + Android) mobile application for creating, broadcasting, and editing podcasts — with AI assistance. The primary users are podcast creators and listeners. The app must work smoothly on real devices, feel polished, and support the full creator workflow: record → edit → publish → share → live broadcast.

Tech stack: React Native + Expo (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL (prod) / SQLite (dev/test)

---

## 📍 Current Project State

**Last updated:** 2026-04-08
**Last session:** Built and wired real notifications: backend model + CRUD + REST endpoints + 14 tests + frontend API methods + store fetch/sync + screen mount-time fetch. PR #45 opened.
**Test suite baseline:** 334 backend tests — all passing (0 failures). Full suite run confirmed this session.

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

### What's open / in-progress
- **PR #45**: `feat: notifications backend + API wiring` — https://github.com/iamfatihay/proPod/pull/45
  - `Notification` model (user_id, actor_id, podcast_id, type, title, message, read, created_at)
  - Auto-created on like/comment (skips self-events; failure-safe via `_safe_create_notification`)
  - REST: `GET /notifications/`, `PATCH /notifications/{id}/read`, `POST /notifications/mark-all-read`
  - Frontend: `apiService` methods + store `fetchNotifications`/`markAsReadWithSync`/`markAllAsReadWithSync`
  - Screen fetches on mount and pull-to-refresh; tapping a notification navigates to podcast detail

### Known issues / tech debt
- No Alembic migration for `notifications` table (or Playlist tables) — dev uses `create_all`, prod needs migration before deploy
- Frontend has very few automated tests (backend well-covered at 334 tests)
- Notification tab bar badge count not yet wired (badge shows local unread count but doesn't reflect server state until first mount)
- Chat screen still uses dummy/mock data — no backend for it yet
- Several old feature branches still exist on remote and likely abandoned — audit if needed

---

## 🗺️ Roadmap Priority (agent perspective)

1. **Alembic migrations** — add migration for `notifications` + `playlists` tables so prod deployment is safe
2. **Notification tab badge** — wire unread count from server to the tab bar icon badge
3. **Frontend tests** — coverage is thin; add service-level tests for notificationsService / apiService methods
4. **Chat screen** — replace dummy data with a real backend (or decide to scope it out)
5. **Push notifications** — APNs/FCM integration for out-of-app delivery of like/comment events

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

1. **[BACKEND] Add Alembic migrations for `notifications` + `playlists` tables** — required before any production deployment. Files: `backend/alembic/` (create if absent). This unblocks safe prod deploys.

2. **[FRONTEND] Wire notification badge count to server unread_count** — after PR #45 merges, call `fetchNotifications` in the app's root layout (`frontend/app/_layout.js`) on auth state change so the tab bar badge reflects real server state immediately on login.

3. **[FRONTEND] Add unit tests for `apiService` notification methods** — `frontend/src/services/api/__tests__/` already exists; add `notificationsApi.test.js` covering `getNotifications`, `markNotificationRead`, `markAllNotificationsRead` with mocked fetch.
