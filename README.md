# proPod - Mobile Podcast Application

## 📱 Project Description

proPod is a cross-platform (Android, iOS, Web) mobile application that enables users to create, broadcast, and edit podcast content with AI assistance. The project is designed as an MVP for rapid development, scalability, and maintainability, targeting both individual creators and teams.

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
-   **Styling:** React Native Paper, React Native StyleSheet
-   **State Management:** Zustand
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
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

**Last updated:** 2025-06-09
