# AGENT STATE â proPod Autonomous Engineer

> Read at session START, written at session END. Persistent memory across sessions.

---

## ð Current State

**Last updated:** 2026-05-02
**Last session:** Follow notification end-to-end (PR #108) — backend: `_safe_create_notification` in `follow_creator`; frontend: `follow` branch in `handleNotificationPress` → `/(main)/creator-profile`; 3 new backend tests
**Test suite baseline:** ~477 backend tests

**Tech stack:** React Native + Expo Â· FastAPI + SQLAlchemy Â· PostgreSQL (prod) / SQLite (test only)

> Full shipped history (PR #1â#65): see `docs/SHIPPED_ARCHIVE.md`

---

## â Recently Shipped (PR #66â#101)

- â Listening history screen â progress bar, completion badge, pagination (PR #66)
- â Listening history delete entry â `DELETE /podcasts/{id}/history`, 5 tests (PR #67)
- â Persisted Haptic Feedback setting â `hapticFeedback.js`, wired to touch paths (PR #68)
- â Fix double-encoded UTF-8 mojibake in `crud.py` â 88 occurrences (PR #69)
- â `EpisodeRow` Zustand selector perf â derived boolean, O(n)âO(2) re-renders (PR #70)
- â `new_episode` follower notification fan-out â `_notify_followers_new_episode()`, in-app + Expo push, 5 tests (PR #71)
- â `new_episode` push tap routing â `_layout.js` routes to episode detail; `serverTypes` test (PR #72)
- â Dev workflow scripts + UI tab bar and feed improvements (PR #73)
- â `new_episode` fan-out via FastAPI BackgroundTask â non-blocking `POST /podcasts/` (PR #74)
- â Demo user error-handling feedback â next() fallback tests, pre-commit quoting fix, repeat=all single-item loop fix, conftest engine.dispose(), SQLite check_same_thread (PR #75)
- â Expo push receipt polling â PushTicket model, Alembic migration, `check_push_receipts()`, `POST /admin/push-receipts/check`, 15 tests (PR #76)
- â Creator Search tab â `GET /users/search`, `search_users` CRUD, `searchUsers` apiService, 3-tab toggle, `CreatorCard` with optimistic follow, 14 tests (PR #77)
- â Category filter chips in Search (Podcasts mode) â horizontal chips, `category=` param, active-filter label + Clear, mode-switch reset (PR #78)
- â Creator search sort by followers â `sort_by` param to `GET /users/search`, Name/Followers toggle in Creators tab (PR #79)
- â Empty-state category browse grid on Search screen â 2-column card grid in Podcasts/idle mode (PR #80)
- â Trending reposition to horizontal scroll row + Related Podcasts cover art fix (PR #81)
- â Related Podcasts horizontal GradientCard scroll row in detail screen + `handlePlayRelated` callback (PR #82)
- â Fix `ReferenceError: insets is not defined` crash on Creator Analytics screen + profile shortcut (PR #83)
- â Add Playlists tab to Library screen â PlaylistRow, empty state, Manage shortcut (PR #84)
- â Daily listening-activity bar chart on Creator Analytics screen â pure-RN bars, parallel fetch, 10 tests (PR #85)
- â Playlist cover art mosaic in Library Playlists tab â `preview_thumbnails` field, batched JOIN in CRUD, `PlaylistMosaic` RN component (PR #86)
- â Extract `PlaylistMosaic` to shared component + wire into `playlists.js` PlaylistCard (size=48) (PR #88)
- â Public playlist browse screen â `public-playlists.js`, `getPublicPlaylists` apiService, Library "Discover" button, pull-to-refresh, loadMore error+retry footer, 3 apiService tests (PR #89)
- â APScheduler auto-run + owner name on public playlist cards â `lifespan()` + `BackgroundScheduler` every 30 min, 7 scheduler tests; `owner_name` on `PlaylistResponse`, 45 playlist tests pass (PR #90)
- â `PlaysOverTimeChart` `Animated.spring` bar wave animation + Rules of Hooks compliance (PR #91)
- â Creator username on public playlist cards â `owner_username` (email-prefix) in `PlaylistResponse`; tappable `@handle` in `PublicPlaylistCard` â creator-profile; 1 new test, 477 pass (PR #93)
- â RTC live lobby + video podcast playback â `Podcast.media_type`/`video_url` + Alembic migration, webhook-created video podcasts, host pre-join lobby in `create.js`, invite-code preview/join endpoints, guest deeplink screen `live.js`, `expo-video` playback in details, processing/ready notifications, and review-fix polish (PR #94)
- â Public playlist search/filter â `q=` ILIKE param on `GET /playlists/public`, debounced search bar + clear CTA in Discover screen, contextual empty state, 5 new tests; 44 playlist tests pass (PR #95)
- â Library Playlists tab infinite scroll â paged GET /playlists/my (skip/limit/has_more), loadMorePlaylists, PlaylistsFooter with spinner+retry, onEndReached wiring (PR #96)
- â Library pull-to-refresh on all tabs â RefreshControl added to playlists + podcasts FlatLists, handleRefresh callback, refreshing state (PR #97)
- â Public playlist search extended to match owner_username slug (PR #98)
- â Pull-to-refresh on Playlists manage screen (PR #99)
- â Pull-to-refresh on playlist detail episode list (PR #100)
- â Offline episode download â `downloadService.js` (expo-file-system + AsyncStorage), Download chip in detail screen with live % progress, cancel, delete, offline playback via local URI; review fixes: metadata rollback guard, 13 Jest tests, cancel-toast suppression, stale-state reset on episode switch (PR #101)

---

## â Recently Shipped (continued)

- â Refactor `PlaylistCard` to primitive Zustand selectors â two `useAudioStore` boolean primitives replacing combined-object pattern; zero re-renders on inactive cards during play/pause (PR #106)

- â DM unread badge wired end-to-end â `GET /messages/unread-count`, `_layout.js` cold-start + foreground hook, `home.js` badge fix (PR #102)
- â DM badge 30 s polling interval â `startDMPolling`/`stopDMPolling` helpers in `_layout.js`, pauses on background, clears on unmount (PR #103)
- â Playlist now-playing indicator in Library â animated waveform icon + primary border on active `PlaylistCard`; `activePlaylistId` in useAudioStore; backward-compatible `setQueue` third param (PR #104)
- â Discover Playlists now-playing indicator â pulsing waveform icon + primary border + chevron tint on active `PublicPlaylistCard`; primitive boolean Zustand selectors; review fix: eliminated object-allocation selector pattern (PR #105)
- ✅ Fix `dm`/`new_episode` notification types — icons, colours, actor_id, tap routing (PR #107)

---

## ð What's open

- PR #108 `feature/follow-notification-routing` — Follow notification end-to-end: backend `_safe_create_notification` in `follow_creator`; frontend `follow` branch in `handleNotificationPress` → `/(main)/creator-profile`; 3 new notification tests
---

## ð Known issues / tech debt

- APScheduler in multi-worker deployments (Uvicorn `--workers N`) runs one check per worker â harmless (idempotent) but wasteful. Future: SQLAlchemy jobstore + distributed lock.
- Frontend ESLint blocked repo-wide (JSX parsing). Use `node --check` + Jest until fixed.
- `expo-video` flow requires a native rebuild/dev client refresh on devices before manual QA.
- DM inbox: Python-side aggregation in `crud.get_dm_inbox` â needs SQL GROUP BY at scale
- DM: text-only, no attachments
- Sleep timer: `setInterval` â verify accuracy on real device
- Frontend unit test coverage thin
- `search_users` returns `total_likes: 0` (skipped for perf; not shown in UI)
- Creator sort is Python-side â fine at current scale, needs SQL ORDER BY subquery for large datasets
- `handlePlayRelated` queue logic in details.js has no Jest unit test coverage
- Plays-over-time chart reflects last-session-per-user-per-podcast (unique constraint); a per-event play log would enable exact daily counts
- CategoryRow progress bar has no animation â width springs would match the new bar-chart feel
- DM unread badge: polling interval added (30s, PR #103); interval duration could be extracted as a named constant if more polling loops are introduced
- `TODO_IMPROVEMENTS.md` deep-link section is stale â `volo://podcast/{id}`, `volo://live/{code}`, and `volo://playlist/{id}` are already implemented in `_layout.js`

---

## ðºï¸ ## 🗺️ Next Session Suggestions

1. **[BACKEND+FRONTEND] Follow push notification** — `follow_creator` now creates an in-app notification but doesn't send an Expo push. Add `_send_expo_push` call in `follow_creator` (same pattern as `new_episode` fan-out in `notify_followers_new_episode`), including device-token lookup for the followed user.

2. **[BACKEND] APScheduler SQLAlchemy jobstore** — Replace in-memory `BackgroundScheduler` with a persistent jobstore so scheduled tasks survive restarts and don't double-fire under multiple Uvicorn workers. Low user impact but improves reliability at scale.

3. **[FRONTEND] Notification read-state badge sync** — The notification bell badge currently decrements optimistically; a fresh app open re-syncs from server. Consider persisting last-read timestamp to AsyncStorage to avoid badge flicker on cold start.
