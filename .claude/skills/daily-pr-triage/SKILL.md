---
name: daily-pr-triage
description: "Use when choosing the single task for a daily autonomous run, especially when open pull requests, review comments, failing checks, or stale AGENT_STATE entries need to be reconciled first."
---

# Daily PR Triage

## Goal

Choose exactly one reviewable task for the run, with bias toward already-open work that is closest to merge.

## Start Sequence

1. Run `git status --short`.
2. Run `git fetch origin --prune`.
3. Read `docs/AGENT_STATE.md`.
4. Read `docs/project/FEATURE_ROADMAP.md` and `docs/project/TODO_IMPROVEMENTS.md` only as candidate sources, not as authority.
5. Inspect remote truth: open PRs, review comments, unresolved threads, and failing checks.

## Task Priority

1. Existing open PRs with review comments.
2. Existing open PRs with failing checks.
3. Resume in-progress work already tracked in `docs/AGENT_STATE.md`.
4. Frontend improvements that clearly use existing backend endpoints.
5. User-facing bug fixes.
6. Backend-only work only if it directly unlocks a planned user-visible path.

## Selection Rules

- Open exactly one reviewable PR per run.
- Do not choose docs-only work unless product work is not safely actionable.
- Avoid speculative redesigns, broad refactors, and disconnected backend cleanup.
- If roadmap or TODO docs conflict with the current code, trust the code.

## Reconcile AGENT_STATE

- If a branch is gone and the PR merged, move it to shipped.
- If a branch is gone and no PR merged, mark it abandoned or remove it from open work.
- If the file contains stale claims, update them only after checking current repository state.