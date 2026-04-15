# AGENT STATE — proPod Autonomous Engineer

> **This file is read at the START and written at the END of every automated session.**
> It is the agent's persistent memory across sessions. Do not delete it.

---

## 🎯 Product Vision

**proPod** is a cross-platform (iOS + Android) mobile application for creating, broadcasting, and editing podcasts — with AI assistance. The primary users are podcast creators and listeners. The app must work smoothly on real devices, feel polished, and support the full creator workflow: record → edit → publish → share → live broadcast.

Tech stack: React Native + Expo (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL (runtime/dev/prod) · SQLite only for isolated test scenarios

---

## 📍 Current Project State

**Last updated:** 2026-04-15
**Last session (push notifications):** Added full Expo push notification stack. DeviceToken model + Alembic migration `b3c4d5e6f7a8`, `register_device_token` CRUD (upsert), `_send_expo_push` fire-and-forget httpx helper, `create_notification` extended to dispatch push after DB insert, `POST /DELETE /users/me/device-token` endpoints, `pushNotifications.js` frontend service, `registerPushToken()` wired into `_layout.js` on user session, `apiService.registerDeviceToken/removeDeviceToken`. 13 new tests → 397 total, 0 regressions. PR #60 open.
**Test suite baseline:** 397 backend tests. Frontend: syntax-checked only; unit tests thin.

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
- ✅ Fix `TestGetFollowingList` ImportError — removed inline relative import from `get_my_following` body — PR #55
- ✅ Profile screen wired to real API data — real follower/following/podcast counts, PodcastCard list, `useFocusEffect` refresh — PR #56
- ✅ Persist sleepOnEpisodeEnd across app restarts via AsyncStorage — PR #57
- ✅ Direct messaging between users — `DirectMessage` model + Alembic migration, `POST /messages/`, `GET /messages/inbox`, `GET /messages/{partner_id}`, `chat-details.js` conversation UI, `messages.js` inbox, `creator-profile.js` "Message" button, 17 backend tests — PR #58
- ✅ DM unread badge in tab bar — `useDMStore.js`, Messages tab visible + red badge, `resetDMUnread` on focus — PR #59

### What's open / in-progress
- **PR #60**: `feat(push): Expo push notifications` — https://github.com/iamfatihay/proPod/pull/60
  - `backend/app/models.py` — `DeviceToken` model + `device_tokens` relationship on `User`
  - `backend/alembic/versions/b3c4d5e6f7a8_...` — Alembic migration for `device_tokens` table
  - `backend/app/schemas.py` — `DeviceTokenRegister`, `DeviceTokenResponse`
  - `backend/app/crud.py` — `register_device_token` (upsert), `get_device_tokens_for_user`, `remove_device_token`, `_send_expo_push`; `create_notification` extended with push dispatch
  - `backend/app/routers/users.py` — `POST /users/me/device-token` + `DELETE /users/me/device-token`
  - `backend/tests/test_device_tokens.py` — 13 new tests (397 total)
  - `frontend/src/services/pushNotifications.js` — new push registration service
  - `frontend/src/services/api/apiService.js` — `registerDeviceToken` + `removeDeviceToken`
  - `frontend/app/_layout.js` — `registerPushToken()` wired on user session established

### Known issues / tech debt
- Push: `unregisterPushToken()` not yet called on logout — stale tokens will be silently rejected by Expo but never cleaned up; wire into `useAuthStore.logout`
- Push: no receipt polling — Expo Push API returns ticket IDs; check receipts at `https://exp.host/--/api/v2/push/getReceipts` to detect expired/invalid tokens and prune `device_tokens` table
- Push: notification tap routing in `_layout.js` only handles `type === 'recording'`; needs branches for `like`, `comment`, `dm` to deep-link into the right screen
- DM inbox has no server-side pagination — fine for now, add if thread count grows large
- DM text-only — no image/file attachments yet
- Frontend unit test coverage still thin
- Sleep timer uses `setInterval` — verify accuracy on real device

---

## 🗺️ Roadmap Priority (agent perspective)

1. **[FOLLOW-UP] Push notification tap routing** — In `_layout.js` `addNotificationResponseReceivedListener`, branch on `data.type`: `like`/`comment` → `/(main)/details?id={podcast_id}`, `dm` → `/(main)/messages`. Currently only `recording` type is handled.

2. **[FOLLOW-UP] Logout token cleanup** — In `useAuthStore.logout`, call `unregisterPushToken()` from `pushNotifications.js` before clearing the stored auth tokens.

3. **[FEATURE] Eager `loadSleepSettings` at cold start** — In `frontend/app/_layout.js`, import `useAudioStore` and call `loadSleepSettings()` inside the root `useEffect`. One-line; zero risk.

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

Literal-path routes (`/following-feed`, `/search`, `/discover/categories`) MUST be declared BEFORE parameterized routes (`/{podcast_id}`) in `backend/app/routers/podcasts.py`. FastAPI matches in definition order.

### DM inbox aggregation

`crud.get_dm_inbox` does Python-side aggregation (not SQL GROUP BY) for SQLite/PostgreSQL compatibility. On large datasets, switch to a SQL query with `MAX(created_at)` per conversation pair.

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

1. **[FOLLOW-UP] Push notification tap routing** — In `frontend/app/_layout.js`, extend `addNotificationResponseReceivedListener` callback: `if (data.type === 'like' || data.type === 'comment') router.push({ pathname: '/(main)/details', params: { id: data.podcastId } }); if (data.type === 'dm') router.push('/(main)/messages');`. Requires `notificationId` and `podcastId` to be in the `data` payload (already sent by `_send_expo_push` in crud).

2. **[FOLLOW-UP] Logout push token cleanup** — In `frontend/src/context/useAuthStore.js`, at the start of `logout()`, import and call `unregisterPushToken()` from `../services/pushNotifications`. Prevents stale-token accumulation in `device_tokens` table.

3. **[FEATURE] Eager `loadSleepSettings` at cold start** — In `frontend/app/_layout.js` root `useEffect`, add `useAudioStore.getState().loadSleepSettings()` after `initAuth()`. One-line; eliminates sleep-preference race condition on cold start.
