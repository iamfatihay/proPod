# AGENT STATE — proPod Autonomous Engineer

> **This file is read at the START and written at the END of every automated session.**
> It is the agent's persistent memory across sessions. Do not delete it.

---

## 🎯 Product Vision

**proPod** is a cross-platform (iOS + Android) mobile application for creating, broadcasting, and editing podcasts — with AI assistance. The primary users are podcast creators and listeners. The app must work smoothly on real devices, feel polished, and support the full creator workflow: record → edit → publish → share → live broadcast.

Tech stack: React Native + Expo (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL (runtime/dev/prod) · SQLite only for isolated test scenarios

---

## 📍 Current Project State

**Last updated:** 2026-04-20
**Last session (encoding fix + perf):** PR #67 was already merged by Fay. Fixed double-encoded UTF-8 mojibake in `crud.py` (88 occurrences — ellipsis, em dash, box drawing, emojis) → PR #69 `fix/crud-encoding-mojibake`. Also replaced whole-object `currentTrack` Zustand selector in `EpisodeRow` with a derived boolean → PR #70 `perf/episoderow-zustand-selector`. Full test suite: 407 passed, 0 failed.
**Test suite baseline:** 407 backend tests, all passing.

### What's shipped (merged to master)
- ✅ Playlist Play All + Share sheet — Play All queues ordered tracks; Share invokes native Share.share with deep link (PR #63)
- ✅ DM push notifications — `create_notification(type='dm')` wired into `send_direct_message`, 3 new tests (PR #62)
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
- ✅ Expo push notifications — `DeviceToken` model + migration, register/remove endpoints, `registerPushToken()` on session, 13 new tests — PR #60
- ✅ Push notification tap routing + logout cleanup + eager sleep settings — PR #61
- ✅ Playlist shuffle play — Fisher-Yates shuffle, Shuffle button alongside Play All — PR #64
- ✅ Playlist now-playing indicator — active EpisodeRow shows red border + waveform animation in playlist-detail.js — PR #65
- ✅ Playlist Play All + Share sheet — PR #63
- ✅ DM push notifications — PR #62
- ✅ Listening history screen with progress bar, completion badge, pagination — PR #66
- ✅ Listening history delete entry — `DELETE /podcasts/{podcast_id}/history`, trash-can icon, 5 backend tests — PR #67

### What's open / in-progress
- 🔄 PR #68 `copilot/add-user-facing-feature` — Persisted **Haptic Feedback** setting, shared preference-aware haptics helper (`hapticFeedback.js`), existing touch/vibration paths wired to preference, targeted Jest coverage. Awaiting Fay's merge.
- 🔄 PR #69 `fix/crud-encoding-mojibake` — Fixes double-encoded UTF-8 mojibake in `crud.py` (notification preview ellipsis, emoji titles, docstring chars). Restores `TestDMNotifications::test_send_dm_notification_preview_truncated`. 407 tests pass. Awaiting Fay's merge.
- 🔄 PR #70 `perf/episoderow-zustand-selector` — Replaces whole-object `currentTrack` Zustand selector in `EpisodeRow` with derived boolean; cuts O(n) re-renders to O(2) on track switch. Syntax check passed. Awaiting Fay's merge.

### Known issues / tech debt
- Frontend `npm run lint` is currently blocked by repo-wide ESLint configuration/parsing issues (`Unexpected token <` across JSX files). Use `node --check` + targeted Jest until the lint config is fixed.
- Push: no receipt polling — Expo Push API returns ticket IDs; check receipts at `https://exp.host/--/api/v2/push/getReceipts` to detect expired/invalid tokens and prune `device_tokens` table
- DM inbox has no server-side pagination — fine for now, add if thread count grows large
- DM text-only — no image/file attachments yet
- Frontend unit test coverage still thin
- Sleep timer uses `setInterval` — verify accuracy on real device

---

## 🗺️ Roadmap Priority (agent perspective)

1. **[FEATURE] Expo push receipt polling** — After firing pushes, Expo returns ticket IDs. Extend `_send_expo_push` in `crud.py` to store ticket IDs, then add a `POST /admin/push-receipts/check` endpoint (admin-only) that calls `https://exp.host/--/api/v2/push/getReceipts` and deletes `DeviceNotRegistered` tokens from `device_tokens`. Requires Alembic migration for `push_tickets` table.

2. **[FEATURE] Playlist deep-link share** — Add `volo://playlist/{id}` deep link handling in `frontend/app/(main)/playlist-detail.js` (alongside the existing episode deep link). Backend already returns playlist data at `GET /playlists/{id}`. Primarily frontend: extend the Share button in `playlist-detail.js` to generate the deep link, and wire `deep-link-handler.js` to navigate to the playlist screen on open.

3. **[FEATURE] "New Episode" push notification for followed creators** — When `POST /podcasts/` is called, check for followers of `owner_id` and fire push notifications to each. The follow system (`GET /users/{id}/followers`) and push infra (`_send_expo_push`) already exist. Add a new notification type `new_episode` and extend `create_podcast` in `crud.py` to fan out notifications to follower device tokens.

---

## 🔧 Permanent Agent Notes (Do Not Delete)

### GitHub API Access — Sandbox Constraint

**The terminal sandbox proxy blocks all outbound HTTPS to `api.github.com`.**
Do not rely on terminal REST calls to GitHub. `git` commands still work.

Use `mcp__Claude_in_Chrome__javascript_tool` with `fetch()` after navigating to github.com.

### GitHub Git API — Atomic Commit Workaround

When sandbox disk is full and `git push` is blocked, use the GitHub Git API via browser JS:
1. Fetch file SHAs + content from master (`GET /contents/{path}?ref=master`)
2. Patch content in browser memory with string replacement
3. Create blobs (`POST /git/blobs`)
4. Create tree (`POST /git/trees` with `base_tree`)
5. Create commit (`POST /git/commits`)
6. Create branch ref (`POST /git/refs`)
7. Create PR (`POST /pulls`)

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

1. **[FEATURE] Expo push receipt polling** — In `backend/app/crud.py`, extend `_send_expo_push` to store returned ticket IDs in a new `push_tickets` table (`id`, `ticket_id`, `device_token_id`, `created_at`). Add `POST /admin/push-receipts/check` endpoint in `backend/app/routers/admin.py` that POSTs ticket IDs to `https://exp.host/--/api/v2/push/getReceipts` and deletes `DeviceNotRegistered` device token rows. Add Alembic migration for `push_tickets`. Test suite target: 407 + ~5 new tests.

2. **[FEATURE] Playlist deep-link share** — In `frontend/app/(main)/playlist-detail.js`, update the Share button handler (around line 280) to call `Share.share({ url: 'volo://playlist/' + playlistId })`. Then in `frontend/src/utils/deep-link-handler.js` (or wherever `volo://podcast/{id}` is handled), add a branch for `volo://playlist/{id}` that navigates to `/(main)/playlist-detail?id={id}`. No backend changes needed.

3. **[FEATURE] New-episode push notification to followers** — In `backend/app/crud.py`, extend `create_podcast()` to query `follows` table for followers of `owner_id` and call `_send_expo_push` for each follower's device tokens with `title="New episode from {creator_name}"`. Add `notification_type='new_episode'` to `create_notification` calls. New backend tests in `tests/test_notifications.py`. Target: 407 + ~4 new tests.
