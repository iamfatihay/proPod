# AGENT STATE — proPod Autonomous Engineer

> Read at session START, written at session END. Persistent memory across sessions.

---

## 🧭 Current State

**Last updated:** 2026-05-03
**Last session:** Like/comment push notifications (PR #111) — added `_send_expo_push` call in `like_podcast` and `create_comment`; 6 new pytest cases in `TestLikePushNotification` and `TestCommentPushNotification`
**Test suite baseline:** ~486 backend tests

**Tech stack:** React Native + Expo · FastAPI + SQLAlchemy · PostgreSQL (prod) / SQLite (test only)

> Full shipped history (PR #1–#65): see `docs/SHIPPED_ARCHIVE.md`

---

## ✅ Recently Shipped (PR #66–#110)

- ✅ Discover screen — horizontal category rows, vertical podcast list, search (PR #66–#71 range)
- ✅ Live rooms — create, join, leave, WebRTC signalling, participant list (PR #72–#80 range)
- ✅ Playlist CRUD + Library tab integration (PR #81–#90 range)
- ✅ Sleep timer, playback speed picker, queue management (PR #91–#96 range)
- ✅ Analytics dashboard — plays-over-time chart, category breakdown (PR #97–#101 range)
- ✅ DM unread badge wired end-to-end — `GET /messages/unread-count`, `_layout.js` cold-start + foreground hook, `home.js` badge fix (PR #102)
- ✅ DM badge 30 s polling interval — `startDMPolling`/`stopDMPolling` helpers in `_layout.js`, pauses on background, clears on unmount (PR #103)
- ✅ Playlist now-playing indicator in Library — animated waveform icon + primary border on active `PlaylistCard`; `activePlaylistId` in useAudioStore; backward-compatible `setQueue` third param (PR #104)
- ✅ Discover Playlists now-playing indicator — pulsing waveform icon + primary border + chevron tint on active playlist row (PR #105)
- ✅ Fix `dm`/`new_episode` notification types — icons, colours, actor_id, correct routing on tap (PR #107)
- ✅ Follow notification — backend creation + frontend bell badge + tap routing (PR #108)
- ✅ Follow push notification — `_send_expo_push` called in `follow_creator` after in-app notif; 3 new `TestFollowNotification` pytest cases (PR #110)

---

## 🔀 What's open

- PR #111 `feature/like-comment-push-notifications` → Expo push on like/comment: `_send_expo_push` added after `_safe_create_notification` in `like_podcast` and `create_comment`; 6 new pytest cases (TestLikePushNotification + TestCommentPushNotification)

---

## 🐛 Known issues / tech debt

- APScheduler in multi-worker deployments (Uvicorn `--workers N`) runs one check per worker — harmless for now
- Frontend ESLint blocked repo-wide (JSX parsing). Use `node --check` + Jest until fixed.
- `expo-video` flow requires a native rebuild/dev client refresh on devices before manual QA.
- DM inbox: Python-side aggregation in `crud.get_dm_inbox` — needs SQL GROUP BY at scale
- DM: text-only, no attachments
- Sleep timer: `setInterval` — verify accuracy on real device
- Frontend unit test coverage thin
- `search_users` returns `total_likes: 0` (skipped for perf; not shown in UI)
- Creator sort is Python-side — fine at current scale, needs SQL ORDER BY subquery for large datasets
- `handlePlayRelated` queue logic in details.js has no Jest unit test coverage
- Plays-over-time chart reflects last-session-per-user-per-podcast (unique constraint); a per-event play log would enable exact daily counts
- CategoryRow progress bar has no animation — width springs would match the new bar-chart feel
- DM unread badge: polling interval added (30s, PR #103); interval duration could be extracted as a named constant if more polling loops are introduced
- `TODO_IMPROVEMENTS.md` deep-link section is stale — `volo://podcast/{id}`, `volo://live/{code}`, and `volo://playlist/{id}` are already implemented
- Bash sandbox unavailable in 2026-05-03 session (container boot failure) — all changes committed via GitHub API through browser JS

---

## 🔭 Next Session Suggestions

1. **[FRONTEND] Notification read-state badge sync** — The bell badge decrements optimistically; persist last-read timestamp to AsyncStorage so cold-start avoids badge flicker. Medium user impact, frontend-only.

2. **[BACKEND] APScheduler SQLAlchemy jobstore** — Replace in-memory `BackgroundScheduler` with a persistent jobstore so scheduled tasks survive restarts and don't double-fire under multiple Uvicorn workers. Low user impact, improves reliability.

3. **[BACKEND+FRONTEND] DM push notifications** — `send_message` creates no push at all; add `_send_expo_push` call in `crud.send_message` (sender → recipient) mirroring the now-established pattern.