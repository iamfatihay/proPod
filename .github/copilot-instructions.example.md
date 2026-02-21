# ProPod AI Coding Agent Instructions

> **📋 TEMPLATE FILE**  
> This is an example template. Copy to `copilot-instructions.md` and customize:
> ```bash
> cp .github/copilot-instructions.example.md .github/copilot-instructions.md
> ```
> Your customized file will be gitignored for personal workflows.

## Architecture Overview

**ProPod** is a full-stack podcast creation app with AI features:
- **Backend**: FastAPI (Python) + SQLAlchemy + Alembic migrations + SQLite
- **Frontend**: React Native + Expo (SDK 53+) + expo-router + NativeWind (Tailwind)
- **State**: Zustand stores with devtools middleware (`src/context/useAuthStore.js`, `useAudioStore.js`)
- **AI System**: Flexible provider architecture (local Whisper/OpenAI/hybrid) with premium user tiers

## Critical Backend Patterns

### Models vs Schemas (CRITICAL)
**Never confuse SQLAlchemy Models with Pydantic Schemas:**
- **Models** (`backend/app/models.py`): Database tables with SQLAlchemy ORM - includes relationships, indexes, constraints
- **Schemas** (`backend/app/schemas.py`): API request/response validation with Pydantic - no database logic

When adding fields:
1. Add to Model first (e.g., `User.is_premium = Column(Boolean, default=False)`)
2. Add to corresponding Schema (e.g., `UserBase` or `User` response schema)
3. Create Alembic migration: `alembic revision --autogenerate -m "Add premium field"`
4. Apply: `alembic upgrade head`

### Database Migrations (Alembic)
```bash
# Create migration after model changes
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback last migration
alembic downgrade -1
```
**NEVER** manually edit database without migrations in production-bound code.

### Service Layer Architecture
Backend uses service classes for complex logic (`backend/app/services/`):
- `ai_service.py`: AI provider orchestration (local/OpenAI/hybrid)
- `transcription_service.py`: Audio transcription (Whisper)
- `content_analyzer.py`: Podcast analysis (GPT-4 or heuristics)
- `audio_processor.py`: Audio file manipulation

**Pattern**: Controllers (routers) call services, services call CRUD functions.

### AI Provider System
Configured via `AI_PROVIDER` env var (`local`/`openai`/`hybrid`):
- **Local**: Free Whisper + heuristic analysis (no API costs)
- **OpenAI**: Whisper API + GPT-4 analysis (~$0.08 per 10min podcast)
- **Hybrid**: Free users → local, premium users (`user.is_premium=True`) → OpenAI

See [docs/architecture/AI_PROVIDER_ARCHITECTURE.md](../docs/architecture/AI_PROVIDER_ARCHITECTURE.md) for details.

## Critical Frontend Patterns

### File-based Routing (expo-router)
Routes defined by file structure in `frontend/app/`:
- `(auth)/` - Authentication screens (login, register) - stack navigation
- `(main)/` - Main app screens (home, create, profile) - tab navigation
- `_layout.js` - Root layout handling auth redirects and initialization

**Navigation**:
```javascript
import { useRouter } from 'expo-router';
const router = useRouter();

// Navigate
router.push('/(main)/create');
router.push({ pathname: '/details', params: { id: 123 } });

// Replace (no back stack)
router.replace('/(auth)/login');
```

### Zustand State Management
Stores in `frontend/src/context/` with devtools middleware:
```javascript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useStore = create(devtools((set, get) => ({
  value: 0,
  increment: () => set({ value: get().value + 1 }, false, 'increment'),
}), { name: 'StoreName' }));
```

**Key stores**:
- `useAuthStore`: User auth state, tokens (SecureStore), session management
- `useAudioStore`: Playback state, queue, mini-player - uses `expo-audio` (SDK 53+)
- `useNotificationStore`: AI processing notifications

### API Service Pattern
Centralized API client (`frontend/src/services/api/apiService.js`):
```javascript
import apiService from '../services/api/apiService';

// Automatically includes auth token from useAuthStore
const podcasts = await apiService.getPodcasts({ category: 'Tech' });

// Handles token refresh on 401
// Triggers logout on session expired
```

**NEVER** call `fetch()` directly - always use `apiService`.

### Styling with NativeWind
Tailwind classes work directly on React Native components:
```javascript
<View className="flex-1 bg-gray-100 p-4">
  <Text className="text-2xl font-bold text-blue-600">Title</Text>
</View>
```
Uses `tailwind.config.js` for theme customization.

## Development Workflows

### Starting Dev Environment
```bash
# Backend (Terminal 1)
cd backend
source venv/bin/activate  # Windows: .\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (Terminal 2)
cd frontend
npx expo start --dev-client -c --tunnel
```

### Pre-commit Testing (Automatic)
Tests run automatically before commits via `.git/hooks/pre-commit`:
```bash
# Install once
./scripts/install-hooks.sh

# Tests run on commit
git commit -m "feat: add feature"

# Skip if needed
git commit --no-verify -m "wip: draft"
```

### Commit Message Convention
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
feat(scope): add new feature
fix(scope): fix bug
docs: update documentation
refactor(scope): restructure code
test: add tests
chore: maintenance tasks
```

### Testing Commands
```bash
# Frontend tests (Jest + React Native Testing Library)
cd frontend
npm test
npm run test:coverage

# Backend tests (pytest)
cd backend
pytest
pytest tests/test_ai_service.py -v
```

## Key Conventions & Gotchas

### Backend
1. **Always sanitize inputs**: Use Pydantic schemas, validate file types/sizes in upload endpoints
2. **Error responses**: Return `{"detail": "message"}` format (FastAPI standard)
3. **Auth dependencies**: Use `Depends(auth.get_current_user)` for protected endpoints
4. **File storage**: Media files in `backend/media/` served via `/media` static mount
5. **Premium checks**: Services accept `user_is_premium` param for AI provider selection

### Frontend
1. **Secure storage**: Use `expo-secure-store` for tokens, NEVER `AsyncStorage` for sensitive data
2. **Audio system**: Use `expo-audio` (SDK 53+), not deprecated `expo-av`
3. **Performance**: Audio operations use optimistic updates (update UI first, await audio ops)
4. **Draft recovery**: `protectionService` saves recording drafts, checks on app foreground
5. **Error toasts**: Use `Toast.show()` context provider, not alerts

### Cross-cutting
1. **Logging**: Backend uses `print()`, frontend uses `Logger` utility (wraps `console`)
2. **Environment**: Backend `.env` in `backend/`, frontend in `frontend/` (gitignored)
3. **Base URL**: Frontend reads from `API_BASE_URL` env var or detects ngrok automatically
4. **CORS**: Backend allows all origins in dev (configure for production)

## Documentation Navigation

- **Quick Start**: [docs/guides/QUICK_START.md](../docs/guides/QUICK_START.md)
- **API Reference**: [docs/api/API_DOCUMENTATION.md](../docs/api/API_DOCUMENTATION.md)
- **AI Integration**: [docs/features/AI_INTEGRATION_GUIDE.md](../docs/features/AI_INTEGRATION_GUIDE.md)
- **Testing Guide**: [docs/testing/TEST_DOCUMENTATION.md](../docs/testing/TEST_DOCUMENTATION.md)
- **All Docs**: [docs/README.md](../docs/README.md) - comprehensive navigation hub

## Common Tasks

### Add Database Field
1. Edit `backend/app/models.py` (add column to model class)
2. Edit `backend/app/schemas.py` (add field to relevant schema)
3. Run: `alembic revision --autogenerate -m "Add field_name"`
4. Apply: `alembic upgrade head`
5. Update CRUD operations if needed in `backend/app/crud.py`

### Add API Endpoint
1. Choose/create router in `backend/app/routers/` (e.g., `podcasts.py`)
2. Define Pydantic schemas in `backend/app/schemas.py`
3. Add endpoint function with `@router.get/post/put/delete`
4. Use `Depends(get_db)` for database, `Depends(auth.get_current_user)` for auth
5. Return Pydantic schema instance (auto-validated)

### Add Frontend Screen
1. Create file in `frontend/app/(main)/` or `(auth)/` (e.g., `new-screen.js`)
2. Export default component
3. Use `useRouter()` for navigation, Zustand stores for state
4. Style with NativeWind classes
5. Add to tab navigator in `(main)/_layout.js` if needed

### Add Zustand Store
1. Create in `frontend/src/context/useStoreNameStore.js`
2. Use `create(devtools((set, get) => ({ ... }), { name: 'StoreName' }))`
3. Export actions and selectors
4. Import and use in components: `const value = useStore(state => state.value)`

## RTC (100ms) Integration

**Critical:** Recording must be enabled in 100ms template dashboard, NOT via API.

### Backend Pattern
- Use `hms_service.py` for all 100ms API calls
- Webhook handler: defensive payload parsing, idempotency checks
- RTCSession lifecycle: created → completed (on webhook)
- Token generation: management (backend) vs auth (client)

### Frontend Pattern
- `HmsRoom` component manages HMS SDK lifecycle
- Request permissions before join
- Cleanup on unmount: removeAllListeners → leave → destroy
- Peer tracking: upsert on UPDATE, remove on LEFT
- Error timeouts: 15s join timeout

### Common Pitfalls
- Recording parameter unsupported in room creation API
- Webhook payload structure varies by event type
- Peer track accessors sometimes methods, sometimes properties
- Background audio needs session configuration

### Resources
- Implementation: [docs/project/RTC_SESSION_MEMORY.md](../docs/project/RTC_SESSION_MEMORY.md)
- Research: [docs/project/VIDEO_PODCAST_RESEARCH.md](../docs/project/VIDEO_PODCAST_RESEARCH.md)
- Backup branch: `feature/rtc-phase2-3-4-backup` (Phase 2-4 features)
