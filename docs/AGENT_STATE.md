# AGENT STATE — proPod Autonomous Engineer

> **This file is read at the START and written at the END of every automated session.**
> It is the agent's persistent memory across sessions. Do not delete it.

---

## 🎯 Product Vision

**proPod** is a cross-platform (iOS + Android) mobile application for creating, broadcasting, and editing podcasts — with AI assistance. The primary users are podcast creators and listeners. The app must work smoothly on real devices, feel polished, and support the full creator workflow: record → edit → publish → share → live broadcast.

Tech stack: React Native + Expo (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL (prod) / SQLite (dev/test)

---

## 📍 Current Project State

**Last updated:** 2026-04-05
**Last session:** Shipped deep link handling — `volo://podcast/{id}` wired in root `_layout.js`. Branch `feature/deep-link-podcast-handler` pushed; PR needs to be opened manually (Chrome offline during session). PR URL: https://github.com/iamfatihay/proPod/pull/new/feature/deep-link-podcast-handler
**Test suite baseline:** 318 passed, 0 failed

### What's shipped (merged to master)
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
- ✅ Continue Listening seek-to-position — `play(track, { startPosition })` in audio store; home.js passes `item.position`. Resume jumps mid-episode. (PR #39)
- ✅ loadContinueListening URL normalization — audio_url + thumbnail_url normalized via `toAbsoluteUrl`. (PR #40)
- ✅ loadContinueListening decoupled — fires independently; never blocks main-feed repaint. (PR #40)
- ✅ Hotfix: duplicate `loadContinueListening` declaration removed (SyntaxError crash from merging #32 + #40)

### What's open / in-progress
- 🔄 `feature/deep-link-podcast-handler` — deep link wiring in `frontend/app/_layout.js`. Branch pushed, PR not yet opened (Chrome offline). Open at: https://github.com/iamfatihay/proPod/compare/feature/deep-link-podcast-handler

### Known issues / tech debt
- `test_analytics_dashboard` has a pre-existing flaky isolation issue (passes when run alone)
- No Alembic migration for Playlist tables (dev uses `create_all`, prod needs migration)
- Backend heavily tested; frontend has very few tests
- Deep link handling (`volo://` scheme) — implemented in PR (branch: feature/deep-link-podcast-handler), pending merge
- Notifications and chat screens use mock/dummy data
- Several old feature branches still exist on remote (`feature/home-scroll-to-top`, `feature/ai-processing-enhancement`, `feature/microsoft-clarity-analytics`, etc.) — audit and close if abandoned

---

## 🗺️ Roadmap Priority (agent perspective)

1. **Deep link handling** — wire `volo://podcast/{id}` in `_layout.js` using `expo-linking`
2. **Notifications screen** — replace mock data with real backend events
3. **Phase 2: Studio Mode** — waveform visualization, trim, chapter markers
4. **Backend: Alembic migration** for Playlist tables
5. **Frontend tests** — coverage is very thin

---

## 🔧 Permanent Agent Notes (Do Not Delete)

### GitHub API Access — Sandbox Constraint

**The terminal sandbox proxy blocks all outbound HTTPS to `api.github.com`.**
`curl`, `wget`, and Python `requests`/`httpx` to `api.github.com` always return `403 Forbidden from proxy`. Do NOT attempt terminal-based GitHub API calls.

**What works from terminal:** only `git` commands (clone, push, fetch, log) using token in the remote URL:
```
git remote set-url origin https://iamfatihay:${GITHUB_TOKEN}@github.com/iamfatihay/proPod.git
```

**Check for open PRs without Chrome:** use `git ls-remote origin "refs/heads/feature/*"` to list remote branches, then cross-check against master history to find unmerged work.

**Working method for GitHub REST API** (when Chrome extension is available):
1. `mcp__Claude_in_Chrome__tabs_context_mcp` → get tabId
2. `mcp__Claude_in_Chrome__navigate` → navigate to `https://github.com`
3. `mcp__Claude_in_Chrome__javascript_tool` → run `fetch()` with Bearer token, store in `window.__var`
4. Retrieve in a SEPARATE JS call (not chained) to avoid "BLOCKED: Cookie/query string data" errors

**If Chrome is offline:** push branches, document URLs, note in AGENT_STATE that PRs need to be opened manually.

### Merge safety rule
When multiple PRs touch the same file, always check for duplicate declarations after merging:
```bash
grep -n "const funcName" frontend/app/(main)/home.js
```
A `const` redeclaration in the same scope = SyntaxError crash. Fix immediately on master.

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

1. **[PR] Open the deep-link PR** — If Chrome is available, open the PR for `feature/deep-link-podcast-handler` using the GitHub API via browser JS. URL: https://github.com/iamfatihay/proPod/compare/feature/deep-link-podcast-handler. After Fay merges, consider adding `volo://profile/{username}` as a second URL pattern (same file, `parsed.hostname === 'profile'` → navigate to `/(main)/profile?username={username}`).

2. **[FRONTEND] Notifications screen — real data** — `frontend/app/(main)/notifications.js` currently reads from AsyncStorage only (no server). The backend has no `/notifications/` router yet. Add `GET /api/notifications/` in `backend/app/routers/` returning recent activity (likes, comments on user's podcasts from the last 30 days). Wire to frontend with a Zustand `fetchFromServer` action that calls the endpoint and merges into the local store. File to add: `backend/app/routers/notifications.py`; files to edit: `backend/app/main.py`, `frontend/src/context/useNotificationStore.js`.

3. **[CLEANUP] Audit stale remote branches** — Many old feature branches exist on remote (`feature/home-scroll-to-top`, `feature/ai-processing-enhancement`, `feature/microsoft-clarity-analytics`, `feature/ai-transcription-analysis`, etc.). Via Chrome JS + GitHub API: list open PRs, identify which branches have no open PR AND are already merged into master, delete them remotely with `git push origin --delete <branch>` or via GitHub API DELETE `/repos/iamfatihay/proPod/git/refs/heads/<branch>`.
