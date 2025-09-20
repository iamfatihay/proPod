# ProPod Frontend

React Native + Expo tabanlı frontend uygulaması. Ana dokümantasyon için proje kökündeki README.md dosyasına bakın.

## Hızlı Başlangıç

```bash
cd frontend
npm install
npx expo start --dev-client -c --tunnel
```

## Environment Variables

`.env` dosyası oluşturun:

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

Detaylı bilgi için ana README.md dosyasına bakın.