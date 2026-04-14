# AGENT STATE — proPod Autonomous Engineer

> **This file is read at the START and written at the END of every automated session.**
> It is the agent's persistent memory across sessions. Do not delete it.

---

## 🎯 Product Vision

**proPod** is a cross-platform (iOS + Android) mobile application for creating, broadcasting, and editing podcasts — with AI assistance. The primary users are podcast creators and listeners. The app must work smoothly on real devices, feel polished, and support the full creator workflow: record → edit → publish → share → live broadcast.

Tech stack: React Native + Expo (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL (runtime/dev/prod) · SQLite only for isolated test scenarios

---

## 📍 Current Project State

**Last updated:** 2026-04-14
**Last session (DM unread badge):** Created `useDMStore.js` (Zustand) with `unreadDMCount`, `fetchDMUnreadCount`, `resetDMUnread`. Made Messages tab visible in the bottom tab bar with chatbubbles icon and red badge (was `href: null`). Tab bar now: Home | Library | [Create] | Search | Messages | Notifications. Badge fetched on mount + AppState foreground; clears immediately when user opens inbox (`resetDMUnread` in `useFocusEffect`). PR #59 open — no backend changes, 3 frontend files changed, all syntax checks pass.
**Test suite baseline:** 384 backend tests. Frontend: syntax-checked only; unit tests thin.

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

### What's open / in-progress
- **PR #59**: `feat(messages): DM unread badge in tab bar` — https://github.com/iamfatihay/proPod/pull/59
  - `useDMStore.js` — new Zustand store (unreadDMCount, fetchDMUnreadCount, resetDMUnread)
  - `_layout.js` — Messages tab now visible with chatbubbles icon + badge; badge fetched on mount + foreground
  - `messages.js` — calls resetDMUnread on focus; removed secondary-screen back-arrow header
  - No backend changes; all 3 files syntax-check clean

### Known issues / tech debt
- No push notifications for new DMs — backend stub exists (`/notifications/send`), needs Expo Push Token wired at app launch
- DM inbox has no server-side pagination — fine for now, add if thread count grows large
- DM text-only — no image/file attachments yet
- Frontend unit test coverage still thin
- Sleep timer uses `setInterval` — verify accuracy on real device

---

## 🗺️ Roadmap Priority (agent perspective)

1. **[FEATURE] Push notifications (APNs/FCM)** — Register Expo Push Token on app launch, persist to `DeviceToken` model, call Expo Push API from `crud.create_notification`. Delivers out-of-app alerts for likes/comments/DMs.

2. **[FEATURE] Eager `loadSleepSettings` on app launch** — Move `loadSleepSettings()` from `SleepTimerModal.useEffect` into `frontend/app/_layout.js`. One-line change; zero risk.

3. **[FEATURE] DM unread badge in tab bar** — Wire `getDMInbox()` unread count into the Messages tab badge, same pattern as the notification bell in `frontend/app/(main)/_layout.js`.

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

1. **[FEATURE] Push notifications (APNs/FCM)** — Create `frontend/src/services/pushNotifications.js`: register Expo Push Token via `expo-notifications`, call new `POST /users/me/device-token` endpoint. Add `DeviceToken` model to `backend/app/models.py` (id, user_id, token, platform, created_at), CRUD fn, router endpoint, Alembic migration. In `crud.create_notification`, after inserting the DB record, call Expo Push API (`https://exp.host/--/api/v2/push/send`) with the stored token. High user visibility — badge-only is silent; push delivers out-of-app alerts for likes/comments/DMs.

2. **[FEATURE] Eager `loadSleepSettings` at cold start** — In `frontend/app/_layout.js`, import `useAudioStore` and call `loadSleepSettings()` inside the root `useEffect` (after auth is restored). One-line addition; eliminates the edge case where sleep preference isn't applied until SleepTimerModal opens.

3. **[FEATURE] DM badge polling** — After PR #59 merges, add a lightweight `setInterval` (every 60s when app is active) inside `useDMStore` or in `_layout.js` to call `fetchDMUnreadCount` so the badge stays fresh during long sessions without relying solely on mount + foreground events.
