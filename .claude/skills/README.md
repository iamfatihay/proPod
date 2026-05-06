# ProPod Claude Skills

Use these files for on-demand workflow context instead of expanding `CLAUDE.md`.

- `daily-pr-triage`: choose the single highest-value task for a daily run.
- `frontend-user-facing-work`: implement product-visible frontend improvements that fit current backend capabilities.
- `review-fix-and-validation`: respond to review comments or failing CI with the narrowest safe change.
- `state-maintenance`: reconcile and update `docs/AGENT_STATE.md` after the code work is done.

The intent is to keep always-on instructions small and only load the workflow that matches the current task.