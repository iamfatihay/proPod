# AGENT STATE -- proPod Autonomous Engineer

> Read at session start, written at session end. This file is working state, not historical source-of-truth.

---

## Current State

**Last updated:** 2026-05-07
**Last session (8):** RTC join retry -- branch `feature/rtc-join-timeout-retry` adds an in-room retry action after join failures/timeouts and covers it with focused HmsRoom tests
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

---

## Open / In-Progress

- `feature/rtc-join-timeout-retry` -- HmsRoom retry UX validated and ready for PR.

---

## Known Tech Debt

- Sleep timer uses `setInterval`; verify timing accuracy on real devices.
- Frontend unit-test coverage is still thin in several user-facing flows.
- `search_users` returns `total_likes: 0` by design for performance; UI should not depend on it.
- Creator sorting is still Python-side; acceptable at current scale.
- `handlePlayRelated` queue logic in `frontend/app/(main)/details.js` lacks focused Jest coverage.
- Share web pages still contain placeholder CTA behavior and need production-ready app-open/download handling.
- Full test suite timeout: ~486 tests exceeds the practical sandbox budget; run targeted groups of 3-4 files max.
- RTC pre-join failures still do not expose an explicit cancel/close action inside the live room shell.

---

## Validation Notes

- Frontend ESLint is no longer blocked by JSX parsing; targeted lint is valid again.
- 2026-05-07: `cd frontend && npx eslint app/live.js` passed for guest session summary changes; Node emitted the existing package module-type warning.
- 2026-05-07: `cd frontend && npx jest src/tests/__tests__/rtc/HmsRoom.test.js --runInBand` passed (15 tests).
- 2026-05-07: `cd frontend && npx eslint src/components/rtc/HmsRoom.js src/tests/__tests__/rtc/HmsRoom.test.js` passed; Node emitted the existing package module-type warning.
- Prefer focused validation only: a few pytest files max on backend, and targeted lint or `node --check` for frontend JS files.
- Do not report validation as passing unless it actually ran.

---

## Next Session Suggestions

1. **RTC join cancel UX** -- add an explicit close/cancel action for host and guest flows when join fails before `ON_JOIN`, so users are not trapped in the live room shell.
2. **RTC session list screen** -- expose `listRtcSessions` on the frontend so hosts can review past live sessions and their recording status.
3. **Guest summary polish** -- verify the post-session summary on device and consider showing host/session status if backend invite/session status is available.

---

## Permanent Notes

- Route ordering: literal routes (`/following-feed`, `/search`) must be before parameterized (`/{id}`) in `backend/app/routers/podcasts.py`.
- `apiService.clearToken()` in `beforeEach` after 401-retry tests.
- Run `node --check frontend/app/(main)/home.js` after merging PRs touching that file.
- If working from roadmap/TODO docs, verify against code before acting.
