# AGENT STATE -- proPod Autonomous Engineer

> Read at session START, written at session END. Persistent memory across sessions.

---

## Current State

**Last updated:** 2026-05-04
**Last session (4):** Notification badge -- lastReadTimestamp + ASCII cleanup (PR #114, 3 fix commits)
**Test suite baseline:** ~486 backend tests

**Tech stack:** React Native + Expo / FastAPI + SQLAlchemy / PostgreSQL (prod) / Zustand

> Full shipped history (PR #1--#65): see `docs/SHIPPED_ARCHIVE.md`

---

## Recently Shipped (PR #66--#113)

- DM unread badge wired end-to-end (PR #102)
- DM badge 30s polling interval (PR #103)
- Playlist now-playing indicator in Library (PR #104)
- Discover Playlists now-playing indicator (PR #105)
- Fix dm/new_episode notification types (PR #107)
- Follow notification -- backend + frontend bell badge + tap routing (PR #108)
- Follow push notification -- _send_expo_push in follow_creator (PR #110)
- Like/comment push notifications -- _send_expo_push in like_podcast and create_comment (PR #111)
- Encoding fix: restore correct UTF-8 in 32 backend files, use \uXXXX escapes (PR #112)
- DM push notifications -- _send_expo_push in send_direct_message (PR #113)

---

## What's open

- PR #114 `feature/notification-badge-last-read-timestamp` -- Persist lastReadTimestamp;
  stable cold-start badge; markAllRead() on focus; 4 new unit tests; ASCII-only fix applied.

- PR #113 `feature/dm-push-notifications` -- Expo push in send_direct_message: query DeviceToken,
  call _send_expo_push. Awaiting Fay merge.

---

## Known issues / tech debt

- APScheduler in multi-worker deployments -- harmless duplicate checks per worker
- Frontend ESLint blocked repo-wide (JSX parsing). Use `node --check` + Jest until fixed.
- `expo-video` flow requires native rebuild/dev client refresh on devices before manual QA
- DM inbox: Python-side aggregation in `crud.get_dm_inbox` -- needs SQL GROUP BY at scale
- DM: text-only, no attachments
- Sleep timer: `setInterval` -- verify accuracy on real device
- Frontend unit test coverage thin
- `search_users` returns `total_likes: 0` (skipped for perf; not shown in UI)
- Creator sort is Python-side -- fine at current scale
- `handlePlayRelated` queue logic in details.js has no Jest unit test coverage
- CategoryRow progress bar has no animation
- **Agent encoding rule:** always use `\uXXXX` / `\UXXXXXXXX` escapes for emoji in Python files
- Bash sandbox unavailable in 2026-05-03/04 sessions (container boot failure) -- use Chrome MCP + GitHub API
- **ASCII guard (MANDATORY):** call sanitizeToAscii() + countNonAscii() on every file before blob creation.
  countNonAscii() MUST return 0. Box-drawing chars (U+2500) and smart quotes must be replaced upstream,
  not left for the ? fallback. Use plain // --- for comment separators, never decorative Unicode.

---

## Next Session Suggestions

1. **[FRONTEND] DM push deep-link routing** -- Wire Expo push notification tap on a DM to open
   the correct DM thread screen. Requires checking `notification.data.type === 'dm'` in the
   Expo notification listener and calling router.push with the sender id.

2. **[BACKEND] APScheduler SQLAlchemy jobstore** -- Replace in-memory BackgroundScheduler with
   SQLAlchemy jobstore so scheduled jobs survive worker restarts in multi-worker prod deployments.

3. **[FRONTEND] Podcast share / copy-link feature** -- Add a Share button to the podcast details
   screen that calls React Native Share API with a deep-link URL. Pure frontend, high user value.
