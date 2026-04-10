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
**Last session:** Validated open PRs #50 (sleep timer, 21 tests passing) and #51 (follow creator, complete backend+frontend) for merge readiness. Implemented new feature: Playback Speed Modal (PR #52). Created PlaybackSpeedModal component with 6 presets (0.5x–2.0x), integrated into ModernAudioPlayer replacing inline cycling, added 9 Jest tests covering all speeds and interactions. PR #52 merged by Fay. Review comments on #50, #51, #52 addressed — see fix commits.
**Test suite baseline:** 196 frontend tests (185 + 9 new + 2 existing passing). All validations: `npm test -- src/tests/__tests__/PlaybackSpeedModal.test.js --runInBand` (9/9 PASS), `npm test -- src/context/__tests__/useAudioStore.sleepTimer.test.js --runInBand` (21/21 PASS).

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

### What's open / in-progress
- **PR #50**: `feat(player): sleep timer — auto-pause after chosen duration` — https://github.com/iamfatihay/proPod/pull/50 — branch `feature/sleep-timer`
  - `useAudioStore`: `sleepTimerActive`, `sleepTimerEndTime`, `sleepTimerRemaining` state; `setSleepTimer(minutes)` / `cancelSleepTimer()` actions
  - `SleepTimerModal`: bottom-sheet with 5/10/15/30/45/60 min presets, live countdown, Cancel Timer button
  - `ModernAudioPlayer`: moon-crescent icon in secondary controls; red tint + remaining minutes when active
  - 21 Jest tests — state, countdown, expiry, edge cases, cleanup
  - Review comments addressed: unused imports removed, no-op Pressable → View
  - Conflict with master resolved (both SleepTimerModal + PlaybackSpeedModal now rendered)

- **PR #51**: `feat(social): follow/unfollow creator — backend + frontend` — https://github.com/iamfatihay/proPod/pull/51 — branch `feature/follow-creator`
  - Backend: UserFollow model + Alembic migration, POST/DELETE /users/{id}/follow, GET /users/me/following
  - Frontend: Follow/Following toggle button on creator-profile screen, real follower counts
  - Review comments addressed: real pagination total, N+1 queries fixed (batch queries), order_by added, race condition handled (IntegrityError catch), optimistic rollback on failure

### Known issues / tech debt
- No real DM/user-to-user messaging backend yet; `chat-details.js` is still a comment-detail surface
- Full backend suite is green (334 passed) — sharing test failure was resolved
- Frontend tests: 208 passing (jest suite verified); component-level coverage still thin
- Several old feature branches on remote are likely abandoned (pre-PR #39 era)
- Sleep timer relies on `setInterval` — should smoke-test on device to verify accuracy and no battery drain

---

## 🗺️ Roadmap Priority (agent perspective)

1. **Merge PR #50 (sleep timer)** — conflict with master resolved, review comments addressed; ready to merge
2. **Merge PR #51 (follow creator)** — N+1 / race condition / optimistic rollback all fixed; ready to merge
3. **DM/chat backend** — real `messages` model + router if product still wants true user-to-user messaging
4. **Push notifications (APNs/FCM)** — out-of-app delivery for likes/comments; high user impact
5. **Phase 1 roadmap features** — AI transcription, content analysis, studio mode (see FEATURE_ROADMAP.md)

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

1. **[MERGE] Land PR #50 (sleep timer)** — Conflict resolved, review comments addressed. Smoke-test on device: set a 1-min timer, verify audio stops, countdown updates, Cancel Timer works. ModernAudioPlayer now renders both SleepTimerModal and PlaybackSpeedModal correctly.

2. **[MERGE] Land PR #51 (follow creator)** — All 5 review comments fixed (N+1 batch queries, real total, order_by, IntegrityError catch, optimistic rollback). Backend + frontend both clean.

3. **[FEATURE] "End of episode" sleep option** — Extend `SleepTimerModal` with a special option that stops playback when the current track ends (`sleepOnEpisodeEnd` flag in `onPlaybackStatusUpdate`). Files: `useAudioStore.js` + `SleepTimerModal.js`. Natural follow-up to PR #50, very low risk.
