# ProPod - Podcast Application

## Project Description

ProPod is a cross-platform mobile application for creating, editing, sharing, and eventually broadcasting podcasts with AI assistance.

## Documentation

Start here: [docs/README.md](./docs/README.md)

Recommended entry points:

* [Quick Start Guide](./docs/guides/QUICK_START.md)
* [Manual Regression Re-Entry Guide](./docs/testing/MANUAL_REGRESSION_REENTRY_GUIDE.md)
* [API Documentation](./docs/api/API_DOCUMENTATION.md)
* [Implementation Summary](./docs/project/IMPLEMENTATION_SUMMARY.md)

---

## Technology Stack

### Frontend

* Expo / React Native
* expo-router
* NativeWind
* Zustand
* expo-audio
* expo-secure-store
* @react-native-google-signin/google-signin
* jest-expo and React Native Testing Library

### Backend

* FastAPI
* SQLAlchemy
* Alembic
* JWT via python-jose
* PostgreSQL for local and production runtime
* SQLite only for isolated test scenarios
* AI services for transcription and analysis
* 100ms RTC/live session foundation

---

## Quick Start

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m app.init_db
```

Windows PowerShell:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m app.init_db
```

### Frontend Setup

```bash
cd frontend
npm install
```

Use a development build. Expo Go is not supported because the app uses native modules such as Google Sign-In, notifications, and audio features.

---

## Development Startup

### Recommended Default Mode

Use the tunnel development script for regular development:

```bash
cd frontend
npm run dev
```

or from the project root:

```bash
./scripts/start-dev-tunnel.sh
```

This starts the full development environment:

1. FastAPI backend on `localhost:8000`
2. Static ngrok backend tunnel
3. Expo in tunnel mode

The backend public development URL is:

```text
https://subsumable-submucronated-inga.ngrok-free.dev
```

The 100ms webhook URL is:

```text
https://subsumable-submucronated-inga.ngrok-free.dev/rtc/webhooks/100ms
```

This URL should be configured in the 100ms dashboard as the webhook endpoint.

---

## Separate Logs Mode

Use this mode when you want to follow backend, ngrok, and frontend logs separately.

### Terminal 1 — Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal 2 — Backend ngrok Tunnel

From the project root:

```bash
ngrok http 8000 --url https://subsumable-submucronated-inga.ngrok-free.dev
```

### Terminal 3 — Frontend Expo Tunnel

```bash
cd frontend
npm run start:dev:tunnel
```

---

## Frontend Startup Commands

Run these from the `frontend/` directory.

```bash
npm run dev
```

Starts the full tunnel development setup through `scripts/start-dev-tunnel.sh`.

```bash
npm run dev:tunnel
```

Same as `npm run dev`.

```bash
npm run start:dev:tunnel
```

Starts only Expo in tunnel mode. Backend and ngrok must already be running separately.

```bash
npm run start:dev
```

Starts Expo in tunnel mode for development.

```bash
npm run android
```

Builds/runs the native Android development app.

```bash
npm run ios
```

Builds/runs the native iOS development app.

---

## Environment Variables

Environment variables are managed via `.env` files. Never commit real `.env` files.

For regular mobile development, the app uses the static ngrok backend URL.

### Frontend `.env`

```env
API_BASE_URL=https://subsumable-submucronated-inga.ngrok-free.dev
EXPO_PUBLIC_API_URL=https://subsumable-submucronated-inga.ngrok-free.dev
```

### Backend `.env`

```env
BASE_URL=https://subsumable-submucronated-inga.ngrok-free.dev
HMS_WEBHOOK_URL=https://subsumable-submucronated-inga.ngrok-free.dev/rtc/webhooks/100ms
```

For Android emulator-only local testing, `10.0.2.2` can still be used manually if needed.

---

## Ngrok Setup

Ngrok is used to expose the local backend to external services such as 100ms webhooks.

Before using the tunnel script, make sure ngrok is authenticated:

```bash
ngrok config add-authtoken YOUR_NGROK_TOKEN
```

Test the backend tunnel manually:

```bash
ngrok http 8000 --url https://subsumable-submucronated-inga.ngrok-free.dev
```

If this command opens the ngrok tunnel successfully, the development tunnel setup is ready.

---

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

Frontend tests:

```bash
cd frontend
npm run test
```

Other frontend test commands:

```bash
npm run test:watch
npm run test:coverage
npm run test:unit
npm run test:integration
npm run test:all
```

---

## Admin and Database Inspection

* Application data: use the SQLAdmin panel at `http://localhost:8000/admin` with an `admin` or `super_admin` account.
* Raw PostgreSQL access: use pgAdmin, DBeaver, or `psql` with the connection values from `backend/.env`.
* Treat `backend/.env.example` as the canonical configuration template for backend setup.
* Use PostgreSQL for local development and production-like environments.
* Keep tests on a separate disposable database.

---

## Project Structure

```text
proPod/
├── backend/
├── frontend/
├── scripts/
│   └── start-dev-tunnel.sh
├── docs/
└── README.md
```

---

## Main API Endpoints

* `/users/register`
* `/users/login`
* `/users/google-login`
* `/podcasts/create`
* `/podcasts/upload`
* `/podcasts/{id}/process-ai`
* `/podcasts/{id}/like`
* `/podcasts/{id}/bookmark`
* `/podcasts/{id}/interactions`
* `/rtc/webhooks/100ms`

---

## Existing Product Areas

* Authentication
* Password reset
* Native Google Sign-In
* Podcast CRUD
* Podcast search
* Comments and sharing
* Continue listening
* Playlists
* Creator profiles
* Analytics
* AI transcription
* AI content analysis
* RTC/live session foundation with 100ms

---

## Recent Updates

### June 2026

* Development startup was simplified around a static ngrok backend tunnel.
* Localtunnel was removed from the regular development workflow.
* `scripts/start-dev-tunnel.sh` is now the main development startup script.
* `.env` files are no longer modified automatically by the startup script.
* 100ms webhook development now uses a stable ngrok URL.

### April 2026

* Native Google Sign-In replaced the old browser-based Expo AuthSession flow on mobile.
* Backend Google auth now validates the Google access token with Google before login-or-signup.
* A manual regression re-entry guide was added under `docs/testing/`.

---

## Project Goals

* High-quality audio recording and editing
* AI-powered creator workflows
* Scalable mobile architecture
* Live podcast broadcasting support
* Modern, responsive UI/UX
* Secure authentication and Google OAuth support

---

## Important Notes

* All environment variables are managed via `.env` files.
* Never commit `.env` files.
* Only one `.gitignore` at the project root is used.
* Use PostgreSQL for local development and production-like environments.
* Use a separate disposable database for tests.
* Use Alembic migrations regularly.
* Create migrations for model changes.
* Schema vs model inconsistencies should be checked when making model changes.
* Pydantic validation errors usually mean schema and model definitions are incompatible.
* Expo Go is not supported. Use a development build.

---

## Troubleshooting

### Ngrok Authentication Error

If ngrok shows an authentication error, install your authtoken:

```bash
ngrok config add-authtoken YOUR_NGROK_TOKEN
```

Then test:

```bash
ngrok http 8000 --url https://subsumable-submucronated-inga.ngrok-free.dev
```

### Backend Does Not Start

Check the virtual environment and dependencies:

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Expo Tunnel Does Not Start

Try starting Expo directly:

```bash
cd frontend
npm run start:dev:tunnel
```

If this works, the issue is likely in the wrapper script. If it fails, the issue is likely Expo tunnel or network related.

### 100ms Webhook Does Not Arrive

Check that the backend is running:

```bash
curl http://localhost:8000/docs
```

Check that ngrok is running:

```bash
ngrok http 8000 --url https://subsumable-submucronated-inga.ngrok-free.dev
```

Verify that the 100ms dashboard webhook URL is:

```text
https://subsumable-submucronated-inga.ngrok-free.dev/rtc/webhooks/100ms
```

### Pydantic Validation Errors

* Ensure schema and model definitions are compatible.
* Check whether existing database rows are missing required fields.
* Update existing records if needed.

### Database Migration Issues

Check migration history:

```bash
cd backend
source venv/bin/activate
alembic history
```

Apply migrations:

```bash
alembic upgrade head
```

Create a new migration after model changes:

```bash
alembic revision --autogenerate -m "describe change"
```

### Login Endpoint Errors

* Ensure required user fields are populated.
* Check whether existing users are missing fields such as `updated_at`.
* Verify that Google Sign-In credentials and backend validation logic are aligned.

---

**Last updated:** 2026-06-05
