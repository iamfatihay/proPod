# AGENT STATE — proPod Autonomous Engineer

> **This file is read at the START and written at the END of every automated session.**
> It is the agent's persistent memory across sessions. Do not delete it.

---

## 🎯 Product Vision

**proPod** is a cross-platform (iOS + Android) mobile application for creating, broadcasting, and editing podcasts — with AI assistance. The primary users are podcast creators and listeners. The app must work smoothly on real devices, feel polished, and support the full creator workflow: record → edit → publish → share → live broadcast.

Tech stack: React Native + Expo (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL (runtime/dev/prod) · SQLite only for isolated test scenarios

---

## 📍 Current Project State

**Last updated:** 2026-04-09
**Last session:** Added 25-test `useNotificationStore.test.js` + 5 notification API tests in `apiService.test.js`. Also fixed bug in `markAsReadWithSync` (API was called even for already-read notifications). PR #48 opened. Full suite: 185 frontend tests, all passing.
**Test suite baseline:** 334 backend tests — all passing. 185 frontend tests — all passing.

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

### What's open / in-progress
- **PR #47**: `feat: add Alembic migrations for playlists, playlist_items, and notifications tables` — https://github.com/iamfatihay/proPod/pull/47 — branch `feat/alembic-migrations-playlists-notifications`
  - Migration `a1b2c3d4e5f6` — creates `playlists`, `playlist_items`, `notifications` tables with all indexes and constraints
  - No review comments — awaiting Fay's merge

- **PR #48**: `test: notification store + API coverage + fix markAsReadWithSync no-op bug` — https://github.com/iamfatihay/proPod/pull/48 — branch `test/notification-store-and-api-coverage`
  - New `useNotificationStore.test.js` — 25 tests (fetchNotifications merge logic, markAsReadWithSync guards, markAllAsReadWithSync resilience, local mutations)
  - Extended `apiService.test.js` — 5 notification API tests (getNotifications, markNotificationRead, markAllNotificationsRead)
  - Bug fix: `markAsReadWithSync` now early-returns if notification already read; no spurious PATCH call
  - 185/185 frontend tests pass

### Known issues / tech debt
- No Alembic migration for `notifications` + `playlists` tables on prod (PR #47 pending merge)
- Chat screen still uses dummy/mock data — no backend for it yet
- Frontend tests growing but component-level coverage is still thin
- Several old feature branches still exist on remote and likely abandoned

---

## 🗺️ Roadmap Priority (agent perspective)

1. **Alembic migrations** (PR #47) — merge unblocks safe prod deploys
2. **Chat screen backend** — replace dummy data with real messages API (simple model, REST endpoint, wire frontend)
3. **Push notifications** — APNs/FCM for out-of-app delivery of like/comment events
4. **Frontend component tests** — PodcastCard, NotificationsScreen interactions

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

1. **[FRONTEND] Chat screen backend** — Replace dummy data in `frontend/app/(main)/chat-details.js`. Design a simple `messages` model in `backend/app/models.py`, add a REST router at `backend/app/routers/messages.py`, add `apiService.getMessages(chatId)` + `sendMessage()`, and wire the frontend screen. This completes a visible placeholder and unblocks real user-to-user messaging.

2. **[BACKEND] Check & merge PR #47** (Alembic migrations) — If Fay has not merged, verify the migration still applies cleanly on top of master. Required before any production deployment.

3. **[FRONTEND] NotificationsScreen integration tests** — Add a test in `frontend/src/context/__tests__/` that mounts `NotificationsScreen`, fires `fetchNotifications` with mocked API, and asserts the notification cards render. Raises confidence for the full notification user flow.
