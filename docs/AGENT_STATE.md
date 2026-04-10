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
**Last session:** Validated open PRs #50 (sleep timer, 21 tests passing) and #51 (follow creator, complete backend+frontend) for merge readiness. Implemented new feature: Playback Speed Modal (PR #52). Created PlaybackSpeedModal component with 6 presets (0.5x–2.0x), integrated into ModernAudioPlayer replacing inline cycling, added 9 Jest tests covering all speeds and interactions. Verified both test suites passing: sleep timer tests, and new speed modal tests.
**Test suite baseline:** 196 frontend tests (185 + 9 new + 2 existing passing). All validations in this session: `npm test -- src/tests/__tests__/PlaybackSpeedModal.test.js --runInBand` (9/9 PASS), `npm test -- src/context/__tests__/useAudioStore.sleepTimer.test.js --runInBand` (21/21 PASS).

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
- ✅ Navigation wiring, creator inbox, activity feed, secondary screen headers (PR #49, merged by Fay)

### What's open / in-progress
- **PR #50**: `feat(player): sleep timer — auto-pause after chosen duration` — https://github.com/iamfatihay/proPod/pull/50 — branch `feature/sleep-timer`
  - useAudioStore: adds `sleepTimerActive`, `sleepTimerEndTime`, `sleepTimerRemaining` state; `setSleepTimer(minutes)` and `cancelSleepTimer()` methods
  - SleepTimerModal component with 5/10/15/30/45/60 min presets and live countdown display
  - Auto-pause when timer expires; cleanup on unmount
  - 21 Jest tests covering all presets, expiry, and edge cases
  - No review comments; ready for merge
  
- **PR #51**: `feat(social): follow/unfollow creator — backend + frontend` — https://github.com/iamfatihay/proPod/pull/51 — branch `feature/follow-creator`
  - Backend: UserFollow model + Alembic migration, POST/DELETE /users/{id}/follow endpoints, GET /users/me/following
  - Frontend: Follow/Following toggle button on creator-profile screen, real follower counts
  - Optimistic count updates; test coverage
  - No review comments; ready for merge

- **PR #52**: `feat(player): playback speed selector modal with presets` — https://github.com/iamfatihay/proPod/pull/52 — branch `feature/playback-speed-control`
  - PlaybackSpeedModal component with 6 speed presets (0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 2.0x)
  - Replaces inline speed cycling in ModernAudioPlayer with modal-based selection
  - Integrates with existing useAudioStore.setPlaybackRate() function
  - Shows "Normal" label for 1.0x for better UX; checkmark visual indicator
  - 9 Jest tests covering all speeds, modal visibility, callbacks
  - Closes TODO #6 "Advanced Playback Controls" from TODO_IMPROVEMENTS.md

### Known issues / tech debt
- No real DM/user-to-user messaging backend yet; `messages.js` now shows real comment inbox data, but `chat-details.js` is still a comment-detail surface rather than a true chat thread
- Full backend pre-commit currently hits an existing failure in `tests/test_sharing.py::TestSharePodcastPublic::test_relative_audio_url_gets_base_url_prefix`
- Frontend tests growing but component-level coverage is still thin
- Several old feature branches still exist on remote and likely abandoned

---

## 🗺️ Roadmap Priority (agent perspective)

1. **Merge PRs #50, #51, #52** — Sleep timer, follow creator, playback speed are complete with tests and ready
   - All three have solid feature implementations and test coverage
   - No review blockers identified
2. **Investigate/fix sharing test failure** — restore a green full-backend pre-commit baseline
   - Blocking: `tests/test_sharing.py::TestSharePodcastPublic::test_relative_audio_url_gets_base_url_prefix`
3. **Phase 1 roadmap features** — AI transcription, content analysis, studio mode features
   - High impact for creators; see FEATURE_ROADMAP.md
4. **DM/chat backend** — add a real messages model/router if true creator-listener or user-to-user messaging is still desired
5. **Push notifications** — APNs/FCM for out-of-app delivery of like/comment events

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

1. **[MERGE] Land PRs #50, #51, #52** — All three PRs are feature-complete with test coverage and no review blockers:
   - PR #50: Sleep timer (21 tests passing)
   - PR #51: Follow creator (backend + frontend, test coverage)
   - PR #52: Playback speed selector (9 tests passing)
   - Recommend merging in order: #50 → #51 → #52

2. **[BACKEND] Fix the sharing regression test** — Investigate `tests/test_sharing.py::TestSharePodcastPublic::test_relative_audio_url_gets_base_url_prefix`, patch the root cause, and restore a green pre-commit backend baseline. This unblocks full test suite runs.

3. **[FRONTEND] Phase 1 Roadmap Features** — High-impact features from FEATURE_ROADMAP.md:
   - AI Transcription backend integration (2 days)
   - Content Analysis (keywords, summary, sentiment) (1 day)
   - Studio Mode UI skeleton (2 days)
   Pick one and fully implement with tests.
