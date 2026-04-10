# AGENT STATE — proPod Autonomous Engineer

> **This file is read at the START and written at the END of every automated session.**
> It is the agent's persistent memory across sessions. Do not delete it.

---

## 🎯 Product Vision

**proPod** is a cross-platform (iOS + Android) mobile application for creating, broadcasting, and editing podcasts — with AI assistance. The primary users are podcast creators and listeners. The app must work smoothly on real devices, feel polished, and support the full creator workflow: record → edit → publish → share → live broadcast.

Tech stack: React Native + Expo (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL (runtime/dev/prod) · SQLite only for isolated test scenarios

---

## 📍 Current Project State

**Last updated:** 2026-04-10
**Last session:** Reconciled state — PR #49 already merged by Fay; full backend suite green (**334 passed**); sharing regression resolved. Added **21 Jest tests** for the sleep timer store logic (`useAudioStore.sleepTimer.test.js`) covering `setSleepTimer`, `cancelSleepTimer`, timer expiry (auto-pause), cleanup, and edge cases. Pushed to `feature/sleep-timer` (PR #50) and updated PR description. Frontend suite: **208 passed, 0 failed** (↑ from 185 baseline; +21 sleep timer tests + 2 from prior sessions).
**Test suite baseline:** Backend: 334 passed (full suite, SQLite). Frontend: 208 passed (Jest, node_modules installed in sandbox this session).

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

### What's open / in-progress
- **PR #50**: `feat(player): sleep timer — auto-pause after chosen duration` — https://github.com/iamfatihay/proPod/pull/50 — branch `feature/sleep-timer`
  - `useAudioStore`: `sleepTimerActive`, `sleepTimerEndTime`, `sleepTimerRemaining` state; `setSleepTimer(minutes)` / `cancelSleepTimer()` actions; cleanup cancels any running timer
  - `SleepTimerModal`: new bottom-sheet with 5/10/15/30/45/60 min presets, live countdown, Cancel Timer button
  - `ModernAudioPlayer`: moon-crescent icon in secondary controls; red tint + remaining minutes when active; opens modal on tap
  - `useAudioStore.sleepTimer.test.js`: **21 Jest tests** — state, countdown, expiry, edge cases, cleanup (added this session)

### Known issues / tech debt
- No real DM/user-to-user messaging backend yet; `messages.js` shows real comment inbox data, but `chat-details.js` is still a comment-detail surface rather than a true chat thread
- Full backend suite is now green (334 passed) — the sharing test failure is resolved
- Frontend tests: 208 passing (jest suite now verified in sandbox); component-level coverage still thin — component tests are excluded from the default jest run via `testPathIgnorePatterns`
- Several old feature branches on remote are likely abandoned (pre-PR #39 era)
- Sleep timer relies on `setInterval` — should smoke-test on device to verify accuracy and no battery drain

---

## 🗺️ Roadmap Priority (agent perspective)

1. **Review and merge PR #50** — sleep timer is low-risk, pure-frontend, and immediately useful
2. **DM/chat backend** — real `messages` model + router if product still wants true user-to-user messaging
3. **Push notifications (APNs/FCM)** — out-of-app delivery for likes/comments; high user impact
4. **Frontend component tests** — PodcastCard, NotificationsScreen, SleepTimerModal interactions
5. **Playback: "End of episode" sleep option** — natural follow-up to sleep timer; stop when track ends

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

1. **[REVIEW] Land PR #50 (sleep timer)** — Smoke-test on device: set a 1-min timer, verify audio stops, verify countdown updates in the player UI, verify Cancel Timer works. Merge if clean. The store logic now has 21 passing Jest tests for confidence. Focus on `ModernAudioPlayer` secondary controls and `SleepTimerModal`.

2. **[FEATURE] "End of episode" sleep option** — Extend `SleepTimerModal` with a special "End of episode" option that stops playback when the current track reaches its end (check `sleepOnEpisodeEnd` flag in `onPlaybackStatusUpdate`). Files: `useAudioStore.js` + `SleepTimerModal.js`. This is a natural follow-up and very low risk.

3. **[FRONTEND+BACKEND] Real DM / chat backend** — Design a `messages` table (sender_id, recipient_id, body, created_at) and REST router (`/messages`), then wire `chat-details.js` to it instead of the comment-detail surface. Start with the backend model + two endpoints: `POST /messages` and `GET /messages/thread/{user_id}`.
