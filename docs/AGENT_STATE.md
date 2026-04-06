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
**Last session:** Reconciled agent state — confirmed PR #41 (deep links) and PR #42 (Google auth hardening) are both merged to master. Fixed the 2 stale Google login tests in `test_user_auth.py::TestGoogleLogin` that were broken by PR #42's new required `google_access_token` field. 224 backend tests now pass in combined run. PR opened: `fix/stale-google-login-tests-after-auth-hardening`.
**Test suite baseline:** 224 tests green across test_sharing, test_user_auth, test_podcast_crud, test_google_login, test_analytics, test_playlists, test_continue_listening, test_discover, test_public_user_profile. The previously-noted `test_sharing` failure is resolved (was passing all along when run correctly; the real blocker was the 2 stale Google login tests).

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
- ✅ Deep link wiring: `volo://podcast/{id}` handled in `frontend/app/_layout.js` with auth-race guard. (PR #41 — merged 2026-04-06)
- ✅ Google sign-in hardened: native Google Sign-In, server-side token validation via Google API, focused test suite in `test_google_login.py`. (PR #42 — merged 2026-04-06)

### What's open / in-progress
- PR open: `fix/stale-google-login-tests-after-auth-hardening` — fixes 2 stale `TestGoogleLogin` tests in `test_user_auth.py` that broke after PR #42 changed the `/users/google-login` request schema. PR URL: https://github.com/iamfatihay/proPod/pull/new/fix/stale-google-login-tests-after-auth-hardening (Fay needs to open manually if Chrome MCP was unavailable)

### Known issues / tech debt
- No Alembic migration for Playlist tables (dev uses `create_all`, prod needs migration)
- Backend heavily tested; frontend has very few tests
- Notifications and chat screens use mock/dummy data — not wired to real backend events
- Several old feature branches still exist on remote (`feature/home-scroll-to-top`, `feature/ai-processing-enhancement`, `feature/microsoft-clarity-analytics`, etc.) — audit and close if abandoned
- `test_analytics_dashboard.py`, `test_comment_stats.py`, `test_podcast_interactions.py`, `test_podcast_upload.py`, `test_rtc.py`, `test_update_profile.py`, `test_user_photo_upload.py`, `test_ai_service.py` — not included in this session's combined run; should be verified next session

---

## 🗺️ Roadmap Priority (agent perspective)

1. **Merge `fix/stale-google-login-tests-after-auth-hardening`** — restores clean backend CI
2. **Notifications screen — real data** — `frontend/app/(main)/notifications.js` uses mock data; wire to backend activity/notification events
3. **Backend: Alembic migration** for Playlist tables — required before production deployment
4. **Frontend tests** — coverage is still thin outside service-level tests
5. **Verify remaining test files** — run `test_analytics_dashboard`, `test_comment_stats`, `test_rtc`, etc. in isolation to confirm their health

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

1. **[TESTS] Run remaining backend test files** — verify `test_analytics_dashboard.py`, `test_comment_stats.py`, `test_podcast_interactions.py`, `test_rtc.py`, `test_user_photo_upload.py` individually and in a combined run to get a full suite green baseline.

2. **[FRONTEND] Notifications screen — real data** — `frontend/app/(main)/notifications.js` still uses mock data. Wire it to actual backend events so users see real activity (new followers, likes, comments). Check if a `/users/me/notifications` or activity endpoint already exists before building one.

3. **[BACKEND] Alembic migration for Playlist tables** — `backend/app/models.py` has Playlist + PlaylistItem models but no migration file. Create `alembic revision --autogenerate -m "add playlist tables"` and verify it applies cleanly to a fresh DB.
