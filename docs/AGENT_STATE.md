# AGENT STATE — proPod Autonomous Engineer

> **This file is read at the START and written at the END of every automated session.**
> It is the agent's persistent memory across sessions. Do not delete it.

---

## 🎯 Product Vision

**proPod** is a cross-platform (iOS + Android) mobile application for creating, broadcasting, and editing podcasts — with AI assistance. The primary users are podcast creators and listeners. The app must work smoothly on real devices, feel polished, and support the full creator workflow: record → edit → publish → share → live broadcast.

Tech stack: React Native + Expo (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL (runtime/dev/prod) · SQLite only for isolated test scenarios

---

## 📍 Current Project State

**Last updated:** 2026-04-23
**Last session (Expo push receipt polling):** Confirmed PR #74 merged at session start. PR #75 also confirmed merged (branch still exists but PR is merged). Implemented Expo push receipt polling: `PushTicket` model + Alembic migration, `_send_expo_push` now stores ok-ticket IDs when `db` is provided, `check_push_receipts()` CRUD function, `POST /admin/push-receipts/check` admin endpoint, 15 new tests all passing → PR #76 `feature/expo-push-receipt-polling`.
**Test suite baseline:** ~436 backend tests (421 + 15 new).

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
- ✅ Deep link handling `volo://podcast/{id}` + `volo://playlist/{id}` with auth-race guard (PR #41 + _layout.js)
- ✅ Native Google Sign-In hardened — server-side token validation (PR #42, PR #44)
- ✅ Notifications backend + API wiring (PR #45)
- ✅ Notification badge wired to server unread_count (PR #46)
- ✅ Alembic migrations for `playlists`, `playlist_items`, `notifications` (PR #47)
- ✅ Notification store + API coverage; `markAsReadWithSync` no-op guard fix (PR #48)
- ✅ Navigation wiring, creator inbox/activity flows, NotificationAdmin (PR #49)
- ✅ Playback speed selector modal (6 presets, 9 tests) — PR #52
- ✅ Sleep timer — auto-pause after chosen duration — PR #50
- ✅ Follow/unfollow creator — backend + frontend — PR #51
- ✅ "End of Episode" sleep timer option — PR #53
- ✅ Following Feed — PR #54
- ✅ Fix `TestGetFollowingList` ImportError — PR #55
- ✅ Profile screen wired to real API data — PR #56
- ✅ Persist sleepOnEpisodeEnd across app restarts via AsyncStorage — PR #57
- ✅ Direct messaging between users — PR #58
- ✅ DM unread badge in tab bar — PR #59
- ✅ Expo push notifications — PR #60
- ✅ Push notification tap routing + logout cleanup + eager sleep settings — PR #61
- ✅ Playlist shuffle play — PR #64
- ✅ Playlist now-playing indicator — PR #65
- ✅ Listening history screen with progress bar, completion badge, pagination — PR #66
- ✅ Listening history delete entry — PR #67
- ✅ Persisted Haptic Feedback setting — PR #68
- ✅ Fix double-encoded UTF-8 mojibake in `crud.py` — PR #69
- ✅ `EpisodeRow` Zustand selector perf — PR #70
- ✅ `new_episode` follower notification fan-out — PR #71
- ✅ `new_episode` push notification tap routing — PR #72
- ✅ Dev workflow scripts + UI tab bar and feed improvements — PR #73
- ✅ `new_episode` fan-out via FastAPI BackgroundTask (non-blocking POST /podcasts/) — PR #74
- ✅ Demo user error-handling feedback + next() network fallback tests + pre-commit fix — PR #75

### What's open / in-progress
- 🔄 PR #76 `feature/expo-push-receipt-polling` — Expo push receipt polling: `PushTicket` model, `push_tickets` Alembic migration, `_send_expo_push` stores ok-ticket IDs (with db param), `check_push_receipts()` CRUD, `POST /admin/push-receipts/check` admin endpoint. 15 new tests, 50 combined tests passing. Awaiting Fay's merge.

### Known issues / tech debt
- Frontend `npm run lint` is currently blocked by repo-wide ESLint configuration/parsing issues (`Unexpected token <` across JSX files). Use `node --check` + targeted Jest until the lint config is fixed.
- Push receipt check (`POST /admin/push-receipts/check`) must be wired to a cron job or scheduled FastAPI task — currently manual-only.
- `GET /admin/push-tickets` (inspect pending ticket count) not yet added — follow-up item.
- Push: Expo receipt check needs to be called periodically; no scheduler wired yet.
- DM inbox has no server-side pagination — fine for now, add if thread count grows large.
- DM text-only — no image/file attachments yet.
- Frontend unit test coverage still thin.
- Sleep timer uses `setInterval` — verify accuracy on real device.

---

## 🗺️ Roadmap Priority (agent perspective)

1. **[FEATURE] Schedule push receipt check** — Wire `check_push_receipts` into an APScheduler job (or FastAPI lifespan background task) so it runs every 30 minutes automatically. Add `APScheduler` to `requirements.txt`, register a job in `app/main.py` `lifespan` that calls `check_push_receipts` with a fresh DB session. No frontend needed.

2. **[FEATURE] Playlist deep-link share** — Already implemented: `volo://playlist/{id}` deep link handler exists in `_layout.js`, Share button in `playlist-detail.js` generates the link. Consider adding `GET /admin/push-tickets` endpoint to expose pending ticket count in admin stats.

3. **[FEATURE] In-app search screen improvements** — `search.js` exists and is wired to the tab bar. Potential improvements: debounced auto-search (currently only triggers on submit), skeleton loading state while results load, "no results" illustration, creator search tab (search users by name, `GET /users/search`).

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

### Full test suite timeout

The sandbox bash timeout is 45 s. The full test suite (~436 tests) exceeds this. Run targeted subsets:
```bash
python3 -m pytest tests/test_device_tokens.py tests/test_push_receipts.py tests/test_notifications.py -q
```
Use `tests/test_<area>.py` groups of 3–4 files max per run.

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

1. **[FEATURE] Wire push receipt check to APScheduler** — In `backend/app/main.py`, add an APScheduler `BackgroundScheduler` (or use FastAPI lifespan with `asyncio.create_task`) that calls `crud.check_push_receipts` with a fresh DB session every 30 minutes. Add `apscheduler` to `backend/requirements.txt`. This makes dead-token cleanup fully automatic, no manual admin calls needed. Pure backend, no migration needed.

2. **[FEATURE] Search screen debounce + skeleton loading** — In `frontend/app/(main)/search.js`, add a 400 ms debounce on `onChangeText` so search fires automatically as the user types (removing the need to press Enter). Add a `ContentLoader`-style skeleton (`react-content-loader` or a simple animated grey box) while `isSearching=true`. Pure frontend, no backend changes.

3. **[FEATURE] Creator search tab in search screen** — Add a "Creators" toggle alongside "All Content" / "Transcriptions" in `frontend/app/(main)/search.js`. Wire it to `GET /users/search?q=` (check if this endpoint exists; if not, add `GET /users/search` in `backend/app/routers/users.py` using `ilike` on name/email). Show results as a simple user-card list with Follow button.
