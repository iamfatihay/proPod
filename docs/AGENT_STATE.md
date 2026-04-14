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
**Last session (DM Copilot review fixes):** Addressed all 7 Copilot comments on PR #58. Backend: `send_direct_message` now uses flush→commit→joinedload re-query (no duplicate refresh); `get_conversation` separates count from data query and adds joinedload; `get_dm_inbox` adds joinedload and skips inactive partners. `DirectMessageCreate` validator rejects whitespace-only body. `validation_exception_handler` stringifies non-serializable `ctx` values. Added `test_messages.py` (17 new tests: send, inbox, conversation, pagination, read-marking side effect, inactive-partner filtering). Frontend: `messages.js` `loadInbox` guards all state updates with cancellation signal; `chat-details.js` `loadConversation` has isActive guard and `handleSend` increments `fetchOffset` on local append. All 384 backend tests pass.
**Test suite baseline:** 384 backend tests (+17 new in test_messages.py). Frontend: syntax-checked only; unit tests thin.

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

### What's open / in-progress
- **PR #58**: `feat(messages): direct messaging between users` — https://github.com/iamfatihay/proPod/pull/58 — **Copilot review addressed**
  - `DirectMessage` model + Alembic migration `a2b3c4d5e6f7`
  - `POST /messages/`, `GET /messages/inbox`, `GET /messages/{partner_id}`
  - `chat-details.js` rewritten as full DM conversation UI (bubbles, compose bar, read receipts, pagination)
  - `messages.js` updated to DM inbox with unread badges (was creator comment inbox)
  - `creator-profile.js`: "Message" button added
  - N+1 queries eliminated (joinedload on all DM queries)
  - Inactive-partner filtering in inbox
  - `test_messages.py`: 17 tests (send, inbox, conversation, pagination, read-marking, inactive)
  - 384/384 backend tests passing

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

1. **[FEATURE] Push notifications (APNs/FCM)** — Create `frontend/src/services/pushNotifications.js` (register Expo Push Token via `expo-notifications`, call `POST /users/me/device-token`). Add `DeviceToken` model to `backend/app/models.py` (fields: id, user_id, token, platform, created_at), new CRUD + endpoint, Alembic migration. Call Expo Push API from `crud.create_notification` for likes/comments/DMs. High user visibility.

2. **[FEATURE] Eager loadSleepSettings at cold start** — In `frontend/app/_layout.js`, import `useAudioStore` and call `loadSleepSettings()` inside the root `useEffect` (after auth is restored). One-line addition that eliminates the edge case where sleep preference isn't applied until the modal opens.

3. **[FEATURE] DM unread badge in tab bar** — In `frontend/app/(main)/_layout.js`, fetch `getDMInbox()` on focus, sum `unread_count` across threads, and apply it as the badge on the Messages tab icon — same pattern as the `unread_count` bell on the Notifications tab. Makes new messages discoverable without opening the inbox.
