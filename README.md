# ProPod - Podcast Application

## 📱 Project Description

ProPod is a cross-platform (Android, iOS, Web) mobile application for creating, broadcasting, and editing podcasts with AI assistance. Designed for rapid MVP development, scalability, and maintainability.

---

## 🧪 Testing

Automatic testing is enabled via pre-commit hooks:

```bash
# Install (one-time setup)
./scripts/install-hooks.sh

# Now tests run automatically before each commit
git commit -m "your message"  # Tests run automatically

# Skip tests if needed
git commit --no-verify -m "your message"
```

Tests run only for changed files (backend or frontend).

---

## 🤖 AI Assistant Setup (Optional)

For GitHub Copilot and similar AI assistants:

```bash
# First time setup (one-time)
cp .github/copilot-instructions.example.md .github/copilot-instructions.md

# Customize for your workflow (file is gitignored)
nano .github/copilot-instructions.md
```

**Optional: Disable VS Code markdown link warnings**  
If you see "file not found" warnings in `.github/copilot-instructions.md`:
```json
// Add to .vscode/settings.json (local, gitignored)
{
  "markdown.validate.ignoredLinks": [".github/copilot-instructions.md"]
}
```

The example file contains ProPod-specific patterns and conventions.

---

## 📚 Documentation

**All documentation has been reorganized for better navigation!**

👉 **Start here:** [Documentation Index](./docs/README.md)

### Quick Links by Role

**For Developers:**
- [Quick Start Guide](./docs/guides/QUICK_START.md) - Get running in 5 minutes
- [API Documentation](./docs/api/API_DOCUMENTATION.md) - Complete API reference
- [AI Integration Guide](./docs/features/AI_INTEGRATION_GUIDE.md) - AI features implementation

**For Project Managers:**
- [Feature Roadmap](./docs/project/FEATURE_ROADMAP.md) - Planned features
- [TODO & Improvements](./docs/project/TODO_IMPROVEMENTS.md) - Known issues
- [Pull Request #7](./docs/pull-requests/PR-7-AI-TRANSCRIPTION.md) - Latest feature

**For Designers:**
- [UI/UX Documentation](./docs/ui-ux/) - All design documents
- [Home Screen Redesign](./docs/ui-ux/HOME_REDESIGN.md) - Design decisions

---

## 🆕 Recent Updates

### Documentation Reorganization (January 31, 2026)
- ✅ **Professional documentation structure** - Organized into 8 logical categories
- ✅ **29 documents** organized with navigation hubs
- ✅ **Role-based access** - Easy to find what you need
- 📖 [See reorganization details](./docs/REORGANIZATION_SUMMARY.md)

### AI Features & Code Quality (January 2026)
- ✅ **AI transcription & analysis** - Production-ready with OpenAI Whisper & GPT-4
- ✅ **11 bugs fixed** - All critical issues resolved ([details](./docs/pull-requests/PR-7-REVIEW-SUMMARY.md))
- ✅ **Rate limiting** - 20 req/hr free, 100 req/hr premium
- ✅ **Input sanitization** - Security & error handling improvements
- 📦 [Pull Request #7](./docs/pull-requests/PR-7-AI-TRANSCRIPTION.md)

### Audio Performance Optimizations (Latest)
-   **Non-blocking audio operations** - Optimized play, pause, seek, and playback rate controls with optimistic updates
-   **UI performance improvements** - Added throttling for status updates and PanResponder operations to prevent UI blocking
-   **Audio system refactoring** - Complete rewrite of useAudioStore with improved state management and error handling
-   **Component updates** - Added thumbnail image support to PodcastCard and GradientCard components

### Previous Updates (2025-01-19)
-   **Fixed Schema vs Model inconsistencies** - Added missing fields to User, PodcastLike, PodcastBookmark models
-   **Alembic Migration system** - Installed and configured Alembic for database migration management
-   **Resolved Pydantic validation errors** - Completely fixed validation errors in login endpoint
-   **Database consistency** - All Schema and Model are now fully compatible
-   **Development documentation** - Added Schema/Model control commands and migration guide
-   **Fixed podcast duration storage and display** - Duration field added to PodcastCreate schema, AI transcription duration persistence implemented
-   **Enhanced podcast interactions** - Like/bookmark toggle functionality with visual feedback in details page
-   **Improved UI consistency** - Unified header design across all detail pages using Appbar.Header

---

## 🛠 Technology Stack

### Frontend (React Native + Expo)

-   **expo-router**: File-based navigation
-   **NativeWind**: Tailwind CSS for React Native styling
-   **React Native Paper**: UI components
-   **Zustand**: Simple global state management
-   **expo-audio**: Audio recording/playback (SDK 53+ compatible)
-   **expo-file-system**: File management
-   **expo-secure-store**: Secure token storage (authentication)
-   **expo-auth-session**: Google OAuth integration
-   **@expo/vector-icons**: Icons
-   **jest-expo, @testing-library/react-native**: Testing

### Backend (FastAPI)

-   **FastAPI**: Python web API framework
-   **SQLAlchemy**: ORM for database
-   **Alembic**: Database Migrations
-   **JWT (python-jose)**: Authentication
-   **PostgreSQL / SQLite**: Database
-   **passlib**: Password hashing
-   **python-dotenv**: Environment variable management
-   **AI Services**: Whisper, Content Analysis

---

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
pip install -r requirements.txt
# Create .env file (see backend/.env.example)
python -m app.init_db
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
# Create .env file (see frontend/.env.example)
# API_BASE_URL=http://localhost:8000
npx expo start --dev-client -c --tunnel
```

### 3. Run on Device/Emulator

-   Android: `npm run android`
-   iOS: `npm run ios`
-   Web: `npm run web`

---

## 📁 Project Structure

```
proPod/
├── frontend/          # React Native application
│   ├── app/          # Screens (expo-router)
│   ├── src/          # Components, services, state, etc.
│   └── android/      # Android build files
├── backend/           # FastAPI backend service
│   ├── app/          # API, models, routers
│   ├── alembic/      # Database migrations
│   └── tests/        # Test files
└── docs/             # Detailed documentation
    ├── README.md                         # Documentation index
    ├── QUICK_START.md                    # Quick start guide
    ├── DEVELOPMENT_NOTES.md              # Development guidelines
    ├── API_DOCUMENTATION.md              # API reference
    ├── AI_INTEGRATION_GUIDE.md           # AI features guide
    ├── TEST_DOCUMENTATION.md             # Testing guide
    ├── CROSS_PLATFORM_TESTING_GUIDE.md   # Cross-platform testing
    ├── HOME_REDESIGN.md                  # Home screen redesign docs
    ├── HOME_SCREEN_UPDATE.md             # Home screen update notes
    └── IMPLEMENTATION_SUMMARY.md         # Implementation summary
```

---

## 🔧 Developer Notes

### Schema vs Model Inconsistencies

Schema (Pydantic) and Model (SQLAlchemy) inconsistencies in this project can cause critical errors.

**Control Commands:**

```bash
# Go to backend directory
cd backend
.\venv\Scripts\Activate.ps1

# Check users
python -c "from app.database import SessionLocal; from app.models import User; db = SessionLocal(); users = db.query(User).all(); print(f'Total users: {len(users)}'); [print(f'User {u.id}: {u.email}, updated_at: {u.updated_at}') for u in users]; db.close()"
```

### Database Migrations

Use Alembic migrations for model changes:

```bash
# Create migration
alembic revision --autogenerate -m "Migration description"

# Apply migration
alembic upgrade head
```

### Build Processes

```bash
# Frontend build
cd frontend
npx expo-doctor  # Check first
npx eas build --platform android --profile development

# Backend Docker build
cd backend
docker build -t propod-backend .
docker run -p 8000:8000 --env-file .env propod-backend
```

---

## 📋 Main API Endpoints

-   `/users/register` : User registration
-   `/users/login` : User login (JWT)
-   `/podcasts/create` : Create podcast
-   `/podcasts/upload` : Upload audio files
-   `/podcasts/{id}/process-ai` : AI processing (transcription, analysis)
-   `/podcasts/{id}/like` : Like/unlike podcast
-   `/podcasts/{id}/bookmark` : Bookmark/unbookmark podcast
-   `/podcasts/{id}/interactions` : Get user interactions

---

## 🌟 Project Goals

-   High-quality audio recording and editing
-   AI-powered features (transcription, noise reduction)
-   Live podcast broadcasting (future)
-   Simple, scalable state management
-   Modern, responsive UI/UX
-   Secure authentication and Google OAuth support

---

## 📝 Important Notes

-   All environment variables are managed via `.env` files (never commit them!)
-   Only one `.gitignore` at the project root is used
-   Use SQLite for local development; PostgreSQL for production
-   For Android emulator, use `10.0.2.2` as API base URL; for real device, use your computer's local IP
-   **Schema vs Model inconsistencies should be checked** - Check Schema when making Model changes
-   **Use Alembic migrations regularly** - Create migrations for model changes
-   **Pydantic validation errors** - Ensure Schema and Model are compatible

---

## 🚨 Troubleshooting

### Pydantic Validation Errors

-   Ensure Schema and Model are compatible
-   Update existing records: use commands in `DEVELOPMENT_NOTES.md`

### Database Migration Issues

-   Apply Alembic migrations regularly
-   Check migration history: `alembic history`

### Login Endpoint Errors

-   Ensure `updated_at` field in User model is populated
-   Update existing users

---

**Last updated:** 2025-01-19
