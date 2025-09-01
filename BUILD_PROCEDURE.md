# Build Procedure - Volo Podcast App

## Pre-Build Checklist

### 1. Package Updates Check

```powershell
cd frontend
npm outdated
npm update
npm audit fix
```

### 2. Expo Doctor Check

```powershell
npx expo-doctor
# Fix any issues reported by expo-doctor
# Note: Use npx expo-doctor (not npx expo doctor)
```

### 3. Project Health Check

```powershell
# Check for any TypeScript/ESLint errors
npm run lint
# Run tests to ensure everything works
npm run test
```

### 4. Environment Configuration

-   Ensure `.env` files are properly configured
-   Verify API base URLs for different environments
-   Check EAS project configuration

## Build Commands

### Development Build (for testing)

```powershell
cd frontend
npx eas build --platform android --profile development
npx eas build --platform ios --profile development
```

### Preview Build (for internal testing)

```powershell
cd frontend
npx eas build --platform android --profile preview
npx eas build --platform ios --profile preview
```

### Production Build

```powershell
cd frontend
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
```

## Post-Build Steps

### Download and Install

```powershell
# Download latest build
npx eas build:download --platform android --latest --path .\builds\volo-latest.apk

# Install on emulator
adb -e install -r .\builds\volo-latest.apk

# Install on connected device
adb install -r .\builds\volo-latest.apk
```

### Build Status Check

```powershell
npx eas build:list --limit 10
```

## Important Notes

-   **Always run expo doctor before building**
-   **Update packages before major builds**
-   **Test on both emulator and real device**
-   **Keep build artifacts organized in builds/ folder**
-   **Use appropriate build profiles for different purposes**

## Troubleshooting

### Common Issues

1. **Package conflicts**: Run `npm audit fix` and `expo doctor`
2. **Build failures**: Check EAS logs and fix reported issues
3. **Installation issues**: Ensure device/emulator is properly connected
4. **Version conflicts**: Update all packages to compatible versions

### Build Profiles

-   **development**: For development and debugging
-   **preview**: For internal testing and demos
-   **production**: For app store releases
