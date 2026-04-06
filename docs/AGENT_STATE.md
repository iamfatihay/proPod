# AGENT STATE — proPod Autonomous Engineer

> **This file is read at the START and written at the END of every automated session.**
> It is the agent's persistent memory across sessions. Do not delete it.

---

## 🎯 Product Vision

**proPod** is a cross-platform (iOS + Android) mobile application for creating, broadcasting, and editing podcasts — with AI assistance. The primary users are podcast creators and listeners. The app must work smoothly on real devices, feel polished, and support the full creator workflow: record → edit → publish → share → live broadcast.

Tech stack: React Native + Expo (frontend) · FastAPI + SQLAlchemy (backend) · PostgreSQL (prod) / SQLite (dev/test)

---

## 📍 Current Project State

**Last updated:** 2026-04-06
**Last session:** Reconciled state (PR #41 deep links and PR #42 Google auth both merged by Fay). Fixed 2 failing `TestGoogleLogin` tests in `test_user_auth.py` that broke after the auth-hardening merge — updated both to use `google_access_token` payload and `monkeypatch` the Google service. Full backend suite now green: **320 passed, 0 failed**. Branch: `fix/google-login-tests-after-auth-hardening` (PR pending — Chrome MCP unavailable this session).
**Test suite baseline:** Full backend suite **320 passed, 0 failed**. Full frontend CI passes.

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
- ✅ Deep link handling — `volo://podcast/{id}` wired in `frontend/app/_layout.js` with auth-race guard (PR #41 merged)
- ✅ Native Google Sign-In hardened — backend validates access token against Google before login-or-signup; focused test coverage in `tests/test_google_login.py` (PR #42 merged)

### What's open / in-progress
- Branch `fix/google-login-tests-after-auth-hardening` — **PR not yet opened** (Chrome MCP unavailable this session). Create PR manually at: https://github.com/iamfatihay/proPod/compare/fix/google-login-tests-after-auth-hardening
  - Fixes 2 `TestGoogleLogin` tests in `backend/tests/test_user_auth.py` that broke after PR #42 merged (schema change from email+name → google_access_token)
  - Result after fix: 320 passed, 0 failed

### Known issues / tech debt
- No Alembic migration for Playlist tables (dev uses `create_all`, prod needs migration)
- Backend heavily tested; frontend has very few tests
- Deep link handling (`volo://` scheme) is merged but still needs manual regression coverage on a real device
- Notifications and chat screens use mock/dummy data — no backend events wired yet
- Several old feature branches still exist on remote (`feature/home-scroll-to-top`, `feature/ai-processing-enhancement`, `feature/microsoft-clarity-analytics`, etc.) — audit and close if abandoned

---

## 🗺️ Roadmap Priority (agent perspective)

1. **Open PR for `fix/google-login-tests-after-auth-hardening`** — branch is pushed, Chrome MCP was down; open manually or next session
2. **Notifications screen** — replace mock data with real backend activity events (`frontend/app/(main)/notifications.js`)
3. **Backend: Alembic migration** for Playlist tables
4. **Frontend tests** — coverage is still thin outside service-level tests
5. **Stale branch audit** — many old feature branches still exist on remote; close abandoned ones

---

## 🔧 Permanent Agent Notes (Do Not Delete)

### GitHub API Access — Sandbox Constraint

**The terminal sandbox proxy blocks all outbound HTTPS to `api.github.com`.**
Do not rely on terminal REST calls to GitHub. `git` commands still work.

If browser tooling is unavailable, push the branch and document the manual PR URL.

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

1. **[PR] Open the Google-login test fix PR** — branch `fix/google-login-tests-after-auth-hardening` is pushed. If Chrome MCP is available, use browser JS `fetch` to POST to `/repos/iamfatihay/proPod/pulls`. If not, document for Fay to open manually at https://github.com/iamfatihay/proPod/compare/fix/google-login-tests-after-auth-hardening

2. **[FRONTEND] Notifications screen — real data** — `frontend/app/(main)/notifications.js` uses a Zustand store with AsyncStorage but has no backend fetch. Wire it: add a `GET /users/me/notifications` endpoint (or reuse activity events from analytics) and call it on mount with pull-to-refresh. The store's `addNotification` + `markAsRead` API is already in place.

3. **[BACKEND] Alembic migration for Playlist tables** — `backend/app/models.py` has Playlist + PlaylistItem models that are only created via `Base.metadata.create_all`. Add an Alembic migration so production deployments don't require a full DB reset. Files to create: `backend/alembic/versions/<timestamp>_add_playlist_tables.py`.
