# proPod - Mobile Podcast Application

## 📱 Project Description

proPod is a mobile application that enables users to create, broadcast, and edit podcast content with AI assistance.

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

-   **Navigation:** React Navigation
-   **Styling:** React Native StyleSheet
-   **State Management:** Context API / Redux Toolkit (future)
-   **Audio/Video:** Expo AV, Expo Audio

### Backend (FastAPI)

-   **Authentication:** JWT
-   **Database:** PostgreSQL / SQLite
-   **AI Integration:** OpenAI API
-   **Streaming:** WebRTC / Socket.IO

## 📁 Project Structure

```
proPod/
├── frontend/          # React Native mobile app
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── screens/       # App screens
│   │   ├── services/      # API, streaming, audio services
│   │   ├── utils/         # Helper functions
│   │   ├── constants/     # Constants and configurations
│   │   ├── navigation/    # Navigation setup
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

### Frontend

```bash
cd frontend
npm install
npx expo start
```

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

**Last updated:** ${new Date().toLocaleDateString('en-US')}
