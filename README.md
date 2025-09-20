# ProPod - Podcast Application

## 📱 Project Description

ProPod is a cross-platform (Android, iOS, Web) mobile application for creating, broadcasting, and editing podcasts with AI assistance. Designed for rapid MVP development, scalability, and maintainability.

---

## 🆕 Recent Updates (2025-01-19)

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
-   **expo-av**: Audio recording/playback
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
    ├── DEVELOPMENT_NOTES.md
    ├── API_DOCUMENTATION.md
    ├── AI_INTEGRATION_GUIDE.md
    └── TEST_DOCUMENTATION.md
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
