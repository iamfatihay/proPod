# proPod - Mobile Podcast Application

## 📱 Project Description

proPod is a cross-platform (Android, iOS, Web) mobile application that enables users to create, broadcast, and edit podcast content with AI assistance.

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
-   **Styling:** React Native StyleSheet
-   **State Management:** Context API / Redux Toolkit (future)
-   **Audio/Video:** Expo AV, Expo Audio
-   **Web Support:** Requires `react-dom` and `react-native-web` dependencies

### Backend (FastAPI)

-   **Authentication:** JWT
-   **Database:** PostgreSQL / SQLite
-   **AI Integration:** OpenAI API
-   **Streaming:** WebRTC / Socket.IO

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

### Backend (API Server)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

**Last updated:** 2025-06-09
