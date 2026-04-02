# AGENT STATE — proPod Autonomous Engineer

> **This file is read at the START and written at the END of every automated session.**
> It is the agent's persistent memory across sessions. Do not delete it.

---

## 🎯 Product Vision

**proPod** is a cross-platform (iOS + Android) mobile application for creating, broadcasting, and editing podcasts — with AI assistance. The primary users are podcast creators and listeners. The app must work smoothly on real devices, feel polished, and support the full creator workflow: record → edit → publish → share → live broadcast.

Tech stack: React Native + Expo (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL (prod) / SQLite (dev/test)

---

## 📍 Current Project State

**Last updated:** 2026-04-01
**Last session:** Public creator profile screen — tap creator name in details to view profile + episodes (PR #36) on branch `feature/public-creator-profile`
**Test suite baseline:** 293 passed, 0 failed

### What's shipped (merged to master)
- ✅ Auth (login, register, Google OAuth, forgot/reset password) — fully wired
- ✅ Podcast CRUD (create, edit, delete, list, search) — fully wired
- ✅ Audio playback + listening history update — fully wired
- ✅ Like, bookmark, comments — fully wired
- ✅ AI transcription/keywords/summary — shown in details screen
- ✅ Audio performance optimizations (non-blocking playback)
- ✅ Library screen (my podcasts / liked / bookmarked tabs)
- ✅ Trending, recommended, related — apiService methods exist
- ✅ Public user profiles with aggregate stats backend — `GET /users/{id}/profile` + `GET /users/{id}/podcasts` (PR #24)
- ✅ Creator analytics dashboard backend — `GET /analytics/dashboard` (PR #25)
- ✅ Continue-listening endpoint — `GET /podcasts/my/continue-listening` (PR #27)
- ✅ Podcast playlist system — full CRUD backend at `/playlists/` (PR #28)
- ✅ Discover/categories endpoint — `GET /podcasts/discover/categories` (PR #29)
- ✅ Bug fixes: comment stats sync, sharing cover_image_url, test isolation (PRs #26, #30, #31)

### What's open / in-progress
- 🔲 `feature/continue-listening-widget` — PR #33 open, awaiting merge
- 🔲 `feature/continue-listening-ui` — PR #32 open (older version, superseded by #33)
- 🔲 `feature/playlist-ui` — PR #34 open, awaiting merge
- 🔲 `feature/creator-analytics-screen` — PR #35 open, awaiting merge
- 🔲 `feature/public-creator-profile` — PR #36 open, awaiting merge
  - New screen `creator-profile.js`: avatar, stats row, paginated episode list
  - Details.js: owner name tappable for non-owners → navigates to creator profile
  - apiService: `getPublicUserProfile(userId)` + `getPublicUserPodcasts(userId, params)` added
  - `_layout.js`: `creator-profile` registered as non-tab route
- 🔲 Frontend: **Deep link handling** — `volo://podcast/{id}` generated in details.js but root `_layout.js` has no `expo-linking` setup
- 🔲 Frontend: **Discover categories from API** — home.js hardcodes `CATEGORIES` array; should fetch from `GET /podcasts/discover/categories`
- 🔲 Frontend: **Search uses backend** — search.js uses `SemanticSearchService` which fetches all podcasts locally; backend `GET /podcasts/search?query=` endpoint exists but is never called

### Known issues / tech debt
- `test_analytics_dashboard` has a pre-existing flaky isolation issue (passes when run alone)
- No Alembic migration for Playlist tables (dev uses `create_all`, prod needs migration)
- Backend heavily tested; frontend has very few tests
- `SemanticSearchService` fetches up to 100 podcasts client-side for search — should delegate to backend `/podcasts/search` for scalability
- Notifications screen and chat screens appear to use mock/dummy data
- Creator profile only reachable from details screen; not yet surfaced in search results or home cards
- Follow/unfollow button not yet implemented (`total_followers` placeholder exists in backend schema)
- Frontend Jest suite fails in sandbox with `@babel/preset-env` missing — pre-existing environment issue, not a code problem

---

## 🔍 Backend → Frontend Gap Map (as of 2026-04-01)

| Backend endpoint | PR | apiService method | Screen/UI | Gap? |
|---|---|---|---|---|
| `POST /users/login` | — | `login()` | login screen | ✅ wired |
| `GET /users/me` | — | `getMe()` | auth store | ✅ wired |
| `GET /users/{id}/profile` | #24 | ✅ `getPublicUserProfile()` (PR #36) | ✅ `creator-profile.js` (PR #36) | 🟡 open PR |
| `GET /users/{id}/podcasts` | #24 | ✅ `getPublicUserPodcasts()` (PR #36) | ✅ `creator-profile.js` (PR #36) | 🟡 open PR |
| `GET /analytics/dashboard` | #25 | ✅ in PR #35 | ✅ in PR #35 | 🟡 open PR |
| `GET /podcasts/my/continue-listening` | #27 | ✅ in PR #33 | ✅ in PR #33 | 🟡 open PR |
| `POST /playlists/` | #28 | ✅ in PR #34 | ✅ in PR #34 | 🟡 open PR |
| `GET /playlists/my` | #28 | ✅ in PR #34 | ✅ in PR #34 | 🟡 open PR |
| `GET /playlists/{id}` | #28 | ✅ in PR #34 | ✅ in PR #34 | 🟡 open PR |
| `PUT /playlists/{id}` | #28 | ✅ in PR #34 | ✅ in PR #34 | 🟡 open PR |
| `DELETE /playlists/{id}` | #28 | ✅ in PR #34 | ✅ in PR #34 | 🟡 open PR |
| `POST /playlists/{id}/items` | #28 | ✅ in PR #34 | ✅ in PR #34 | 🟡 open PR |
| `DELETE /playlists/{id}/items/{pod}` | #28 | ✅ in PR #34 | ✅ in PR #34 | 🟡 open PR |
| `GET /podcasts/discover/categories` | #29 | ❌ missing | ❌ hardcoded | 🟡 nice-to-have |
| `GET /podcasts/search` | old | ❌ not used | ❌ client-side only | 🟡 perf issue |
| `GET /sharing/podcast/{id}` deep link | #26 | generates link only | ❌ root `_layout.js` not wired | 🔴 GAP |

---

## 🗺️ Roadmap Priority (agent perspective)

1. **Frontend: Connect remaining backend features to UI** ← primary focus
   - ~~Continue Listening widget~~ → in PR #33
   - ~~Playlist screens~~ → in PR #34
   - ~~Creator analytics screen~~ → in PR #35
   - ~~Public creator profile page~~ → in PR #36
   - Deep link handling in root `_layout.js` — `volo://podcast/{id}` via expo-linking
   - Discover categories from API (remove hardcoded CATEGORIES array in home.js)
   - Search: replace client-side SemanticSearchService with backend `/podcasts/search`

2. **Phase 2: Studio Mode** (from FEATURE_ROADMAP.md)
   - Basic audio waveform visualization, trim start/end, chapter markers

3. **Phase 1 remaining: AI features in frontend**
   - AI processing state (loading, done, error) in create flow

4. **Live Broadcasting (RTC)**
   - Several branches exist (`feature/rtc-phase2-*`) — review and resume

5. **Backend features still missing**
   - Push notifications, Alembic migration for Playlist tables, follow/unfollow users

6. **Polish & cross-platform**
   - Lock screen controls, background playback, offline mode

---

## ⛔ Hard Rules (Never Break These)

- **Never add co-author lines to commits.** Do not include `Co-Authored-By:` or any self-attribution in commit messages, ever.
- Commit messages belong solely to the human developer.

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

1. **[FRONTEND] Deep link handling in root `_layout.js`** — `volo://podcast/{id}` URLs are already generated and shared via the Share action in details.js, but opening them does nothing because the root `frontend/app/_layout.js` has no `expo-linking` config. Work needed:
   - Confirm `expo-linking` is in package.json (it ships with Expo, likely already available)
   - In `frontend/app/_layout.js`, configure `expo-router`'s linking to handle `volo://podcast/:id` → navigate to `/(main)/details?id=:id`
   - The Expo Router docs pattern: export a `linking` config object and pass it to the root `<Stack>`
   - Test by calling: `npx uri-scheme open "volo://podcast/1" --ios`

2. **[FRONTEND] Replace hardcoded CATEGORIES in `home.js` with API data** — `home.js` has a top-level `const CATEGORIES = [...]` array. Replace with a `useEffect` that calls a new `apiService.getDiscoverCategories()` method → `GET /podcasts/discover/categories`. The endpoint returns `{ categories: [{name, podcast_count, cover_image_url}] }`. Render category cover images instead of placeholder icons. File: `frontend/app/(main)/home.js`, method insertion in `frontend/src/services/api/apiService.js`.

3. **[FRONTEND] Replace client-side search with backend endpoint** — `frontend/app/(main)/search.js` uses `SemanticSearchService.search()` which fetches up to 100 podcasts and filters locally. Replace with `GET /podcasts/search?query=&category=&sort_by=` via a new `apiService.searchPodcasts(query, filters)` method. This eliminates the 100-podcast cap and makes search scale correctly. Files: `frontend/app/(main)/search.js`, `frontend/src/services/api/apiService.js`.
