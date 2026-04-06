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
**Last session:** Agent refreshed project docs, updated PR #41 deep link handling to avoid auth-routing races, and hardened the native Google sign-in flow in PR #42 with server-side token validation and focused test coverage.
**Test suite baseline:** Focused Google auth tests pass. Full frontend CI passes. Full backend suite currently has one unrelated failure in `tests/test_sharing.py::TestSharePodcastPublic::test_relative_audio_url_gets_base_url_prefix` when run against a dedicated test DB.

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
- PR #41: `feat: wire volo://podcast/{id} deep link handling`
- Deep link wiring in `frontend/app/_layout.js` now guards against auth redirect races on cold start (pending merge)
- PR #42: `fix(auth): secure native Google sign-in flow`
- Native Google Sign-In replaced the old Expo AuthSession-based Google flow on mobile (pending merge)
- Backend Google auth now validates the Google access token against Google before login-or-signup (pending merge)
- Focused Google auth tests now cover invalid token rejection and verified profile mapping (pending merge)
- Manual regression guide added at `docs/testing/MANUAL_REGRESSION_REENTRY_GUIDE.md` (local docs update; not yet merged)

### Known issues / tech debt
- Full backend suite currently has one unrelated failure in `tests/test_sharing.py::TestSharePodcastPublic::test_relative_audio_url_gets_base_url_prefix`
- No Alembic migration for Playlist tables (dev uses `create_all`, prod needs migration)
- Backend heavily tested; frontend has very few tests
- Deep link handling (`volo://` scheme) is implemented in PR #41 and still needs manual regression coverage after merge
- Notifications and chat screens use mock/dummy data
- Several old feature branches still exist on remote (`feature/home-scroll-to-top`, `feature/ai-processing-enhancement`, `feature/microsoft-clarity-analytics`, etc.) — audit and close if abandoned

---

## 🗺️ Roadmap Priority (agent perspective)

1. **Fix sharing regression** — restore a clean full backend suite by resolving `tests/test_sharing.py::TestSharePodcastPublic::test_relative_audio_url_gets_base_url_prefix`
2. **Merge and regression-test open auth/navigation PRs** — prioritize PR #41 (deep links) and PR #42 (Google sign-in hardening)
3. **Notifications screen** — replace mock data with real backend events
4. **Backend: Alembic migration** for Playlist tables
5. **Frontend tests** — coverage is still thin outside service-level tests

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

1. **[BACKEND] Fix `tests/test_sharing.py::TestSharePodcastPublic::test_relative_audio_url_gets_base_url_prefix`** — restore green full-suite backend CI.

2. **[PR] Merge and manually verify PR #41** — after merge, confirm cold-start and warm-start deep links both land on podcast details without being overridden by the auth redirect.

3. **[FRONTEND] Notifications screen — real data** — `frontend/app/(main)/notifications.js` still uses mock data; wire to backend activity events.
