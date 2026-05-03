# AGENT STATE Ã¢ÂÂ proPod Autonomous Engineer

> Read at session START, written at session END. Persistent memory across sessions.

---

## Ã°ÂÂÂ Current State

**Last updated:** 2026-05-03
**Last session:** Follow Expo push notification (PR #109) — `_send_follow_push` helper in `crud.py`; called from `follow_creator` after in-app notif; 3 new tests mocking `_send_expo_push`
**Test suite baseline:** ~480 backend tests

**Tech stack:** React Native + Expo ÃÂ· FastAPI + SQLAlchemy ÃÂ· PostgreSQL (prod) / SQLite (test only)

> Full shipped history (PR #1Ã¢ÂÂ#65): see `docs/SHIPPED_ARCHIVE.md`

---

## Ã¢ÂÂ Recently Shipped (PR #66Ã¢ÂÂ#101)

- Ã¢ÂÂ Listening history screen Ã¢ÂÂ progress bar, completion badge, pagination (PR #66)
- Ã¢ÂÂ Listening history delete entry Ã¢ÂÂ `DELETE /podcasts/{id}/history`, 5 tests (PR #67)
- Ã¢ÂÂ Persisted Haptic Feedback setting Ã¢ÂÂ `hapticFeedback.js`, wired to touch paths (PR #68)
- Ã¢ÂÂ Fix double-encoded UTF-8 mojibake in `crud.py` Ã¢ÂÂ 88 occurrences (PR #69)
- Ã¢ÂÂ `EpisodeRow` Zustand selector perf Ã¢ÂÂ derived boolean, O(n)Ã¢ÂÂO(2) re-renders (PR #70)
- Ã¢ÂÂ `new_episode` follower notification fan-out Ã¢ÂÂ `_notify_followers_new_episode()`, in-app + Expo push, 5 tests (PR #71)
- Ã¢ÂÂ `new_episode` push tap routing Ã¢ÂÂ `_layout.js` routes to episode detail; `serverTypes` test (PR #72)
- Ã¢ÂÂ Dev workflow scripts + UI tab bar and feed improvements (PR #73)
- Ã¢ÂÂ `new_episode` fan-out via FastAPI BackgroundTask Ã¢ÂÂ non-blocking `POST /podcasts/` (PR #74)
- Ã¢ÂÂ Demo user error-handling feedback Ã¢ÂÂ next() fallback tests, pre-commit quoting fix, repeat=all single-item loop fix, conftest engine.dispose(), SQLite check_same_thread (PR #75)
- Ã¢ÂÂ Expo push receipt polling Ã¢ÂÂ PushTicket model, Alembic migration, `check_push_receipts()`, `POST /admin/push-receipts/check`, 15 tests (PR #76)
- Ã¢ÂÂ Creator Search tab Ã¢ÂÂ `GET /users/search`, `search_users` CRUD, `searchUsers` apiService, 3-tab toggle, `CreatorCard` with optimistic follow, 14 tests (PR #77)
- Ã¢ÂÂ Category filter chips in Search (Podcasts mode) Ã¢ÂÂ horizontal chips, `category=` param, active-filter label + Clear, mode-switch reset (PR #78)
- Ã¢ÂÂ Creator search sort by followers Ã¢ÂÂ `sort_by` param to `GET /users/search`, Name/Followers toggle in Creators tab (PR #79)
- Ã¢ÂÂ Empty-state category browse grid on Search screen Ã¢ÂÂ 2-column card grid in Podcasts/idle mode (PR #80)
- Ã¢ÂÂ Trending reposition to horizontal scroll row + Related Podcasts cover art fix (PR #81)
- Ã¢ÂÂ Related Podcasts horizontal GradientCard scroll row in detail screen + `handlePlayRelated` callback (PR #82)
- Ã¢ÂÂ Fix `ReferenceError: insets is not defined` crash on Creator Analytics screen + profile shortcut (PR #83)
- Ã¢ÂÂ Add Playlists tab to Library screen Ã¢ÂÂ PlaylistRow, empty state, Manage shortcut (PR #84)
- Ã¢ÂÂ Daily listening-activity bar chart on Creator Analytics screen Ã¢ÂÂ pure-RN bars, parallel fetch, 10 tests (PR #85)
- Ã¢ÂÂ Playlist cover art mosaic in Library Playlists tab Ã¢ÂÂ `preview_thumbnails` field, batched JOIN in CRUD, `PlaylistMosaic` RN component (PR #86)
- Ã¢ÂÂ Extract `PlaylistMosaic` to shared component + wire into `playlists.js` PlaylistCard (size=48) (PR #88)
- Ã¢ÂÂ Public playlist browse screen Ã¢ÂÂ `public-playlists.js`, `getPublicPlaylists` apiService, Library "Discover" button, pull-to-refresh, loadMore error+retry footer, 3 apiService tests (PR #89)
- Ã¢ÂÂ APScheduler auto-run + owner name on public playlist cards Ã¢ÂÂ `lifespan()` + `BackgroundScheduler` every 30 min, 7 scheduler tests; `owner_name` on `PlaylistResponse`, 45 playlist tests pass (PR #90)
- Ã¢ÂÂ `PlaysOverTimeChart` `Animated.spring` bar wave animation + Rules of Hooks compliance (PR #91)
- Ã¢ÂÂ Creator username on public playlist cards Ã¢ÂÂ `owner_username` (email-prefix) in `PlaylistResponse`; tappable `@handle` in `PublicPlaylistCard` Ã¢ÂÂ creator-profile; 1 new test, 477 pass (PR #93)
- Ã¢ÂÂ RTC live lobby + video podcast playback Ã¢ÂÂ `Podcast.media_type`/`video_url` + Alembic migration, webhook-created video podcasts, host pre-join lobby in `create.js`, invite-code preview/join endpoints, guest deeplink screen `live.js`, `expo-video` playback in details, processing/ready notifications, and review-fix polish (PR #94)
- Ã¢ÂÂ Public playlist search/filter Ã¢ÂÂ `q=` ILIKE param on `GET /playlists/public`, debounced search bar + clear CTA in Discover screen, contextual empty state, 5 new tests; 44 playlist tests pass (PR #95)
- Ã¢ÂÂ Library Playlists tab infinite scroll Ã¢ÂÂ paged GET /playlists/my (skip/limit/has_more), loadMorePlaylists, PlaylistsFooter with spinner+retry, onEndReached wiring (PR #96)
- Ã¢ÂÂ Library pull-to-refresh on all tabs Ã¢ÂÂ RefreshControl added to playlists + podcasts FlatLists, handleRefresh callback, refreshing state (PR #97)
- Ã¢ÂÂ Public playlist search extended to match owner_username slug (PR #98)
- Ã¢ÂÂ Pull-to-refresh on Playlists manage screen (PR #99)
- Ã¢ÂÂ Pull-to-refresh on playlist detail episode list (PR #100)
- Ã¢ÂÂ Offline episode download Ã¢ÂÂ `downloadService.js` (expo-file-system + AsyncStorage), Download chip in detail screen with live % progress, cancel, delete, offline playback via local URI; review fixes: metadata rollback guard, 13 Jest tests, cancel-toast suppression, stale-state reset on episode switch (PR #101)

---

## Ã¢ÂÂ Recently Shipped (continued)

- Ã¢ÂÂ Refactor `PlaylistCard` to primitive Zustand selectors Ã¢ÂÂ two `useAudioStore` boolean primitives replacing combined-object pattern; zero re-renders on inactive cards during play/pause (PR #106)

- Ã¢ÂÂ DM unread badge wired end-to-end Ã¢ÂÂ `GET /messages/unread-count`, `_layout.js` cold-start + foreground hook, `home.js` badge fix (PR #102)
- Ã¢ÂÂ DM badge 30 s polling interval Ã¢ÂÂ `startDMPolling`/`stopDMPolling` helpers in `_layout.js`, pauses on background, clears on unmount (PR #103)
- Ã¢ÂÂ Playlist now-playing indicator in Library Ã¢ÂÂ animated waveform icon + primary border on active `PlaylistCard`; `activePlaylistId` in useAudioStore; backward-compatible `setQueue` third param (PR #104)
- Ã¢ÂÂ Discover Playlists now-playing indicator Ã¢ÂÂ pulsing waveform icon + primary border + chevron tint on active `PublicPlaylistCard`; primitive boolean Zustand selectors; review fix: eliminated object-allocation selector pattern (PR #105)
- â Fix `dm`/`new_episode` notification types â icons, colours, actor_id, tap routing (PR #107)

---

## Ã°ÂÂÂ What's open

- PR #108 `feature/follow-notification-routing` â Follow notification end-to-end: backend `_safe_create_notification` in `follow_creator`; frontend `follow` branch in `handleNotificationPress` â `/(main)/creator-profile`; 3 new notification tests
- ⏳ PR #109 `feature/follow-push-notification` — open: Expo push on new follower; `_send_follow_push` in `crud.py`; 3 new tests
---

## Ã°ÂÂÂ Known issues / tech debt

- APScheduler in multi-worker deployments (Uvicorn `--workers N`) runs one check per worker Ã¢ÂÂ harmless (idempotent) but wasteful. Future: SQLAlchemy jobstore + distributed lock.
- Frontend ESLint blocked repo-wide (JSX parsing). Use `node --check` + Jest until fixed.
- `expo-video` flow requires a native rebuild/dev client refresh on devices before manual QA.
- DM inbox: Python-side aggregation in `crud.get_dm_inbox` Ã¢ÂÂ needs SQL GROUP BY at scale
- DM: text-only, no attachments
- Sleep timer: `setInterval` Ã¢ÂÂ verify accuracy on real device
- Frontend unit test coverage thin
- `search_users` returns `total_likes: 0` (skipped for perf; not shown in UI)
- Creator sort is Python-side Ã¢ÂÂ fine at current scale, needs SQL ORDER BY subquery for large datasets
- `handlePlayRelated` queue logic in details.js has no Jest unit test coverage
- Plays-over-time chart reflects last-session-per-user-per-podcast (unique constraint); a per-event play log would enable exact daily counts
- CategoryRow progress bar has no animation Ã¢ÂÂ width springs would match the new bar-chart feel
- DM unread badge: polling interval added (30s, PR #103); interval duration could be extracted as a named constant if more polling loops are introduced
- `TODO_IMPROVEMENTS.md` deep-link section is stale Ã¢ÂÂ `volo://podcast/{id}`, `volo://live/{code}`, and `volo://playlist/{id}` are already implemented in `_layout.js`

---

## Ã°ÂÂÂºÃ¯Â¸Â ## ðºï¸ Next Session Suggestions

1. **[BACKEND] APScheduler SQLAlchemy jobstore** — Replace in-memory `BackgroundScheduler` with a persistent SQLAlchemy jobstore so scheduled tasks (push-receipt polling, future crons) survive Uvicorn restarts and don't double-fire under multiple workers. Low user impact but improves production reliability; pattern: `APScheduler` + `SQLAlchemyJobStore`.

2. **[FRONTEND] Notification read-state badge sync** — The notification bell badge currently decrements optimistically; a fresh app open re-syncs from server. Persist last-read timestamp to `AsyncStorage` so the badge count is stable across cold starts without an extra round-trip.

3. **[FRONTEND] Continue Listening widget on Home** — A "Pick up where you left off" horizontal row on the home screen powered by the existing `GET /podcasts/continue-listening` endpoint. High user impact: surfaces in-progress episodes immediately on app open.
