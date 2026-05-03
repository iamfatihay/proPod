# AGENT STATE — proPod Autonomous Engineer

> Read at session START, written at session END. Persistent memory across sessions.

---

## U0001f9ed Current State

**Last updated:** 2026-05-03
**Last session (2):** Encoding fix PR #112 — scanned all 32 affected backend Python files, applied iterative double-decode to restore correct UTF-8 (emoji, arrows, em-dashes in docstrings/strings)
**Test suite baseline:** ~486 backend tests

**Tech stack:** React Native + Expo · FastAPI + SQLAlchemy · PostgreSQL (prod) / SQLite (test only)

> Full shipped history (PR #1–#65): see `docs/SHIPPED_ARCHIVE.md`

---

## ✅ Recently Shipped (PR #66–#111)

- ✅ DM unread badge wired end-to-end (PR #102)
- ✅ DM badge 30 s polling interval (PR #103)
- ✅ Playlist now-playing indicator in Library (PR #104)
- ✅ Discover Playlists now-playing indicator (PR #105)
- ✅ Fix dm/new_episode notification types (PR #107)
- ✅ Follow notification — backend + frontend bell badge + tap routing (PR #108)
- ✅ Follow push notification — _send_expo_push in follow_creator (PR #110)
- ✅ Like/comment push notifications — _send_expo_push in like_podcast and create_comment; 6 new pytest cases (PR #111)

---

## U0001f500 What's open

- PR #112 `fix/encoding-mojibake-cleanup` → Restore correct UTF-8 in 32 backend Python files: iterative double-decode removes all layers of mojibake (double/triple-encoded emoji, arrows, em-dashes) introduced by repeated atob/btoa agent commits

---

## U0001f41b Known issues / tech debt

- APScheduler in multi-worker deployments — harmless duplicate checks per worker
- Frontend ESLint blocked repo-wide (JSX parsing). Use `node --check` + Jest until fixed.
- `expo-video` flow requires native rebuild/dev client refresh on devices before manual QA.
- DM inbox: Python-side aggregation in `crud.get_dm_inbox` — needs SQL GROUP BY at scale
- DM: text-only, no attachments
- Sleep timer: `setInterval` — verify accuracy on real device
- Frontend unit test coverage thin
- `search_users` returns `total_likes: 0` (skipped for perf; not shown in UI)
- Creator sort is Python-side — fine at current scale
- `handlePlayRelated` queue logic in details.js has no Jest unit test coverage
- CategoryRow progress bar has no animation
- **Agent encoding rule:** always use `\uXXXX` / `\UXXXXXXXX` escapes for emoji in Python string literals — never raw emoji, to avoid atob/btoa double-encoding in future commits
- Bash sandbox unavailable in 2026-05-03 session (container boot failure)

---

## U0001f52d Next Session Suggestions

1. **[FRONTEND] Notification read-state badge sync** — Persist last-read timestamp to AsyncStorage so bell badge doesn't flicker on cold-start. Frontend-only, medium user impact.

2. **[BACKEND+FRONTEND] DM push notifications** — `send_message` creates no push at all; add `_send_expo_push` call in `crud.send_message` mirroring the established pattern.

3. **[BACKEND] APScheduler SQLAlchemy jobstore** — Replace in-memory `BackgroundScheduler` with persistent jobstore so scheduled tasks survive restarts.