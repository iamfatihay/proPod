# proPod - Mobile Podcast Application

## 📱 Project Description

proPod is a cross-platform (Android, iOS, Web) mobile application that enables users to create, broadcast, and edit podcast content with AI assistance. The project is designed as an MVP for rapid development, scalability, and maintainability, targeting both individual creators and teams.

---

## 🆕 Recent Updates & Best Practices (2025-06-09)

### 🔹 **Unified .gitignore**

-   Only one `.gitignore` at the project root now manages all ignore rules for both backend and frontend.
-   Ignores: `backend/.venv/`, `backend/.env`, `frontend/.env`, `node_modules/`, build outputs, IDE/editor files, etc.
-   You can safely delete `.gitignore` files inside subfolders.

### 🔹 **Environment Variables Management**

-   **Backend:** `.env` file is in `backend/` (never commit this file!). Example:
    ```env
    DATABASE_URL=sqlite:///./test.db
    SECRET_KEY=supersecretkey
    ALGORITHM=HS256
    ACCESS_TOKEN_EXPIRE_MINUTES=30
    ```
-   **Frontend:** `.env` file is in `frontend/` and managed via `app.config.js`:
    ```env
    API_BASE_URL=http://10.0.2.2:8000
    ```
    `frontend/app.config.js`:
    ```js
    import "dotenv/config";
    export default {
        expo: {
            // ...other config
            extra: {
                apiBaseUrl: process.env.API_BASE_URL,
            },
        },
    };
    ```
    In your code, use:
    ```js
    import Constants from "expo-constants";
    const API_BASE_URL = Constants.expoConfig.extra.apiBaseUrl;
    ```

### 🔹 **Backend Python Environment**

-   Python virtual environment (`.venv`) is now created **inside the backend folder** only.
-   To create and use:
    ```bash
    cd backend
    python -m venv .venv
    .venv\Scripts\Activate  # Windows
    pip install -r requirements.txt
    ```
-   Never commit `.venv` or `.env` files.

### 🔹 **Database Initialization**

-   To create tables:
    ```bash
    python -m app.init_db
    ```

### 🔹 **Backend Debugging & Common Issues**

-   If you see `ModuleNotFoundError: No module named 'app'`, always run scripts from the backend root with `python -m ...` syntax.
-   If you see `ImportError: email-validator is not installed`, run:
    ```bash
    pip install email-validator
    ```
-   If you see `uvicorn` not found, always use:
    ```bash
    python -m uvicorn app.main:app --reload
    ```

### 🔹 **Frontend API Base URL**

-   Use `.env` and `app.config.js` for environment-specific API URLs.
-   For Android emulator: `http://10.0.2.2:8000`
-   For real device: use your computer's local IP (e.g. `http://192.168.x.x:8000`)

### 🔹 **Frontend Auth Flow & UI Improvements**

-   Modern login and register screens with NativeWind, dark mode, and brand colors.
-   Auth flow: login, register, logout, protected routes, Zustand store with devtools middleware.
-   Header is hidden on login/register screens for a clean look.
-   Error handling and loading states improved.

### 🔹 **State Management & Debugging**

-   Zustand is used for global state. Devtools middleware is enabled for Redux DevTools/React Native Debugger integration.
-   Example store:
    ```js
    import { create } from "zustand";
    import { devtools } from "zustand/middleware";
    const useAuthStore = create(
        devtools((set) => ({
            user: null,
            setUser: (user) => set({ user }, false, "auth/setUser"),
            logout: () => set({ user: null }, false, "auth/logout"),
        }))
    );
    export default useAuthStore;
    ```

### 🔹 **Recommended Native/Web Dev Tools**

-   **Watchman:** Fast file watching for hot reload (installed via Chocolatey or manual).
-   **Flipper:** Advanced React Native debugging (network, storage, logs, layout). Download from [Flipper Releases](https://github.com/facebook/flipper/releases).
-   **React Native Debugger:** Redux/Zustand state, network, async storage debugging. Download from [React Native Debugger Releases](https://github.com/jhen0409/react-native-debugger/releases).
-   **Zustand Devtools:** Enable in store for state debugging.

### 🔹 **Expo/React Native Emulator/Device Debugging Tips**

-   Always restart Metro Bundler and Expo Go if touch or hot reload stops working.
-   For Android emulator, use `10.0.2.2` as localhost.
-   For real device, both device and computer must be on the same WiFi.
-   If touch is not working, check for full-screen overlays or pointerEvents issues in your code.

---

## 🎯 Project Goals & Workflow

-   **High-Quality Audio Recording:**
    -   Record and playback audio with high fidelity using Expo's managed workflow (expo-av).
    -   Store and manage audio files efficiently (expo-file-system).
-   **Audio Editing:**
    -   Support for trimming, merging, and basic editing of audio files (initially via backend, with future mobile-side support).
-   **AI-Powered Features:**
    -   Transcription: Convert speech to text using cloud-based APIs (e.g., OpenAI Whisper) or local solutions for rapid prototyping.
    -   Noise Reduction & Auto-Edit: Enhance audio quality and automate editing, leveraging server-side processing for advanced features.
-   **Live Streaming:**
    -   Real-time podcast broadcasting with scalable architecture (future integration with WebRTC or similar technologies).
-   **Scalable State Management:**
    -   Use Zustand for simple, scalable, and maintainable global state management.
-   **Testing & Maintenance:**
    -   Easy-to-write and maintain tests using Jest and React Native Testing Library.
    -   Focus on developer experience for solo and small teams.
-   **Modern UI/UX:**
    -   Rapid prototyping and beautiful interfaces with React Native Paper and Expo vector icons.
    -   Responsive design for both mobile and web platforms.

## 🎯 Key Features

### 1. **Live Podcast Broadcasting**

-   Real-time podcast streaming
-   Live audience interaction
-   Broadcast quality settings

### 2. **Podcast Recording**

-   High-quality audio recording
-   Multiple microphone support
-   Background noise reduction

### 3. **AI-Powered Editing**

-   Automatic audio cleaning
-   Silence removal
-   Audio quality enhancement
-   AI transcription

### 4. **Podcast Management**

-   Recorded podcast archive
-   Edit history tracking
-   Broadcasting schedule

## 🛠 Technology Stack

### Frontend (React Native + Expo)

-   **Navigation:** expo-router (file-based routing)
-   **Styling:** React Native Paper, NativeWind (Tailwind for React Native)
-   **State Management:** Zustand (+ devtools)
-   **Audio/Video:** expo-av
-   **File Management:** expo-file-system
-   **Icons:** @expo/vector-icons
-   **Testing:** jest-expo, @testing-library/react-native, react-test-renderer
-   **Web Support:** Requires `react-dom` and `react-native-web` dependencies

### Backend (FastAPI)

-   **Authentication:** JWT
-   **Database:** PostgreSQL / SQLite
-   **AI Integration:** OpenAI API, Whisper, or similar
-   **Audio Processing:** FFmpeg, pydub, or similar for editing and noise reduction
-   **Streaming:** WebRTC / Socket.IO (future)

## 📁 Project Structure

```
proPod/
├── frontend/          # React Native mobile application
│   ├── app/           # expo-router screens (file-based routing)
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── screens/       # Legacy screens (new screens are under app/)
│   │   ├── services/      # API, streaming, audio services
│   │   ├── utils/         # Helper functions
│   │   ├── constants/     # Constants and configurations
│   │   ├── navigation/    # (Not used, routing is under app/ with expo-router)
│   │   ├── hooks/         # Custom React hooks
│   │   └── context/       # Global state management
│   └── ...
└── backend/           # FastAPI server
    ├── app/
    │   ├── routers/       # API endpoints
    │   ├── models/        # Database models
    │   └── ...
    └── ...
```

## 🏃‍♂️ Getting Started

### Frontend (Mobile Application)

#### Installation

```bash
cd frontend
npm install
```

#### Run Commands

-   **Android device/emulator:**
    ```bash
    npm run android
    ```
-   **iOS (on MacOS):**
    ```bash
    npm run ios
    ```
-   **Web:**
    ```bash
    npm run web
    ```
-   **To use Expo Go and scan the QR code:**
    ```bash
    npm start
    ```

#### Build (for real device testing or app store release)

-   [EAS Build](https://docs.expo.dev/build/introduction/) for cross-platform builds:
    ```bash
    npm run build
    ```
    > Note: EAS Build requires an Expo account.

#### Web Support Requirements

-   To run the app on web, make sure you have the following dependencies in your `package.json`:
    -   `react-dom`
    -   `react-native-web`
-   If you encounter navigation or touch issues on web, install them with:
    ```bash
    npx expo install react-dom react-native-web
    ```

#### Key Dependencies Installed

-   `expo-av` (audio recording/playback)
-   `expo-file-system` (file management)
-   `react-native-paper` (UI components)
-   `@expo/vector-icons` (icons)
-   `zustand` (state management)
-   `jest-expo`, `@testing-library/react-native`, `react-test-renderer` (testing)

### Backend (API Server)

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate  # Windows
pip install -r requirements.txt
python -m app.init_db
python -m uvicorn app.main:app --reload
```

---

**Last updated:** 2025-06-09
