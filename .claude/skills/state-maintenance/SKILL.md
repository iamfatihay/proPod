---
name: state-maintenance
description: "Use at the end of a ProPod autonomous run when updating docs/AGENT_STATE.md to reflect the current branch, PR, shipped work, validation results, risks, and the next three concrete tasks."
---

# State Maintenance

## Goal

Leave `docs/AGENT_STATE.md` more accurate than it was at session start.

## Update Rules

1. Update the `Last updated` date.
2. Replace the one-line last session summary with the current branch and PR.
3. Move merged work to shipped after checking remote truth.
4. Keep open work limited to branches or PRs that still exist.
5. Record new risks or technical debt discovered during the run.
6. Rewrite the next-session section as three ranked, concrete tasks.

## Accuracy Rules

- Do not copy old entries forward without rechecking them.
- If the file contains mojibake or stale assumptions, normalize them while editing.
- Record only validation that actually ran.
- Keep the file useful for the next autonomous run, not as a changelog dump.