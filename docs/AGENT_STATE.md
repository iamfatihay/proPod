# AGENT STATE — proPod Autonomous Engineer

> **This file is read at the START and written at the END of every automated session.**
> It is the agent's persistent memory across sessions. Do not delete it.

---

## 🎯 Product Vision

**proPod** is a cross-platform (iOS + Android) mobile application for creating, broadcasting, and editing podcasts — with AI assistance. The primary users are podcast creators and listeners. The app must work smoothly on real devices, feel polished, and support the full creator workflow: record → edit → publish → share → live broadcast.

Tech stack: React Native + Expo (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL (prod) / SQLite (dev/test)

---

## 📍 Current Project State

**Last updated:** 2026-03-31
**Last session:** Test isolation fix — `fix/test-sharing-db-scope-leak` (awaiting PR)
**Test suite baseline:** 293 passed, 0 failed

### What's shipped (merged to master)
- ✅ AI transcription & content analysis (Phase 1 backend)
- ✅ Audio performance optimizations (non-blocking playback)
- ✅ Public user profiles with creator stats
- ✅ Creator analytics dashboard
- ✅ Continue-listening / resume playback endpoint
- ✅ Podcast sharing pages (web OG cards + deep link backend)
- ✅ Podcast playlist system (full CRUD + 32 tests)
- ✅ Bug fixes: comment stats sync, sharing cover_image_url, test isolation

### What's open / in-progress
- 🔲 `fix/test-sharing-db-scope-leak` — pushed, PR not yet opened (Chrome was unavailable)
- 🔲 Frontend: **Continue Listening UI** — backend endpoint exists (`/users/me/continue-listening`), no frontend screen yet
- 🔲 Frontend: **Playlist UI** — backend is complete, no frontend screens yet
- 🔲 Frontend: **Creator Analytics screen** — backend is complete, no frontend yet
- 🔲 Frontend: **Deep link handling** (`volo://` scheme) — backend ready, frontend `_layout.js` not wired

### Known issues / tech debt
- `test_analytics_dashboard` has a pre-existing flaky isolation issue (passes when run alone)
- No Alembic migration for Playlist tables (dev uses `create_all`, prod needs migration)
- Backend heavily tested; frontend has very few tests

---

## 🗺️ Roadmap Priority (agent perspective)

These are the areas that move the **user-facing product** forward most. Prefer these over backend-only work.

1. **Frontend: Connect existing backend features to UI**
   - Continue Listening widget on Home screen
   - Playlist screens (create, view, add podcast to playlist)
   - Creator analytics screen (charts, stats)
   - Sharing: wire deep link handler in `_layout.js`

2. **Phase 2: Studio Mode** (from FEATURE_ROADMAP.md)
   - Basic audio waveform visualization
   - Trim start/end
   - Chapter markers

3. **Phase 1 remaining: AI features in frontend**
   - Show transcription in podcast details screen
   - AI processing state (loading, done, error) in create flow

4. **Live Broadcasting (RTC)**
   - Several branches exist (`feature/rtc-phase2-*`) — review and resume

5. **Backend features still missing**
   - Search endpoint with Elasticsearch or SQLite FTS
   - Push notifications (expo-notifications integration)
   - Alembic migration for Playlist tables

6. **Polish & cross-platform**
   - Lock screen / notification controls for audio playback (iOS + Android)
   - Background playback improvements
   - Offline mode (downloaded podcasts)

---

## 🧠 Agent Instructions: How to Use This File

### At session START
1. Read this file completely before doing anything else
2. Check "What's open / in-progress" — resume if something is blocked or half-done
3. Check "Next session suggestions" below
4. Run `git log --oneline -10` to catch any changes made outside this agent
5. Confirm test suite still green before starting new work

### At session END
Update the following sections:
- **Last updated** date
- **What's shipped** — add anything merged
- **What's open** — add your branch/PR, remove completed items
- **Known issues** — add anything discovered
- **Next session suggestions** — write 3 concrete, actionable task suggestions ranked by user impact

---

## 💡 Next Session Suggestions

*(Ranked by user-facing impact — pick #1 unless blocked)*

1. **[FRONTEND] Continue Listening widget on Home screen** — The `/users/me/continue-listening` endpoint is live and tested. Wire it into `frontend/app/(main)/home.js` as a horizontal scroll row. Show thumbnail, title, progress bar, and "resume" button. High user impact, backend is done.

2. **[FRONTEND] Playlist screens** — Backend is fully shipped (PR #28). Create `frontend/app/(main)/playlists.js` (list view) and a playlist detail screen. Add an "Add to playlist" action on podcast cards. This is a complete, shippable feature.

3. **[PR] Open the pending test isolation PR** — Branch `fix/test-sharing-db-scope-leak` is pushed but PR wasn't opened (Chrome was unavailable). Open it via the browser JS fetch method.
