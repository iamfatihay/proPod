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
**Last session:** Merged PR #47 and PR #48 into `master`, then opened PR #49 for navigation wiring, real creator inbox/activity flows, secondary screen header consistency, Notification admin visibility, and related API test coverage. Verified: `npx jest src/services/api/__tests__/apiService.test.js --runInBand` passes, `DATABASE_URL=sqlite:///./propod_test.sqlite pytest tests/test_notifications.py -q` passes. Pre-commit full backend suite is currently blocked by an existing sharing test failure: `tests/test_sharing.py::TestSharePodcastPublic::test_relative_audio_url_gets_base_url_prefix`.
**Test suite baseline:** 185 frontend tests — passing on latest verified run. Backend targeted notification suite passes; full backend suite needs re-baselining because of the known sharing test failure above.

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

### What's open / in-progress
- **PR #49**: `feat(navigation): wire studio flows, inbox, and secondary headers` — https://github.com/iamfatihay/proPod/pull/49 — branch `feature/navigation-wiring-inbox-consistency`
  - Fixes extra bottom-tab leak by hiding `creator-profile` and other secondary routes with `href: null`
  - Adds `messages.js` and `activity.js` as real parent screens wired from Studio quick actions
  - Replaces mock inbox data with `apiService.getCreatorCommentInbox()` aggregated from real podcast comments
  - Unifies back navigation with `buildSecondaryScreenOptions()` across analytics/activity/messages/detail screens
  - Adds `NotificationAdmin` to SQLAdmin and extends `apiService.test.js` for creator inbox aggregation
  - Keeps `docs/testing/MANUAL_REGRESSION_REENTRY_GUIDE.md` local-only via `.git/info/exclude`

### Known issues / tech debt
- No real DM/user-to-user messaging backend yet; `messages.js` now shows real comment inbox data, but `chat-details.js` is still a comment-detail surface rather than a true chat thread
- Full backend pre-commit currently hits an existing failure in `tests/test_sharing.py::TestSharePodcastPublic::test_relative_audio_url_gets_base_url_prefix`
- Frontend tests growing but component-level coverage is still thin
- Several old feature branches still exist on remote and likely abandoned

---

## 🗺️ Roadmap Priority (agent perspective)

1. **Review and merge PR #49** — navigation wiring, creator inbox, activity feed, and secondary-header consistency are user-visible and nearly complete
2. **Investigate/fix sharing test failure** — restore a green full-backend pre-commit baseline
3. **DM/chat backend** — add a real messages model/router if true creator-listener or user-to-user messaging is still desired
4. **Push notifications** — APNs/FCM for out-of-app delivery of like/comment events
5. **Frontend component tests** — PodcastCard, NotificationsScreen interactions

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

1. **[REVIEW] Land PR #49** — Review and merge the navigation/inbox/activity work if manual smoke testing on device looks clean. Focus on Studio quick actions, creator profile navigation, and secondary-screen back behavior.

2. **[BACKEND] Fix the sharing regression test** — Investigate `tests/test_sharing.py::TestSharePodcastPublic::test_relative_audio_url_gets_base_url_prefix`, patch the root cause, and restore a green pre-commit backend baseline.

3. **[FRONTEND+BACKEND] Real chat/messages backend** — If product still wants true messaging, design a dedicated `messages` model and REST API instead of continuing to overload comment-detail UI.
