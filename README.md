# proPod - Mobile Podcast Application

## 📱 Project Description

proPod is a cross-platform (Android, iOS, Web) mobile application for creating, broadcasting, and editing podcasts with AI assistance. Designed for rapid MVP development, scalability, and maintainability.

---

## 🆕 Recent Updates (2025-06-09)

-   Modern login & register screens with NativeWind (Tailwind for React Native) and improved UI/UX
-   Auth flow: login, register, logout, protected routes, global state with Zustand + devtools middleware
-   API base URL management via `.env` and `app.config.js` (frontend)
-   Backend: Python venv now only in `backend/`, module path issues çözüldü, eksik bağımlılıklar yüklendi
-   Unified `.gitignore` at project root for both backend and frontend
-   All environment variables are managed via `.env` files (never commit them!)
-   Header hidden on login/register screens for a clean look
-   Error handling and loading states improved (frontend)

---

## 🛠 Technology Stack

### Frontend (React Native + Expo)

-   **expo-router**: File-based navigation
-   **NativeWind**: Tailwind CSS for React Native styling
-   **React Native Paper**: UI components
-   **Zustand**: Simple global state management
-   **expo-av**: Audio recording/playback
-   **expo-file-system**: File management
-   **@expo/vector-icons**: Icons
-   **jest-expo, @testing-library/react-native**: Testing

### Backend (FastAPI)

-   **FastAPI**: Python web API framework
-   **SQLAlchemy**: ORM for database
-   **JWT (python-jose)**: Authentication
-   **PostgreSQL / SQLite**: Database
-   **passlib**: Password hashing
-   **python-dotenv**: Environment variable management

---

## 📦 Key Packages & Their Purpose

| Package/Tool       | Purpose                                 |
| ------------------ | --------------------------------------- |
| expo-router        | Navigation/routing (file-based)         |
| NativeWind         | Utility-first styling (Tailwind for RN) |
| Zustand            | Global state management                 |
| React Native Paper | UI components                           |
| expo-av            | Audio recording/playback                |
| expo-file-system   | File management                         |
| @expo/vector-icons | Icons                                   |
| FastAPI            | Backend API                             |
| SQLAlchemy         | ORM/database                            |
| python-jose        | JWT authentication                      |
| passlib            | Password hashing                        |
| python-dotenv      | Env variable management                 |
| pytest/jest-expo   | Testing                                 |

---

## 🚀 Getting Started

### 1. **Backend Setup**

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate  # Windows
pip install -r requirements.txt
# Create .env file (see .env.example)
python -m app.init_db
python -m uvicorn app.main:app --reload
# uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. **Frontend Setup**

```bash
cd frontend
npm install
# Create .env file (see .env.example)
# API_BASE_URL=...
npx expo start --dev-client -c --tunnel
```

### 3. **Run on Device/Emulator**

-   Android: `npm run android`
-   iOS: `npm run ios`
-   Web: `npm run web`

---

## 🌟 Project Goals

-   High-quality audio recording and editing
-   AI-powered features (transcription, noise reduction)
-   Live podcast broadcasting (future)
-   Simple, scalable state management
-   Modern, responsive UI/UX

---

## 📁 Project Structure

```
proPod/
├── frontend/   # React Native app
│   ├── app/    # Screens (expo-router)
│   ├── src/    # Components, services, state, etc.
├── backend/    # FastAPI server
│   ├── app/    # API, models, routers
```

---

## 📝 Notes

-   All environment variables are managed via `.env` files (never commit them!).
-   Only one `.gitignore` at the project root is used.
-   For local development, use SQLite; for production, use PostgreSQL.
-   For Android emulator, use `10.0.2.2` as API base URL; for real device, use your computer's local IP.

---

**Last updated:** 2025-06-09
