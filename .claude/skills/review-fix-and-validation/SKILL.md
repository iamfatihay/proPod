---
name: review-fix-and-validation
description: "Use when an open pull request has review comments, unresolved quality concerns, or failing validation and the task is to make the narrowest safe fix, rerun focused checks, and prepare the PR for review."
---

# Review Fix And Validation

## Goal

Address merge blockers without reopening scope.

## Workflow

1. Read the exact review comment or failing check.
2. Confirm the local code path that controls the issue.
3. Make the smallest root-cause fix.
4. Immediately rerun the narrowest validation that can falsify the fix.
5. Stop when the blocker is resolved; do not opportunistically refactor.

## Guardrails

- Prefer accessibility and visible UX fixes over cosmetic churn.
- Do not widen from a PR-specific issue into adjacent cleanup.
- Keep public behavior stable except for the blocker being fixed.
- If the first fix fails validation, repair the same slice before exploring elsewhere.

## Validation Examples

- Targeted pytest file for a backend regression.
- Targeted lint on changed frontend files.
- Focused syntax check for JS files when lint is not the right tool.
- Diff-only review only when no executable validation exists.