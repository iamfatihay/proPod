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
**Last session:** Reconciled state (PR #49 already merged by Fay, sharing tests fully green). Confirmed PR #50 (sleep timer) is open with no review comments. Implemented and opened PR #51 for the follow/unfollow creator feature — full backend (model, CRUD, endpoints, migration, 23 tests) + frontend (Follow button on creator-profile, Followers stat, optimistic state).
**Test suite baseline:** 208 frontend tests passing. Backend: 357 tests passing (334 pre-existing + 23 new follow tests). Full backend suite is GREEN — the prior sharing test failure is resolved.

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
- ✅ Navigation wiring, real creator inbox/activity flows, secondary screen header consistency (PR #49, merged by Fay)

### What's open / in-progress
- **PR #50**: `feat(player): sleep timer — auto-pause after chosen duration` — https://github.com/iamfatihay/proPod/pull/50 — branch `feature/sleep-timer`
  - SleepTimerModal component with 5/10/15/30/45/60 min presets and live countdown
  - Sleep timer state + actions in useAudioStore (setSleepTimer, cancelSleepTimer, expiry auto-pause)
  - Moon icon button in ModernAudioPlayer secondary controls row
  - 21 Jest tests — all passing

- **PR #51**: `feat(social): follow/unfollow creator — backend + frontend` — https://github.com/iamfatihay/proPod/pull/51 — branch `feature/follow-creator`
  - UserFollow model + Alembic migration (user_follows table)
  - CRUD: follow_creator, unfollow_creator, is_following_creator, get_follower_count, get_following_list
  - Profile endpoint now returns real total_followers (was placeholder 0) and is_following
  - POST /users/{id}/follow, DELETE /users/{id}/follow, GET /users/me/following
  - Frontend: Follow/Following toggle button on creator-profile screen (optimistic state)
  - Followers stat item added to creator profile stats row
  - 23 backend tests — all passing

### Known issues / tech debt
- No real DM/user-to-user messaging backend yet; `messages.js` shows real comment inbox data, but `chat-details.js` is still a comment-detail surface rather than a true chat thread
- `GET /users/me/following` computes podcast_count and follower_count per user in a Python loop — fine for typical following counts but would need aggregation query if list grows large
- Frontend component-level test coverage is still thin (PodcastCard, NotificationsScreen, etc.)
- Many old feature branches still exist on remote and are likely abandoned

---

## 🗺️ Roadmap Priority (agent perspective)

1. **Review and merge PR #50 (sleep timer)** — complete feature, 21 tests pass, no review comments
2. **Review and merge PR #51 (follow creator)** — 357 backend tests pass, syntax clean
3. **"Following" tab in Library screen** — wire `getFollowingList()` to show a list of followed creators' podcasts (follow-up from PR #51)
4. **Follow notification** — send a notification when someone follows you (add to `follow_creator` CRUD)
5. **DM/chat backend** — dedicated messages model/router for true creator-listener messaging
6. **Push notifications (APNs/FCM)** — out-of-app delivery of like/comment/follow events

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

### Test isolation rule for new test files

New test files MUST use the shared `db_session` fixture from `conftest.py` — do NOT override `app.dependency_overrides[get_db]` at module level. Module-level overrides bleed into other test files and break cross-file test runs. See `tests/test_follow.py` for the correct pattern.

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

1. **[REVIEW] Land PR #50 (sleep timer)** — No open review comments. Ready to merge if Fay is happy with manual smoke test. Key files: `frontend/src/components/SleepTimerModal.js`, `frontend/src/components/audio/ModernAudioPlayer.js`.

2. **[REVIEW] Land PR #51 (follow creator)** — No open review comments. Ready to merge. Key flows to test: Follow button on creator-profile, follower count updating, GET /users/me/following.

3. **[FRONTEND] "Following" tab in Library screen** — Wire `apiService.getFollowingList()` into a new "Following" tab in `frontend/app/(main)/library.js`. Show podcast cards for the followed creators' recent episodes. This is the natural completion of the follow feature.
