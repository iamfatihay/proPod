# AGENT STATE — proPod Autonomous Engineer

> **This file is read at the START and written at the END of every automated session.**
> It is the agent's persistent memory across sessions. Do not delete it.

---

## 🎯 Product Vision

**proPod** is a cross-platform (iOS + Android) mobile application for creating, broadcasting, and editing podcasts — with AI assistance. The primary users are podcast creators and listeners. The app must work smoothly on real devices, feel polished, and support the full creator workflow: record → edit → publish → share → live broadcast.

Tech stack: React Native + Expo (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL (prod) / SQLite (dev/test)

---

## 📍 Current Project State

**Last updated:** 2026-04-02
**Last session:** Wired backend search + dynamic categories — branch `feature/backend-search-and-categories`, PR #38
**Test suite baseline:** 293 passed, 0 failed

### What's shipped (merged to master)
- ✅ Auth (login, register, Google OAuth, forgot/reset password) — fully wired
- ✅ Podcast CRUD (create, edit, delete, list, search) — fully wired
- ✅ Audio playback + listening history update — fully wired
- ✅ Like, bookmark, comments — fully wired
- ✅ AI transcription/keywords/summary — shown in details screen (PR #22-ish)
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
- 🔲 `feature/continue-listening-widget` — PR #33 open (https://github.com/iamfatihay/proPod/pull/33)
- 🔲 `feature/continue-listening-ui` — PR #32 open (duplicate of #33 — one should be closed)
- 🔲 `feature/playlist-ui` — PR #34 open (https://github.com/iamfatihay/proPod/pull/34)
- 🔲 `feature/creator-analytics-screen` — PR #35 open (https://github.com/iamfatihay/proPod/pull/35)
- 🔲 `feature/public-creator-profile` — PR #36 open (https://github.com/iamfatihay/proPod/pull/36)
- 🔲 `feature/analytics-screen` — PR #37 open (duplicate of #35 — one should be closed)
- 🔲 `feature/backend-search-and-categories` — PR #38 open (https://github.com/iamfatihay/proPod/pull/38)
- 🔲 Frontend: **Deep link handling** — `volo://podcast/{id}` generated in details.js but `_layout.js` has no `expo-linking` setup

### Known issues / tech debt
- `test_analytics_dashboard` has a pre-existing flaky isolation issue (passes when run alone)
- No Alembic migration for Playlist tables (dev uses `create_all`, prod needs migration)
- Backend heavily tested; frontend has very few tests
- Search transcription mode still uses client-side SemanticSearchService (no backend transcript-search endpoint)
- Search results not paginated — search.js fetches limit=50 and shows all; needs "load more" for large results
- Category list not cached — `getDiscoverCategories()` fetched fresh on every Home mount; a Zustand store would avoid redundant calls
- Duplicate open PRs: #32 vs #33 (continue-listening), #35 vs #37 (analytics) — one of each pair should be closed
- Profile screen only shows own profile (`useAuthStore`); no public creator profile view for other users
- Notifications screen and chat screens appear to use mock/dummy data

---

## 🔍 Backend → Frontend Gap Map (as of 2026-04-01)

| Backend endpoint | PR | apiService method | Screen/UI | Gap? |
|---|---|---|---|---|
| `POST /users/login` | — | `login()` | login screen | ✅ wired |
| `GET /users/me` | — | `getMe()` | auth store | ✅ wired |
| `GET /users/{id}/profile` | #24 | ❌ missing | ❌ no screen | 🔴 GAP |
| `GET /users/{id}/podcasts` | #24 | ❌ missing | ❌ no screen | 🔴 GAP |
| `GET /analytics/dashboard` | #25 | ❌ missing | ❌ "coming soon" toast | 🔴 GAP |
| `GET /podcasts/my/continue-listening` | #27 | ✅ in PR #33 | ✅ in PR #33 | 🟡 open PR |
| `POST /playlists/` | #28 | ❌ missing | ❌ no screen | 🔴 GAP |
| `GET /playlists/my` | #28 | ❌ missing | ❌ no screen | 🔴 GAP |
| `GET /playlists/{id}` | #28 | ❌ missing | ❌ no screen | 🔴 GAP |
| `PUT /playlists/{id}` | #28 | ❌ missing | ❌ no screen | 🔴 GAP |
| `DELETE /playlists/{id}` | #28 | ❌ missing | ❌ no screen | 🔴 GAP |
| `POST /playlists/{id}/items` | #28 | ❌ missing | ❌ no screen | 🔴 GAP |
| `DELETE /playlists/{id}/items/{pod}` | #28 | ❌ missing | ❌ no screen | 🔴 GAP |
| `GET /podcasts/discover/categories` | #29 | ✅ `getDiscoverCategories()` in PR #38 | ✅ home.js in PR #38 | 🟡 open PR |
| `GET /podcasts/search` | old | ✅ `searchPodcasts()` in PR #38 | ✅ search.js in PR #38 | 🟡 open PR |
| `GET /sharing/podcast/{id}` deep link | #26 | generates link only | ❌ `_layout.js` not wired | 🔴 GAP |

---

## 🗺️ Roadmap Priority (agent perspective)

These are the areas that move the **user-facing product** forward most. Prefer these over backend-only work.

1. **Frontend: Connect existing backend features to UI** ← primary focus
   - ~~Continue Listening widget~~ → in PR #33
   - Playlist screens (create, list, detail, add-to-playlist action) — biggest gap, 0% done
   - Creator analytics screen — `GET /analytics/dashboard` → charts + stats
   - Public creator profile page — tap owner name → `GET /users/{id}/profile`
   - Deep link handling in `_layout.js` — `volo://podcast/{id}`

2. **Search efficiency**
   - ~~Replace client-side `SemanticSearchService` with backend `GET /podcasts/search?query=`~~ → in PR #38
   - Transcription search still client-side; needs backend endpoint

3. **Phase 2: Studio Mode** (from FEATURE_ROADMAP.md)
   - Basic audio waveform visualization
   - Trim start/end
   - Chapter markers

4. **Phase 1 remaining: AI features in frontend**
   - AI processing state (loading, done, error) in create flow
   - ~~Transcription in details screen~~ → already shown (PR #22+)

5. **Live Broadcasting (RTC)**
   - Several branches exist (`feature/rtc-phase2-*`) — review and resume

6. **Backend features still missing**
   - Push notifications (expo-notifications integration)
   - Alembic migration for Playlist tables
   - Follow/unfollow users (total_followers placeholder exists in schema)

7. **Polish & cross-platform**
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

1. **[CLEANUP] Close duplicate PRs** — PRs #32 and #35 are earlier drafts of #33 and #37 respectively. Before opening new work, close the duplicates so the merge queue is clean. Use GitHub API (browser JS) to close them:
   ```js
   fetch('https://api.github.com/repos/iamfatihay/proPod/pulls/32', {method:'PATCH', headers:{Authorization:'Bearer TOKEN','Content-Type':'application/json'}, body: JSON.stringify({state:'closed'})})
   ```
   Then pick the best of each pair (compare diff sizes) and ensure it's ready to merge.

2. **[FRONTEND] Deep link handling** — `volo://podcast/{id}` is already generated in `details.js` share sheet but `_layout.js` has zero `expo-linking` setup. Users who tap a shared link land on the home screen. Work needed:
   - Add `expo-linking` config to `frontend/app/_layout.js` with scheme `volo` and path `podcast/:id`
   - Add a `useEffect` that reads the initial URL on mount and navigates to `/(main)/details?id=X`
   - Subscribe to `Linking.addEventListener('url', ...)` for foreground deep links
   - Test: open `volo://podcast/1` in simulator

3. **[FRONTEND] Cache categories in Zustand** — `getDiscoverCategories()` is called on every Home screen mount (including focus events). Caching in a lightweight Zustand store (similar to `useNotificationStore`) would eliminate redundant network calls. Work needed:
   - Create `frontend/src/context/useCategoryStore.js` with `categories`, `loadCategories()`, `isLoaded` fields
   - Replace the `useEffect` in `home.js` with a store action call
   - This also lets `search.js` show a category filter dropdown populated from the same store without an extra API call
