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
**Last session:** Reconciled state — confirmed PRs #41 and #42 both merged. Fixed 2 stale `TestGoogleLogin` tests in `test_user_auth.py` that broke when PR #42 changed the google-login schema; updated tests to monkeypatch `fetch_google_user_profile` and send `google_access_token`. Full backend suite now green: **320 passed, 0 failed**. Branch `fix/stale-google-login-tests` pushed, PR open at https://github.com/iamfatihay/proPod/pull/new/fix/stale-google-login-tests (Chrome MCP unavailable, manual PR creation required).
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
- ✅ Deep link handling `volo://podcast/{id}` with auth-guard on cold start (PR #41, merged 2026-04-06)
- ✅ Secure native Google sign-in — server-side token validation + focused test coverage (PR #42, merged 2026-04-06)

### What's open / in-progress
- **fix/stale-google-login-tests** — 2 stale `TestGoogleLogin` tests in `test_user_auth.py` updated to monkeypatch `fetch_google_user_profile` and use new schema; full suite now green (320/0). PR: https://github.com/iamfatihay/proPod/pull/new/fix/stale-google-login-tests (needs manual open — Chrome MCP was unavailable)

### Known issues / tech debt
- No Alembic migration for Playlist tables (dev uses `create_all`, prod needs migration)
- Backend heavily tested; frontend has very few tests
- Deep link handling (`volo://` scheme) merged in PR #41 — needs manual regression (cold-start + warm-start) to confirm no auth redirect race on real device
- Notifications and chat screens use mock/dummy data — wired to backend is the next big frontend win
- Several old feature branches still exist on remote (`feature/home-scroll-to-top`, `feature/ai-processing-enhancement`, `feature/microsoft-clarity-analytics`, etc.) — audit and close if abandoned

---

## 🗺️ Roadmap Priority (agent perspective)

1. **Merge fix/stale-google-login-tests** — complete the green-suite restoration; needs manual PR open then merge
2. **Notifications screen** — replace mock data with real backend events (`frontend/app/(main)/notifications.js`)
3. **Backend: Alembic migration** for Playlist tables (prod readiness)
4. **Frontend tests** — coverage is still thin outside service-level tests
5. **Audit/close stale remote branches** — clean up graveyard branches on origin

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

1. **[FRONTEND] Notifications screen — real data** — `frontend/app/(main)/notifications.js` still renders mock data. Wire it to backend activity events (likes, comments, follows). This is visible to every user on every session. Check what events the backend already emits before designing the endpoint.

2. **[BACKEND] Alembic migration for Playlist tables** — `backend/app/models.py` has Playlist + PlaylistItem models but only `create_all` creates them in dev. Add an Alembic migration so the tables exist in production without manual intervention. Files to touch: `backend/alembic/versions/` (new file), `backend/alembic/env.py`.

3. **[CLEANUP] Audit + delete stale remote branches** — branches like `feature/home-scroll-to-top`, `feature/ai-processing-enhancement`, `feature/microsoft-clarity-analytics` have been sitting for many sessions. Check if any useful commit is not in master, then delete the dead ones to keep `git branch -r` readable.
