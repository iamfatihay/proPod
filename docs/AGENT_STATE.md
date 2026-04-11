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
**Last session:** Reconciled stale AGENT_STATE (PRs #50 sleep-timer and #51 follow-creator were already merged by Fay). Implemented new feature: "End of Episode" sleep timer option (PR #53). Added `sleepOnEpisodeEnd` flag to useAudioStore with mutual exclusion against time-based timer, intercept in `onPlaybackStatusUpdate`, new button in SleepTimerModal, active indicator in ModernAudioPlayer. 12 Jest tests passing, 21 existing sleep timer tests unaffected.
**Test suite baseline:** 220 frontend tests (208 + 12 new). Validations: `npx jest src/context/__tests__/useAudioStore.sleepOnEpisodeEnd.test.js --runInBand` (12/12 PASS), `npx jest src/context/__tests__/useAudioStore.sleepTimer.test.js --runInBand` (21/21 PASS).

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

### Known issues / tech debt
- No real DM/user-to-user messaging backend yet; `chat-details.js` is still a comment-detail surface
- Full backend suite is green (334 passed)
- Frontend tests: 220 passing (jest suite verified); component-level coverage still thin
- Several old feature branches on remote are likely abandoned (pre-PR #39 era)
- Sleep timer relies on `setInterval` — should smoke-test on device to verify accuracy and no battery drain
- "End of episode" mode (`sleepOnEpisodeEnd`) not yet persisted across app restarts

---

## 🗺️ Roadmap Priority (agent perspective)

1. **Merge PR #53 (end-of-episode sleep)** — 12 tests passing, no regression; ready to review
2. **DM/chat backend** — real `messages` model + router if product still wants true user-to-user messaging
3. **Push notifications (APNs/FCM)** — out-of-app delivery for likes/comments; high user impact
4. **Phase 1 roadmap features** — AI transcription, content analysis, studio mode (see FEATURE_ROADMAP.md)

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

1. **[MERGE] Land PR #53 (end-of-episode sleep)** — 12 tests passing, no regression. Smoke-test on device: arm "End of episode", let episode finish, verify audio stops and moon icon resets to grey.

2. **[FEATURE] Persist `sleepOnEpisodeEnd` across restarts** — Small AsyncStorage addition in `useAudioStore`: read flag on hydration, write on `setSleepOnEpisodeEnd`. Files: `frontend/src/context/useAudioStore.js` only. Low risk, high polish.

3. **[FEATURE] DM / direct messaging backend** — Real `messages` model + POST/GET router so `chat-details.js` can become a true conversation surface. Files: `backend/app/models/message.py` (new), `backend/app/routers/messages.py` (new), Alembic migration. High user impact for the social layer.
