# Network Configuration Guide

## 🌐 IP Address Configuration

This guide explains how to update the API IP address when your network changes.

## Problem

When you connect to a different WiFi network or your router assigns a new IP address, the app cannot connect to the backend server because it's using the old IP address.

## Solution: Single Source of Truth

We use `.env` files to centralize all IP configuration. **You only need to change the IP in ONE place!**

### Step 1: Find Your Current IP Address

**Windows PowerShell:**

```powershell
ipconfig | findstr "IPv4"
```

**Result example:**

```
IPv4 Address. . . . . . . . . . . : 192.168.178.27
```

### Step 2: Update Both .env Files

#### Frontend (.env file)

Location: `frontend/.env`

```env
# API Configuration
# Change this IP address when your network changes
API_BASE_URL=http://YOUR_IP_HERE:8000

# Other environment variables
ENV=dev
```

#### Backend (.env file)

Location: `backend/.env`

```env
# API Base URL (change IP when network changes)
BASE_URL=http://YOUR_IP_HERE:8000
```

**Example with IP 192.168.178.27:**

```env
API_BASE_URL=http://192.168.178.27:8000
BASE_URL=http://192.168.178.27:8000
```

### Step 3: Restart Servers

1. **Stop both servers** (Ctrl+C in each terminal)
2. **Restart Backend:**

    ```powershell
    cd backend
    .\venv\Scripts\Activate.ps1
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    ```

3. **Restart Frontend:**
    ```powershell
    cd frontend
    npx expo start --dev-client
    ```

### Step 4: Rebuild App (Only for New Builds)

If you're creating a new build for emulator/device:

```powershell
cd frontend
npx expo-doctor
npx eas build --platform android --profile preview
```

## ✅ Quick Checklist

When network changes:

-   [ ] Find new IP with `ipconfig | findstr "IPv4"`
-   [ ] Update `frontend/.env` → `API_BASE_URL`
-   [ ] Update `backend/.env` → `BASE_URL`
-   [ ] Restart backend server
-   [ ] Restart frontend server
-   [ ] (Optional) Build new APK if needed

## 🔧 How It Works

### Frontend

-   `frontend/.env` contains `API_BASE_URL`
-   `app.config.js` reads from `process.env.API_BASE_URL`
-   `apiService.js` uses value from `Constants.expoConfig.extra.apiBaseUrl`

### Backend

-   `backend/.env` contains `BASE_URL`
-   `config.py` automatically reads from `.env` using Pydantic
-   All audio URLs use `settings.BASE_URL`

## 📱 Testing

After changing IP:

1. **Test Backend:**

    - Open browser: `http://YOUR_IP:8000/docs`
    - Should see FastAPI docs

2. **Test Frontend:**
    - Open app on device/emulator
    - Try login/register
    - Try playing audio

## ❗ Common Issues

### "Connection timeout" or "Cannot connect to server"

-   ✅ Check if IP is correct in both `.env` files
-   ✅ Restart both servers
-   ✅ Check firewall allows port 8000

### "Audio files not playing"

-   ✅ Check backend `.env` has correct `BASE_URL`
-   ✅ Verify `media/audio` folder exists in backend
-   ✅ Restart backend server

### "Old IP still being used"

-   ✅ Rebuild the app with new IP
-   ✅ Clear Metro cache: `npx expo start -c`

## 🎯 Pro Tip

For development, consider using `localhost` tunneling services like:

-   **ngrok**: Creates stable URL that doesn't change
-   **localtunnel**: Free alternative
-   **Expo Tunnel**: Built-in with `npx expo start --tunnel`

This way you won't need to update IP addresses frequently!

## 📝 Notes

-   `.env` files are gitignored by default
-   Never commit real IP addresses to git
-   Use environment variables for all configuration
-   Keep `.env.example` files for documentation
