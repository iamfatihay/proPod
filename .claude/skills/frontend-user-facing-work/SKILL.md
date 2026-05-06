---
name: frontend-user-facing-work
description: "Use when implementing a user-facing frontend improvement in ProPod, especially for Expo Router screens, NativeWind components, Zustand state, audio UX, history, analytics, notifications, or flows backed by existing API endpoints."
---

# Frontend User-Facing Work

## Goal

Ship one change a real user can notice, while staying inside existing product patterns.

## Preferred Surface Areas

- `frontend/app/` for screens and route-level behavior.
- `frontend/src/components/` for reusable UI.
- `frontend/src/context/` for Zustand-backed state.
- `frontend/src/services/api/` for API integration through `apiService`.

## Repo-Specific Rules

- Use `apiService`, not direct `fetch()`.
- Preserve Expo Router conventions.
- Keep NativeWind and existing style patterns consistent with nearby code.
- Use `expo-audio` for playback or recording related work.
- Favor optimistic UI only where the repo already uses it.

## Scope Rules

- Prefer small product-visible improvements over architecture work.
- Reuse existing backend endpoints before proposing new ones.
- If backend support is missing, only add the smallest enabling backend slice needed for the frontend path.
- Do not mix unrelated UX tweaks into one PR.

## Validation

- Run targeted lint or `node --check` for changed JS files.
- Run focused tests only for the touched feature area when available.
- If device-only verification is needed, say what remains unverified.