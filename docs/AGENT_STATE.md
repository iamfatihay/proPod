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
**Last session:** PR gap audit — all 10 merged PRs reviewed, AGENT_STATE fully synced
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
- 🔲 `feature/continue-listening-widget` — PR #33 open, awaiting merge (https://github.com/iamfatihay/proPod/pull/33)
- 🔲 Frontend: **Playlist UI** — 8 backend endpoints ready at `/playlists/`, zero apiService methods, no screens at all
- 🔲 Frontend: **Creator Analytics screen** — `GET /analytics/dashboard` untouched by frontend; home.js shows "coming soon" toast
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
| `GET /podcasts/discover/categories` | #29 | ❌ missing | ❌ hardcoded | 🟡 nice-to-have |
| `GET /podcasts/search` | old | ❌ not used | ❌ client-side only | 🟡 perf issue |
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

1. **[FRONTEND] Playlist UI** — Largest remaining gap. Backend fully ready (PR #28, 8 endpoints). Work needed:
   - Add 7 apiService methods to `frontend/src/services/api/apiService.js`: `getMyPlaylists`, `getPlaylist`, `createPlaylist`, `updatePlaylist`, `deletePlaylist`, `addToPlaylist`, `removeFromPlaylist`
   - Create `frontend/app/(main)/playlists.js` — list screen (my playlists + create button)
   - Create `frontend/app/(main)/playlist-detail.js` — detail + remove items
   - Add "Add to playlist" action sheet to `PodcastCard` long-press or details screen action menu
   - Playlists router prefix: `GET/POST /playlists/`, see `backend/app/routers/playlists.py`

2. **[FRONTEND] Creator Analytics screen** — Backend at `GET /analytics/dashboard` returns: total_podcasts, total_plays, total_likes, total_bookmarks, total_comments, avg_completion_rate, top_5_podcasts, recent_engagement, category_distribution. Work needed:
   - Add `getCreatorDashboard()` to `frontend/src/services/api/apiService.js`
   - Create `frontend/app/(main)/analytics.js` with stat cards + top podcasts list
   - Replace `showToast("Analytics coming soon!")` in `home.js handleQuickAction` case `"analytics"` with `router.push("/(main)/analytics")`

3. **[FRONTEND] Public creator profile page** — Backend `GET /users/{id}/profile` returns: name, photo_url, podcast_count, total_plays, total_likes. Work needed:
   - Add `getPublicUserProfile(userId)` and `getPublicUserPodcasts(userId, params)` to apiService
   - Create `frontend/app/(main)/creator-profile.js` screen
   - In `frontend/app/(main)/details.js` around line 668, wrap the `podcast.owner?.name` text in a `TouchableOpacity` that navigates to `/(main)/creator-profile?userId={podcast.owner_id}`
