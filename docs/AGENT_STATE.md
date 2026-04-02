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
**Last session:** Creator Analytics screen — wired GET /analytics/dashboard to full UI (PR #37, branch feature/analytics-screen)
**Test suite baseline:** 318 passed, 0 failed

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
- 🔲 `feature/continue-listening-widget` — PR #33 open, awaiting merge (https://github.com/iamfatihay/proPod/pull/33)
- 🔲 `feature/playlist-ui` — **PR #34 open** (https://github.com/iamfatihay/proPod/pull/34)
  - 7 apiService playlist methods, playlists.js list screen, playlist-detail.js, details.js "Playlist" button, library.js tab, _layout.js registration
  - Previously had Copilot review — fixes applied on that branch already
- 🔲 `feature/analytics-screen` — **PR #37 open** (https://github.com/iamfatihay/proPod/pull/37)
  - `analytics.js`: stat cards, day picker (7d/30d/90d/1yr), recent delta, top-5 episodes, category bars, pull-to-refresh, empty state
  - `apiService.getCreatorDashboard(days)` method added
  - `home.js` analytics quick-action now routes to screen instead of toast
  - `_layout.js` registers analytics as hidden route
- 🔲 Frontend: **Deep link handling** — `volo://podcast/{id}` generated in details.js but `_layout.js` has no `expo-linking` setup
- 🔲 Frontend: **Public creator profiles** — `GET /users/{id}/profile` and `GET /users/{id}/podcasts` have no apiService methods; details.js shows owner name but no tap-to-profile navigation
- 🔲 Frontend: **Discover categories from API** — home.js hardcodes `CATEGORIES` array; should fetch from `GET /podcasts/discover/categories`
- 🔲 Frontend: **Search uses backend** — search.js uses `SemanticSearchService` which fetches all podcasts locally; backend `GET /podcasts/search?query=` endpoint exists but is never called

### Known issues / tech debt
- `test_analytics_dashboard` has a pre-existing flaky isolation issue (passes when run alone)
- No Alembic migration for Playlist tables (dev uses `create_all`, prod needs migration)
- Backend heavily tested; frontend has very few tests
- `SemanticSearchService` fetches up to 100 podcasts client-side for search — should delegate to backend `/podcasts/search` for scalability
- Profile screen only shows own profile (`useAuthStore`); no public creator profile view for other users
- Notifications screen and chat screens appear to use mock/dummy data
- Playlist add-item: backend returns HTTP 400 "Podcast already in playlist" on duplicate; frontend (PR #34) surfaces this as a toast — verify on device
- Analytics `average_completion_rate` is a float 0.0–1.0 from backend; displayed as `pct()` percentage — if backend unit ever changes, update helper

---

## 🔍 Backend → Frontend Gap Map (as of 2026-04-02)

| Backend endpoint | PR | apiService method | Screen/UI | Gap? |
|---|---|---|---|---|
| `POST /users/login` | — | `login()` | login screen | ✅ wired |
| `GET /users/me` | — | `getMe()` | auth store | ✅ wired |
| `GET /users/{id}/profile` | #24 | ❌ missing | ❌ no screen | 🔴 GAP |
| `GET /users/{id}/podcasts` | #24 | ❌ missing | ❌ no screen | 🔴 GAP |
| `GET /analytics/dashboard` | #25 | ✅ in PR #37 | ✅ in PR #37 | 🟡 open PR |
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
| `GET /sharing/podcast/{id}` deep link | #26 | generates link only | ❌ `_layout.js` not wired | 🔴 GAP |

---

## 🗺️ Roadmap Priority (agent perspective)

These are the areas that move the **user-facing product** forward most. Prefer these over backend-only work.

1. **Frontend: Connect existing backend features to UI** ← primary focus
   - ~~Continue Listening widget~~ → in PR #33
   - ~~Playlist screens~~ → in PR #34 (awaiting merge)
   - ~~Creator analytics screen~~ → in PR #37 (awaiting merge)
   - Public creator profile page — tap owner name → `GET /users/{id}/profile`
   - Deep link handling in `_layout.js` — `volo://podcast/{id}`

2. **Search efficiency**
   - Replace client-side `SemanticSearchService` with backend `GET /podcasts/search?query=`

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

1. **[FRONTEND] Public creator profile page** — The last major backend→frontend gap with no UI at all. Backend `GET /users/{id}/profile` returns: `id, name, photo_url, podcast_count, total_plays, total_likes`. Work needed:
   - Add `getPublicUserProfile(userId)` and `getPublicUserPodcasts(userId, params)` to `frontend/src/services/api/apiService.js`
   - Create `frontend/app/(main)/creator-profile.js` — profile header (avatar, name, stats) + FlatList of their public podcasts
   - In `frontend/app/(main)/details.js` around the owner name text (~line 668 in current master), wrap it in a `TouchableOpacity` that calls `router.push({ pathname: '/(main)/creator-profile', params: { userId: podcast.owner_id } })`
   - Register `creator-profile` as a hidden route in `_layout.js` (same pattern as `analytics`)

2. **[FRONTEND] Deep link handling** — `volo://podcast/{id}` links are generated in `details.js` Share sheet but never handled on app open. Work needed:
   - Install/configure `expo-linking` in `app.json` with scheme `volo`
   - In `frontend/app/(main)/_layout.js`, add a `Linking.addEventListener('url', ...)` (or `useLinking`) listener that parses `volo://podcast/{id}` and calls `router.push({ pathname: '/(main)/details', params: { id } })`
   - Test with `npx uri-scheme open volo://podcast/1 --android` and `--ios`

3. **[FRONTEND] Replace client-side search with backend** — `search.js` currently loads up to 100 podcasts and filters locally via `SemanticSearchService`. Backend `GET /podcasts/search?query=&skip=&limit=` already exists and is paginated. Work needed:
   - Add `searchPodcasts(query, params)` to `frontend/src/services/api/apiService.js` calling `GET /podcasts/search?query={q}&limit=20`
   - In `frontend/app/(main)/search.js`, replace the `SemanticSearchService.search()` call with `apiService.searchPodcasts(query)` — results shape is already `{ podcasts: [...], total, ... }` matching existing render logic
   - Remove or mark `SemanticSearchService` as deprecated
