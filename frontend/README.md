# ProPod Frontend Development

This document provides instructions for setting up and running the frontend development environment for the ProPod application.

## 🚀 Getting Started

The project uses a custom **Expo Development Client**. This provides a more stable and powerful development experience compared to the standard Expo Go app, allowing for the use of custom native libraries.

### 1. Initial Setup (Only once)

If you are setting up the project for the first time, or after adding/updating a native dependency, you need to build a new development client:

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies (the .npmrc file will handle peer dependency issues)
npm install

# Build the development client using EAS
npx eas build --profile development --platform android
```

After the build is complete, EAS will provide a link or a QR code. Use this to download and install the `.apk` file on your Android emulator or physical device. This new app will be named **"Volo"**.

**Important:** You will no longer use the standard "Expo Go" app from the Play Store for development.

### 2. Running the Development Server

To start the development server and connect your app, run the following command from the `frontend` directory:

```bash
# Start the server with cache clearing and a tunnel for stable connection
npx expo start --dev-client -c --tunnel
```

-   `--dev-client`: Tells Expo to connect to our custom "Volo" app.
-   `-c`: Clears the Metro bundler cache to prevent issues.
-   `--tunnel`: Ensures a stable connection for both emulators and physical devices, regardless of network conditions.

Once the server is running, open the **"Volo"** app on your device/emulator. It should automatically detect and connect to the development server. If not, scan the QR code displayed in your terminal.
