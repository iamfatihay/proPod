# AGENT STATE ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ proPod Autonomous Engineer

> Read at session START, written at session END. Persistent memory across sessions.

---

## ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ Current State

**Last updated:** 2026-05-03
**Last session:** Follow push notification (PR #110) — `_send_expo_push` called in `follow_creator` after in-app notif; 3 new `TestFollowNotification` pytest cases
**Test suite baseline:** ~480 backend tests

**Tech stack:** React Native + Expo ÃÂÃÂÃÂÃÂ· FastAPI + SQLAlchemy ÃÂÃÂÃÂÃÂ· PostgreSQL (prod) / SQLite (test only)

> Full shipped history (PR #1ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ#65): see `docs/SHIPPED_ARCHIVE.md`

---

## ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Recently Shipped (PR #66ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ#101)

- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Listening history screen ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ progress bar, completion badge, pagination (PR #66)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Listening history delete entry ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `DELETE /podcasts/{id}/history`, 5 tests (PR #67)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Persisted Haptic Feedback setting ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `hapticFeedback.js`, wired to touch paths (PR #68)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Fix double-encoded UTF-8 mojibake in `crud.py` ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ 88 occurrences (PR #69)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `EpisodeRow` Zustand selector perf ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ derived boolean, O(n)ÃÂÃÂ¢ÃÂÃÂÃÂÃÂO(2) re-renders (PR #70)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `new_episode` follower notification fan-out ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `_notify_followers_new_episode()`, in-app + Expo push, 5 tests (PR #71)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `new_episode` push tap routing ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `_layout.js` routes to episode detail; `serverTypes` test (PR #72)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Dev workflow scripts + UI tab bar and feed improvements (PR #73)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `new_episode` fan-out via FastAPI BackgroundTask ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ non-blocking `POST /podcasts/` (PR #74)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Demo user error-handling feedback ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ next() fallback tests, pre-commit quoting fix, repeat=all single-item loop fix, conftest engine.dispose(), SQLite check_same_thread (PR #75)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Expo push receipt polling ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ PushTicket model, Alembic migration, `check_push_receipts()`, `POST /admin/push-receipts/check`, 15 tests (PR #76)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Creator Search tab ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `GET /users/search`, `search_users` CRUD, `searchUsers` apiService, 3-tab toggle, `CreatorCard` with optimistic follow, 14 tests (PR #77)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Category filter chips in Search (Podcasts mode) ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ horizontal chips, `category=` param, active-filter label + Clear, mode-switch reset (PR #78)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Creator search sort by followers ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `sort_by` param to `GET /users/search`, Name/Followers toggle in Creators tab (PR #79)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Empty-state category browse grid on Search screen ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ 2-column card grid in Podcasts/idle mode (PR #80)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Trending reposition to horizontal scroll row + Related Podcasts cover art fix (PR #81)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Related Podcasts horizontal GradientCard scroll row in detail screen + `handlePlayRelated` callback (PR #82)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Fix `ReferenceError: insets is not defined` crash on Creator Analytics screen + profile shortcut (PR #83)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Add Playlists tab to Library screen ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ PlaylistRow, empty state, Manage shortcut (PR #84)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Daily listening-activity bar chart on Creator Analytics screen ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ pure-RN bars, parallel fetch, 10 tests (PR #85)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Playlist cover art mosaic in Library Playlists tab ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `preview_thumbnails` field, batched JOIN in CRUD, `PlaylistMosaic` RN component (PR #86)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Extract `PlaylistMosaic` to shared component + wire into `playlists.js` PlaylistCard (size=48) (PR #88)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Public playlist browse screen ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `public-playlists.js`, `getPublicPlaylists` apiService, Library "Discover" button, pull-to-refresh, loadMore error+retry footer, 3 apiService tests (PR #89)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ APScheduler auto-run + owner name on public playlist cards ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `lifespan()` + `BackgroundScheduler` every 30 min, 7 scheduler tests; `owner_name` on `PlaylistResponse`, 45 playlist tests pass (PR #90)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `PlaysOverTimeChart` `Animated.spring` bar wave animation + Rules of Hooks compliance (PR #91)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Creator username on public playlist cards ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `owner_username` (email-prefix) in `PlaylistResponse`; tappable `@handle` in `PublicPlaylistCard` ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ creator-profile; 1 new test, 477 pass (PR #93)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ RTC live lobby + video podcast playback ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `Podcast.media_type`/`video_url` + Alembic migration, webhook-created video podcasts, host pre-join lobby in `create.js`, invite-code preview/join endpoints, guest deeplink screen `live.js`, `expo-video` playback in details, processing/ready notifications, and review-fix polish (PR #94)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Public playlist search/filter ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `q=` ILIKE param on `GET /playlists/public`, debounced search bar + clear CTA in Discover screen, contextual empty state, 5 new tests; 44 playlist tests pass (PR #95)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Library Playlists tab infinite scroll ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ paged GET /playlists/my (skip/limit/has_more), loadMorePlaylists, PlaylistsFooter with spinner+retry, onEndReached wiring (PR #96)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Library pull-to-refresh on all tabs ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ RefreshControl added to playlists + podcasts FlatLists, handleRefresh callback, refreshing state (PR #97)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Public playlist search extended to match owner_username slug (PR #98)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Pull-to-refresh on Playlists manage screen (PR #99)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Pull-to-refresh on playlist detail episode list (PR #100)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Offline episode download ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `downloadService.js` (expo-file-system + AsyncStorage), Download chip in detail screen with live % progress, cancel, delete, offline playback via local URI; review fixes: metadata rollback guard, 13 Jest tests, cancel-toast suppression, stale-state reset on episode switch (PR #101)

---

## ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Recently Shipped (continued)

- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Refactor `PlaylistCard` to primitive Zustand selectors ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ two `useAudioStore` boolean primitives replacing combined-object pattern; zero re-renders on inactive cards during play/pause (PR #106)

- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ DM unread badge wired end-to-end ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `GET /messages/unread-count`, `_layout.js` cold-start + foreground hook, `home.js` badge fix (PR #102)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ DM badge 30 s polling interval ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `startDMPolling`/`stopDMPolling` helpers in `_layout.js`, pauses on background, clears on unmount (PR #103)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Playlist now-playing indicator in Library ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ animated waveform icon + primary border on active `PlaylistCard`; `activePlaylistId` in useAudioStore; backward-compatible `setQueue` third param (PR #104)
- ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Discover Playlists now-playing indicator ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ pulsing waveform icon + primary border + chevron tint on active `PublicPlaylistCard`; primitive boolean Zustand selectors; review fix: eliminated object-allocation selector pattern (PR #105)
- ÃÂ¢ÃÂÃÂ Fix `dm`/`new_episode` notification types ÃÂ¢ÃÂÃÂ icons, colours, actor_id, tap routing (PR #107)

---

## ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ What's open

- PR #110 `feature/follow-push-notification` â Expo push on follow: `_send_expo_push` in `follow_creator` for creator's device tokens after in-app notification; 3 new `TestFollowNotification` pytest cases
---

## ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂ Known issues / tech debt

- APScheduler in multi-worker deployments (Uvicorn `--workers N`) runs one check per worker ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ harmless (idempotent) but wasteful. Future: SQLAlchemy jobstore + distributed lock.
- Frontend ESLint blocked repo-wide (JSX parsing). Use `node --check` + Jest until fixed.
- `expo-video` flow requires a native rebuild/dev client refresh on devices before manual QA.
- DM inbox: Python-side aggregation in `crud.get_dm_inbox` ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ needs SQL GROUP BY at scale
- DM: text-only, no attachments
- Sleep timer: `setInterval` ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ verify accuracy on real device
- Frontend unit test coverage thin
- `search_users` returns `total_likes: 0` (skipped for perf; not shown in UI)
- Creator sort is Python-side ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ fine at current scale, needs SQL ORDER BY subquery for large datasets
- `handlePlayRelated` queue logic in details.js has no Jest unit test coverage
- Plays-over-time chart reflects last-session-per-user-per-podcast (unique constraint); a per-event play log would enable exact daily counts
- CategoryRow progress bar has no animation ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ width springs would match the new bar-chart feel
- DM unread badge: polling interval added (30s, PR #103); interval duration could be extracted as a named constant if more polling loops are introduced
- `TODO_IMPROVEMENTS.md` deep-link section is stale ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ `volo://podcast/{id}`, `volo://live/{code}`, and `volo://playlist/{id}` are already implemented in `_layout.js`

---

## ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂÃÂºÃÂÃÂ¯ÃÂÃÂ¸ÃÂÃÂ ## ÃÂ°ÃÂÃÂÃÂºÃÂ¯ÃÂ¸ÃÂ ## ðºï¸ Next Session Suggestions

1. **[FRONTEND] Notification read-state badge sync** â The bell badge decrements optimistically; persist last-read timestamp to AsyncStorage so cold-start avoids badge flicker. Medium user impact, frontend-only.

2. **[BACKEND+FRONTEND] Like/comment push notifications** â `like_podcast` and `create_comment` create in-app notifications but don't call `_send_expo_push`. Mirror the pattern just landed in `follow_creator`.

3. **[BACKEND] APScheduler SQLAlchemy jobstore** â Replace in-memory `BackgroundScheduler` with a persistent jobstore so scheduled tasks survive restarts and don't double-fire under multiple Uvicorn workers. Low user impact, improves reliability at scale.
