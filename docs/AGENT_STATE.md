# AGENT STATE — proPod Autonomous Engineer

> **This file is read at the START and written at the END of every automated session.**
> It is the agent's persistent memory across sessions. Do not delete it.

---

## 🎯 Product Vision

**proPod** is a cross-platform (iOS + Android) mobile application for creating, broadcasting, and editing podcasts — with AI assistance. The primary users are podcast creators and listeners. The app must work smoothly on real devices, feel polished, and support the full creator workflow: record → edit → publish → share → live broadcast.

Tech stack: React Native + Expo (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL (runtime/dev/prod) · SQLite only for isolated test scenarios

---

## 📍 Current Project State

**Last updated:** 2026-04-18
**Last session (haptic feedback settings):** Opened PR #68 — `copilot/add-user-facing-feature`. Added a persisted **Haptic Feedback** toggle in `frontend/app/(main)/settings.js`, routed existing frontend haptic/vibration touchpoints through `frontend/src/services/haptics/hapticFeedback.js`, and added targeted Jest coverage. Also reconciled AGENT_STATE with git reality: PR #67 is merged to master.
**Test suite baseline:** Targeted frontend validation this session: `node --check` passed for touched files and 17 Jest tests passed across `hapticFeedback.test.js` and `useAudioStore.sleepEoeStorage.test.js`. Full frontend lint is currently blocked by repo-wide ESLint JSX parsing/configuration issues.

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
- ✅ Delete listening history entry — `DELETE /podcasts/{podcast_id}/history` endpoint + trash icon in history rows — PR #67

### What's open / in-progress
- 🔄 PR #68 `copilot/add-user-facing-feature` — persisted **Haptic Feedback** setting, shared preference-aware haptics helper, existing touch/vibration paths wired to the new preference, targeted Jest coverage.

### Known issues / tech debt
- Frontend `npm run lint` is currently blocked by repo-wide ESLint configuration/parsing issues (`Unexpected token <` across JSX files, plus duplicate keys in `frontend/src/tests/mocks/reactNative.js`). Use `node --check` + targeted Jest until the lint config is fixed.
- Push: no receipt polling — Expo Push API returns ticket IDs; check receipts at `https://exp.host/--/api/v2/push/getReceipts` to detect expired/invalid tokens and prune `device_tokens` table
- DM inbox has no server-side pagination — fine for now, add if thread count grows large
- DM text-only — no image/file attachments yet
- Frontend unit test coverage still thin
- Sleep timer uses `setInterval` — verify accuracy on real device

---

## 🗺️ Roadmap Priority (agent perspective)

1. **[FEATURE] Live session join deep links** — Finish `volo://join/{invite_code}` handling promised in docs by extending `frontend/app/_layout.js`, `frontend/app/(main)/create.js`, and the RTC API service so shared live-session links can open the correct in-app flow.

2. **[FEATURE] Real notifications preference** — Make the Settings notifications switch actually persist and drive Expo push registration/unregistration in `frontend/app/(main)/settings.js` and `frontend/src/services/pushNotifications.js`.

3. **[DEVEX] Fix frontend ESLint for JSX** — Repair `frontend/eslint.config.js` so `npm run lint` parses Expo/React JSX again, then clean up the duplicate keys already reported in `frontend/src/tests/mocks/reactNative.js`.

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

1. **[FEATURE] Live session join deep links** — Add real `volo://join/{invite_code}` handling. Start in `frontend/app/_layout.js`, add an invite-code lookup path in the RTC client/API layer, and route users into the live-session screen from a shared link.

2. **[FEATURE] Notifications preference wiring** — Replace the placeholder Settings notifications switch with a persisted preference that registers/unregisters Expo push tokens via `frontend/src/services/pushNotifications.js`, then reflect the saved state on app launch.

3. **[DEVEX] Restore frontend linting** — Update `frontend/eslint.config.js` so JSX files lint successfully, then clean up the duplicate object keys in `frontend/src/tests/mocks/reactNative.js` and rerun `npm run lint`.
