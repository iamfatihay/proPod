# AGENT STATE -- proPod Autonomous Engineer

> Read at session start, written at session end. This file is working state, not historical source-of-truth.

---

## Current State

**Last updated:** 2026-05-11
**Last session (19):** RTC room DB safety + tab-screen spacing -- branch `fix/rtc-room-db-safety-and-screen-spacing` hardens RTC room creation rollback behavior, adds an Alembic merge migration so `alembic upgrade head` works again, and standardizes bottom spacing on create plus similar tabbed screens
**Test suite baseline:** ~486 backend tests

**Tech stack:** React Native + Expo Router + NativeWind frontend; FastAPI + SQLAlchemy backend; PostgreSQL (prod) / SQLite (local and test)

**MVP priority:** The most important product goal is reliable podcast creation plus multi-host remote recording. The app needs to let users in different countries and network conditions join the same session, talk smoothly, and finish with a high-quality usable recording before broader feature work takes precedence.

> Full shipped history (PR #1--#65) lives in `docs/SHIPPED_ARCHIVE.md`.

---

## Recently Shipped

- DM unread badge wired end-to-end (PR #102)
- DM badge 30s polling with background refresh (PR #103)
- Notification badge last-read-timestamp, no cold-start flicker (PR #114)
- Expo push notification on new DM (PR #113)
- Expo push on like and comment (PR #111)
- Follow notification tap routes to creator profile (PR #116)
- RTC reconnect handling: ON_RECONNECTING/ON_RECONNECTED banner in HmsRoom (PR #117)
- RTC session history screen wired from create flow
- RTC session history pagination (PR #124)
- RTC guest session summary polish with host/session context (PR #125)

---

## Open / In-Progress

- `feature/rtc-failed-host-notification` / PR pending -- adds `rtc_failed` notification type; processing notification upgrades to failed when polling confirms failure; Android back-button no longer blocks navigation away from failed sessions.
- `feature/rtc-recording-retry-cta` / PR #129 -- adds a direct re-record CTA to the host RTC failed review screen so creators can launch a fresh live session without detouring through history.
- `fix/rtc-room-db-safety-and-screen-spacing` / PR pending -- rolls back cleanly on RTC room DB errors, merges current Alembic heads, and adds consistent bottom spacing to create/details/messages/activity/notifications tab screens.

---

## Known Tech Debt

- Sleep timer uses `setInterval`; verify timing accuracy on real devices.
- Frontend unit-test coverage is still thin in several user-facing flows.
- `search_users` returns `total_likes: 0` by design for performance; UI should not depend on it.
- Creator sorting is still Python-side; acceptable at current scale.
- `handlePlayRelated` queue logic in `frontend/app/(main)/details.js` lacks focused Jest coverage.
- Share web pages still contain placeholder CTA behavior and need production-ready app-open/download handling.
- Full test suite timeout: ~486 tests exceeds the practical sandbox budget; run targeted groups of 3-4 files max.
- Frontend RTC Jest runs still emit the upstream `react-test-renderer` deprecation warning; validation passes, but the test stack should be modernized.
- RTC session history pagination infers more pages from page-size responses; the backend still does not expose total counts or explicit `has_more` metadata.
- RTC join provider errors are classified from SDK message text; SDK error codes would make invite/auth/provider cases more precise if exposed reliably.
- RTC recording failure classification still depends on 100ms webhook event names; upstream event-name changes could misclassify failed vs processing outcomes until mapped.
- Host failed-session coverage is still action-level; the create-screen RTC lifecycle remains hard to test end-to-end without more screen decomposition.
- Several tabbed screens still use ad hoc bottom spacing values; if more screens get adjusted, move the padding rule into a shared screen wrapper instead of more per-screen edits.

---

## Validation Notes

- Frontend ESLint is no longer blocked by JSX parsing; targeted lint is valid again.
- 2026-05-07: `cd frontend && npx eslint app/live.js` passed for guest session summary changes; Node emitted the existing package module-type warning.
- 2026-05-07: `cd frontend && npx jest src/tests/__tests__/rtc/HmsRoom.test.js --runInBand` passed (15 tests).
- 2026-05-07: `cd frontend && npx eslint src/components/rtc/HmsRoom.js src/tests/__tests__/rtc/HmsRoom.test.js` passed; Node emitted the existing package module-type warning.
- 2026-05-08: `cd frontend && npx jest src/tests/__tests__/rtc/HmsRoom.test.js --runInBand` passed (17 tests); Jest emitted the existing `react-test-renderer` deprecation warnings.
- 2026-05-08: `cd frontend && npx eslint src/components/rtc/HmsRoom.js src/tests/__tests__/rtc/HmsRoom.test.js` passed; Node emitted the existing package module-type warning.
- 2026-05-08: `cd frontend && npx jest src/tests/__tests__/rtc/HmsRoom.test.js --runInBand` passed (24 tests); Jest emitted the existing `react-test-renderer` deprecation warnings.
- 2026-05-08: `cd frontend && npx eslint src/components/rtc/HmsRoom.js src/tests/__tests__/rtc/HmsRoom.test.js` passed; Node emitted the existing package module-type warning.
- 2026-05-08: `cd frontend && npx jest src/tests/__tests__/components/QuickActionsBar.test.js --runInBand` passed (1 test); Jest emitted the existing `react-test-renderer` deprecation warning.
- 2026-05-08: `cd frontend && npx eslint app/(main)/_layout.js app/(main)/home.js src/components/QuickActionsBar.js src/tests/__tests__/components/QuickActionsBar.test.js` passed; Node emitted the existing package module-type warning.
- 2026-05-08: `cd frontend && npx jest src/tests/__tests__/rtc/RtcSessionsScreen.test.js src/tests/__tests__/rtc/apiService.test.js --runInBand` passed (17 tests); Jest emitted existing logger and `react-test-renderer` warnings.
- 2026-05-08: `cd backend && DATABASE_URL=sqlite:///./precommit_test.db venv/bin/python -m pytest tests/test_rtc.py -q` passed (13 tests); pytest emitted existing dependency deprecation warnings.
- 2026-05-08: `cd frontend && npx eslint 'app/(main)/rtc-sessions.js' src/services/api/apiService.js src/tests/__tests__/rtc/RtcSessionsScreen.test.js src/tests/__tests__/rtc/apiService.test.js` passed; Node emitted the existing package module-type warning.
- 2026-05-08: `cd frontend && npx jest src/tests/__tests__/rtc/LiveInviteScreen.test.js --runInBand` passed (2 tests); Jest emitted the existing `react-test-renderer` deprecation warnings and existing logger output from the mocked leave flow.
- 2026-05-08: `cd frontend && npx eslint app/live.js src/tests/__tests__/rtc/LiveInviteScreen.test.js` passed; Node emitted the existing package module-type warning.
- 2026-05-08: `cd backend && DATABASE_URL=sqlite:///./precommit_test.db venv/bin/python -m pytest tests/test_rtc.py -q` passed (16 tests); pytest emitted existing dependency deprecation warnings.
- 2026-05-08: `cd frontend && npx jest src/tests/__tests__/rtc/LiveInviteScreen.test.js --runInBand` passed (5 tests); Jest emitted existing `react-test-renderer` deprecation warnings and expected logger output from the mocked refresh failure case.
- 2026-05-08: `cd frontend && npx eslint app/live.js src/tests/__tests__/rtc/LiveInviteScreen.test.js` passed; Node emitted the existing package module-type warning.
- 2026-05-08: pre-commit hook on `git commit` passed the repository backend/frontend validation suite (509 backend tests plus frontend checks); existing dependency and deprecation warnings remained.
- 2026-05-08: `cd backend && DATABASE_URL=sqlite:///./precommit_test.db venv/bin/python -m pytest tests/test_rtc.py -q` passed (18 tests); pytest emitted existing dependency and Pydantic deprecation warnings.
- 2026-05-08: `cd frontend && npx jest src/tests/__tests__/rtc/LiveInviteScreen.test.js src/tests/__tests__/rtc/RtcSessionsScreen.test.js --runInBand` passed (11 tests); Jest emitted existing `react-test-renderer` deprecation warnings and expected mocked logger output.
- 2026-05-08: `cd frontend && npx eslint app/live.js 'app/(main)/rtc-sessions.js' 'app/(main)/create.js' src/tests/__tests__/rtc/LiveInviteScreen.test.js src/tests/__tests__/rtc/RtcSessionsScreen.test.js` passed; Node emitted the existing package module-type warning.
- 2026-05-08: pre-commit hook on `git commit` passed the repository backend/frontend validation suite (511 backend tests plus frontend checks); existing dependency and deprecation warnings remained.
- 2026-05-11: `cd /home/fatih/proPod/frontend && npx jest src/tests/__tests__/rtc/CreateRtcRetryFlow.test.js --runInBand` passed (2 tests); Jest emitted the existing `react-test-renderer` deprecation warnings.
- 2026-05-11: `cd /home/fatih/proPod/frontend && npx eslint 'app/(main)/create.js' src/tests/__tests__/rtc/CreateRtcRetryFlow.test.js` passed; Node emitted the existing package module-type warning.
- 2026-05-11: pre-commit hook on `git commit` passed frontend validation for the host RTC retry CTA change.
- 2026-05-11: `cd /home/fatih/proPod/backend && DATABASE_URL=sqlite:///./precommit_test.db venv/bin/python -m pytest tests/test_rtc.py -q -k 'create_room_success or db_commit_fails'` passed (2 tests); pytest emitted existing dependency and Pydantic deprecation warnings.
- 2026-05-11: repository pre-commit hook on `git commit` passed the backend suite (513 tests) for `fix(rtc): rollback cleanly on room creation db errors`; existing warnings remained.
- 2026-05-11: `cd /home/fatih/proPod/frontend && npx eslint 'app/(main)/create.js' 'app/(main)/notifications.js' 'app/(main)/messages.js' 'app/(main)/activity.js' 'app/(main)/details.js' src/constants/theme.js` passed; Node emitted the existing package module-type warning.
- 2026-05-11: repository pre-commit hook on `git commit` passed frontend validation for `fix(frontend): add tab screen bottom spacing`.
- 2026-05-11: `cd /home/fatih/proPod/backend && venv/bin/alembic heads && venv/bin/alembic upgrade head && venv/bin/alembic current` passed after adding merge revision `a7b8c9d0e1f2`; the DB now resolves to a single Alembic head.
- Prefer focused validation only: a few pytest files max on backend, and targeted lint or `node --check` for frontend JS files.
- Do not report validation as passing unless it actually ran.

---

## Next Session Suggestions

1. **RTC recording lifecycle device QA** -- verify completed, processing, and failed RTC states on iOS and Android with real webhook timing after the DB-safety and migration fixes.
2. **Shared tab-screen spacing wrapper** -- replace remaining ad hoc tabbed-screen bottom padding values with a reusable screen wrapper or helper so future screens do not regress under the floating tab bar.
3. **RTC schema deprecation cleanup** -- replace class-based Pydantic config in `schemas_live_session.py` with `ConfigDict` to remove the recurring backend warning before more RTC schema work lands.

---

## Permanent Notes

- Route ordering: literal routes (`/following-feed`, `/search`) must be before parameterized (`/{id}`) in `backend/app/routers/podcasts.py`.
- `apiService.clearToken()` in `beforeEach` after 401-retry tests.
- Run `node --check frontend/app/(main)/home.js` after merging PRs touching that file.
- If working from roadmap/TODO docs, verify against code before acting.
