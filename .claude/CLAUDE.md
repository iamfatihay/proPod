# ProPod Core Agent Notes

This file is the always-on core for repository-specific behavior.
Keep it short. Load task-specific guidance from `.claude/skills/` only when the active task needs it.

## Product Snapshot

- ProPod is a cross-platform iOS/Android podcast app.
- Backend: FastAPI + SQLAlchemy + Alembic.
- Frontend: React Native + Expo Router + NativeWind.
- Audio stack: `expo-audio` on the frontend.
- AI stack: local/openai/hybrid providers behind backend services.
- MVP priority: make podcast creation and multi-host remote podcast recording reliable, high-quality, and simple for users in different countries and network conditions before broadening scope.

## Always-Valid Repo Rules

### Backend

- Do not confuse SQLAlchemy models in `backend/app/models.py` with Pydantic schemas in `backend/app/schemas.py`.
- Add database fields in this order: model, schema, Alembic migration, CRUD updates if needed.
- Reuse existing CRUD/service/router patterns instead of inventing parallel paths.
- Protected routes should use `Depends(auth.get_current_user)`.
- Return FastAPI-style errors as `{"detail": "message"}`.
- Media files live under `backend/media/` and are served from `/media`.

### Frontend

- Use `frontend/src/services/api/apiService.js` for network calls. Do not introduce direct `fetch()` calls.
- Use `expo-audio`, not `expo-av`.
- Keep secure tokens in `expo-secure-store`, not AsyncStorage.
- Follow Expo Router file-based routing in `frontend/app/`.
- Match existing Zustand store patterns in `frontend/src/context/`.

### Cross-Cutting

- Prefer small user-facing improvements over speculative rewrites.
- For roadmap tradeoffs, prioritize the core creator flow first: create a podcast, invite participants, complete a stable multi-host session, and produce a usable recording.
- Route ordering matters in `backend/app/routers/podcasts.py`: literal routes must stay before parameterized routes.
- After 401-retry tests, clear the API token cache with `apiService.clearToken()` in `beforeEach`.
- If backend work needs a temporary `.env` or test database, remove `backend/.env` and `backend/test_app.db` before committing.
- Treat `docs/project/FEATURE_ROADMAP.md` and `docs/project/TODO_IMPROVEMENTS.md` as hints, not ground truth. Verify against code before planning work.

## Validation Defaults

- Prefer targeted validation for the touched slice.
- Backend: run at most a few focused pytest files unless the task explicitly needs more.
- Frontend: use targeted lint or `node --check` on changed JS files.
- Never report validation as passing unless it actually ran and passed.

## Runtime Workflow Defaults

- Reconcile `docs/AGENT_STATE.md` with remote truth before choosing new work.
- Update `docs/AGENT_STATE.md` last, in the same branch as the code change.
- Respect the active run prompt for branch naming, PR shape, and end-of-run reporting.
- Do not assume older docs are current if the repository disagrees.

## Load-On-Demand Skills

- `.claude/skills/daily-pr-triage/SKILL.md`: choose one task for the session and prioritize existing PR feedback.
- `.claude/skills/frontend-user-facing-work/SKILL.md`: implement user-facing frontend changes with existing backend surfaces.
- `.claude/skills/review-fix-and-validation/SKILL.md`: address review comments or failing checks without widening scope.
- `.claude/skills/state-maintenance/SKILL.md`: keep `docs/AGENT_STATE.md` accurate at the end of the run.
