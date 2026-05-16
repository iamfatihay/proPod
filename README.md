# ProPod - Podcast Application

## Project Description

ProPod is a cross-platform mobile application for creating, editing, sharing, and eventually broadcasting podcasts with AI assistance.

## Documentation

Start here: [docs/README.md](./docs/README.md)

Recommended entry points:
- [Quick Start Guide](./docs/guides/QUICK_START.md)
- [Manual Regression Re-Entry Guide](./docs/testing/MANUAL_REGRESSION_REENTRY_GUIDE.md)
- [API Documentation](./docs/api/API_DOCUMENTATION.md)
- [Implementation Summary](./docs/project/IMPLEMENTATION_SUMMARY.md)
- [Repository Explainer](./docs/project/REPOSITORY_EXPLAINER.md)

## Testing

Automatic testing is enabled via pre-commit hooks:

```bash
./scripts/install-hooks.sh
git commit -m "your message"
```

Backend tests require a dedicated test database. If you run pytest manually, set `DATABASE_URL` to a disposable test DB.

```bash
cd backend
source venv/bin/activate
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/propod_test pytest tests/ -q
```

## Recent Updates

### April 2026
- Native Google Sign-In replaced the old browser-based Expo AuthSession flow on mobile.
- Backend Google auth now validates the Google access token with Google before login-or-signup.
- A manual regression re-entry guide was added under `docs/testing/`.

### Existing Product Areas
- auth, password reset, and Google sign-in
- podcast CRUD, search, comments, and sharing
- continue listening, playlists, creator profiles, and analytics
- AI transcription and content analysis
- RTC/live session foundation with 100ms

## Technology Stack

### Frontend
- expo-router
- NativeWind
- Zustand
- expo-audio
- expo-secure-store
- @react-native-google-signin/google-signin
- jest-expo and React Native Testing Library

### Backend
- FastAPI
- SQLAlchemy
- Alembic
- JWT via python-jose
- PostgreSQL for local and production runtime; SQLite only for isolated test scenarios
- AI services for transcription and analysis

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m app.init_db
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Windows PowerShell:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m app.init_db
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
```

Common startup modes:

```bash
npm run dev
npm run dev:tunnel
npm run start:dev
npm run start:dev:tunnel
```

Use a development build. Expo Go is not supported.

## Admin and Database Inspection

- Application data: use the SQLAdmin panel at `http://localhost:8000/admin` with an `admin` or `super_admin` account.
- Raw PostgreSQL access: use pgAdmin, DBeaver, or `psql` with the connection values from `backend/.env`.
- Treat `backend/.env.example` as the canonical configuration template for backend setup.

## Project Structure

```text
proPod/
├── frontend/
├── backend/
└── docs/
```

## Main API Endpoints

- `/users/register`
- `/users/login`
- `/users/google-login`
- `/podcasts/create`
- `/podcasts/upload`
- `/podcasts/{id}/process-ai`
- `/podcasts/{id}/like`
- `/podcasts/{id}/bookmark`
- `/podcasts/{id}/interactions`

## Project Goals

- high-quality audio recording and editing
- AI-powered creator workflows
- scalable mobile architecture
- live podcast broadcasting support

Last updated: 2026-04-05
-   Modern, responsive UI/UX
-   Secure authentication and Google OAuth support

---

## 📝 Important Notes

-   All environment variables are managed via `.env` files (never commit them!)
-   Only one `.gitignore` at the project root is used
-   Use PostgreSQL for local development and production-like environments; keep tests on a separate disposable database
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
