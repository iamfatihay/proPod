# ProPod Frontend

React Native + Expo frontend application. See the main README.md in the project root for complete documentation.

## Quick Start

```bash
cd frontend
npm install
npx expo start --dev-client -c --tunnel
```

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

## Test

```bash
npm run test
npm run lint
```

For detailed information, see the main README.md file.