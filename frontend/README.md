# ProPod Frontend

React Native + Expo frontend application. See the main README.md in the project root for complete documentation.

## Quick Start

```bash
cd frontend
npm install
npm run start:dev:tunnel
```

Use a development build. Expo Go is not supported because the app depends on native modules such as notifications, audio, and native Google sign-in.

## Environment Variables

Create `.env` file:

```env
API_BASE_URL=http://localhost:8000
```

## Build

```bash
# Development build
npx eas build --platform android --profile development

# Production build
npx eas build --platform android --profile production
```

## Authentication Notes

- Google sign-in uses `@react-native-google-signin/google-signin`.
- If native auth dependencies change, rebuild the development client before testing.

## Test

```bash
npm run test
npm run test:ci
npm run lint
```

For detailed information, see the main README.md file.
