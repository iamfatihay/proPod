# AGENT STATE â proPod Autonomous Engineer

> Read at session START, written at session END. Persistent memory across sessions.

---

## U0001f9ed Current State

**Last updated: 2026-05-04
**Last session (3):** DM push notifications PR #113 â added _send_expo_push in send_direct_message (query DeviceToken for recipient, type="dm" payload); 3 new tests in TestDMPushNotification. Bash sandbox down again.
**Test suite baseline:** ~486 backend tests

**Tech stack:** React Native + Expo Â· FastAPI + SQLAlchemy Â· PostgreSQL (prod) / SQLite (test only)

> Full shipped history (PR #1â#65): see `docs/SHIPPED_ARCHIVE.md`

---

## â Recently Shipped (PR #66â#111)

- â DM unread badge wired end-to-end (PR #102)
- â DM badge 30 s polling interval (PR #103)
- â Playlist now-playing indicator in Library (PR #104)
- â Discover Playlists now-playing indicator (PR #105)
- â Fix dm/new_episode notification types (PR #107)
- â Follow notification â backend + frontend bell badge + tap routing (PR #108)
- â Follow push notification â _send_expo_push in follow_creator (PR #110)
- â Like/comment push notifications â _send_expo_push in like_podcast and create_comment; 6 new pytest cases (PR #111)
â Encoding fix: restore correct UTF-8 in 32 backend files, use \uXXXX escapes (PR #112)

---

## U0001f500 What's open

- PR #114 `feature/notification-badge-last-read-timestamp` — Persist lastReadTimestamp; badge stable on cold-start; useFocusEffect resets badge on screen focus

- PR #113 `feature/dm-push-notifications` â Expo push in send_direct_message: query DeviceToken for recipient, call _send_expo_push with type="dm" payload; 3 tests in TestDMPushNotification (test_notifications.py)

---

## U0001f41b Known issues / tech debt

- APScheduler in multi-worker deployments â harmless duplicate checks per worker
- Frontend ESLint blocked repo-wide (JSX parsing). Use `node --check` + Jest until fixed.
- `expo-video` flow requires native rebuild/dev client refresh on devices before manual QA.
- DM inbox: Python-side aggregation in `crud.get_dm_inbox` â needs SQL GROUP BY at scale
- DM: text-only, no attachments
- Sleep timer: `setInterval` â verify accuracy on real device
- Frontend unit test coverage thin
- `search_users` returns `total_likes: 0` (skipped for perf; not shown in UI)
- Creator sort is Python-side â fine at current scale
- `handlePlayRelated` queue logic in details.js has no Jest unit test coverage
- CategoryRow progress bar has no animation
- **Agent encoding rule:** always use `\uXXXX` / `\UXXXXXXXX` escapes for emoji in Python string literals â never raw emoji, to avoid atob/btoa double-encoding in future commits
- Bash sandbox unavailable in 2026-05-03 session (container boot failure)

---

## 🔭 Next Session Suggestions

1. **[BACKEND] APScheduler SQLAlchemy jobstore** — Replace in-memory `BackgroundScheduler` with persistent jobstore so scheduled tasks survive restarts. Medium complexity, high reliability impact.

2. **[FRONTEND] DM push deep-link routing** — Wire Expo push notification tap on a DM to navigate directly to `chat-details` screen. Builds on PR #113 once merged.

3. **[FRONTEND] Notification badge unit tests** — Add Zustand store tests for `markAllRead()` and timestamp-based `unreadCount` derivation from PR #114.
