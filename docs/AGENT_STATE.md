# AGENT STATE — proPod Autonomous Engineer

> **This file is read at the START and written at the END of every automated session.**
> It is the agent's persistent memory across sessions. Do not delete it.

---

## 🎯 Product Vision

**proPod** is a cross-platform (iOS + Android) mobile application for creating, broadcasting, and editing podcasts — with AI assistance. The primary users are podcast creators and listeners. The app must work smoothly on real devices, feel polished, and support the full creator workflow: record → edit → publish → share → live broadcast.

Tech stack: React Native + Expo (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL (runtime/dev/prod) · SQLite only for isolated test scenarios

---

## 📍 Current Project State

**Last updated:** 2026-04-13
**Last session (Copilot review fixes):** Addressed all Copilot review comments across PRs #55, #56, #57. PR #55: removed line-number reference from AGENT_STATE doc. PR #56: fixed wrong store selectors (currentPodcast/loadAndPlay/togglePlayback → currentTrack/setQueue/play/pause), added normalizePodcasts(), used server podcast_count instead of array.length for posts, cleared statsLoading on early return. PR #57: added write-sequence counter to prevent race conditions, added sleepTimerActive guard in loadSleepSettings, replaced eslint-disable with useRef pattern, added missing false+setItem-rejection test and guard tests.
**Test suite baseline:** 229 frontend tests (PR #57 now has 12 tests in the storage suite). Backend: unchanged.

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
- ✅ "End of Episode" sleep timer option — `sleepOnEpisodeEnd` flag, SleepTimerModal button, ModernAudioPlayer indicator — PR #53
- ✅ Following Feed — `GET /podcasts/following-feed`, FOLLOWING_CATEGORY pill, empty state with CTA — PR #54
- ✅ Fix `TestGetFollowingList` ImportError — removed inline relative import from `get_my_following` body, promoted `func` to module level — PR #55
- ✅ Profile screen wired to real API data — real follower/following/podcast counts, PodcastCard list, `useFocusEffect` refresh — PR #56

### What's open / in-progress
- **PR #55**: `fix(users): remove relative import inside function body in get_my_following` — https://github.com/iamfatihay/proPod/pull/55 — **Copilot review addressed** (line-number ref removed from AGENT_STATE doc)

- **PR #56**: `feat(profile): wire profile screen to real API data` — https://github.com/iamfatihay/proPod/pull/56 — **Copilot review addressed**
  - Fixed wrong store selectors: `currentPodcast`/`loadAndPlay`/`togglePlayback` → `currentTrack`/`setQueue`/`play`/`pause` (matching home.js/creator-profile.js)
  - `handlePodcastPlay` now uses `toTrack()` helper, loads full list as queue
  - `normalizePodcasts()` applied before `setMyPodcasts` (absolute URLs, duration seconds→ms)
  - `podcastCount` from server `publicProfile.podcast_count` (not page-capped `myPodcasts.length`)
  - `setStatsLoading(false)` on early return when `user?.id` is missing (avoids permanent spinner)

- **PR #57**: `feat(player): persist sleepOnEpisodeEnd across app restarts via AsyncStorage` — https://github.com/iamfatihay/proPod/pull/57 — **Copilot review addressed**
  - `_sleepEoeWriteSeq` write-sequence counter: only the last toggle's write survives, preventing race conditions on rapid enable/disable
  - `loadSleepSettings` guards against restoring when `sleepTimerActive=true` — active timer takes precedence
  - `SleepTimerModal`: replaced `eslint-disable-line` with explicit `useRef` pattern for stable dep
  - 12 Jest tests (was 9): added false+setItem-rejection test and two guard tests (45/45 passing)

### Known issues / tech debt
- No real DM/user-to-user messaging backend yet; `chat-details.js` is still a comment-detail surface
- Frontend tests: 229 passing; component-level coverage still thin
- Sleep timer uses `setInterval` — verify accuracy on real device

---

## 🗺️ Roadmap Priority (agent perspective)

1. **[FEATURE] DM / direct messaging backend** — `DirectMessage` model in `backend/app/models.py`, new `backend/app/routers/messages.py` (POST /messages, GET /messages/{partner_id}), Alembic migration. Transforms `chat-details.js` from a comment-detail view into a real conversation surface. High social-layer impact.

2. **[FEATURE] Persist time-based sleep timer across restarts** — Companion to PR #57. When user sets a 30-min timer and closes the app, restore remaining time on reopen. `AsyncStorage` in `useAudioStore.setSleepTimer` + `loadSleepSettings`.

3. **[FEATURE] Push notifications (APNs/FCM)** — backend already has `POST /notifications/send` stub; wire up Expo Push Token registration in `frontend/src/services/` and call on app launch from `_layout.js`. Lets likes/comments trigger out-of-app alerts.

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

1. **[FEATURE] DM / direct messaging backend** — `DirectMessage` model in `backend/app/models.py` (fields: id, sender_id, recipient_id, body, created_at, is_read), new `backend/app/routers/messages.py` with `POST /messages/` and `GET /messages/{user_id}`, Alembic migration, register in `main.py`. Transforms `frontend/app/(main)/chat-details.js` from a comment-detail view into a real 1-on-1 conversation. High social-layer value.

2. **[FEATURE] Eager `loadSleepSettings` on app launch** — Move the `loadSleepSettings()` call from `SleepTimerModal.useEffect` into `frontend/app/_layout.js` so the preference is restored at cold start, not on first modal open. One-line change; zero risk.

3. **[FEATURE] Push notifications (APNs/FCM)** — Register Expo Push Token in `frontend/src/services/` on app launch (`_layout.js`), store in a `DeviceToken` model on the backend, call the push API from `backend/app/crud.py` when creating notifications. Delivers out-of-app alerts for likes/comments — high user visibility.
