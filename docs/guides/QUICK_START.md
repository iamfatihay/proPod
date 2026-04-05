# Quick Start Guide

This guide covers the current development setup for ProPod.

## Requirements

- Python for the FastAPI backend
- Node.js and npm for the Expo frontend
- An installed development build on a device or emulator
- Expo Go is not supported

## Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m app.init_db
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Windows PowerShell:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m app.init_db
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend Setup

```bash
cd frontend
npm install
```

Common startup modes:

```bash
# Starts the repo helper flow on LAN
npm run dev

# Starts the repo helper flow with tunnel support
npm run dev:tunnel

# Expo only, if backend is already running
npm run start:dev
npm run start:dev:tunnel
```

## Development Build Notes

- Use a development build, not Expo Go.
- Native modules include audio, notifications, and native Google sign-in.
- If native dependencies change, rebuild the development client.

Android development build example:

```bash
cd frontend
npx eas build --profile development --platform android
```

## First Smoke Test

After startup, verify these flows:

1. Local register and local login
2. Google sign-in on the installed development build
3. Home feed loads successfully
4. Record a short podcast and save it
5. Playback works and continue listening appears after leaving details

For wider manual coverage, use [../testing/MANUAL_REGRESSION_REENTRY_GUIDE.md](../testing/MANUAL_REGRESSION_REENTRY_GUIDE.md).

## Troubleshooting

### Backend tests refuse to run

That is expected if `DATABASE_URL` points to the normal dev DB. Use a disposable test DB:

```bash
cd backend
source venv/bin/activate
DATABASE_URL=sqlite:///./test.db pytest tests/ -q
```

### Google sign-in still behaves like the old build

Rebuild and reinstall the development client. Native auth changes are not picked up by a normal JS reload.

### Expo cannot reach the backend from the device

- Use `npm run dev:tunnel` if LAN routing is unreliable.
- Confirm the backend is reachable on port `8000`.

### `pip install -r requirements.txt` fails unexpectedly on Linux/WSL

Check the file encoding of `backend/requirements.txt` and convert it to UTF-8 if needed.

Last updated: 2026-04-05
- [ ] App responsive
- [ ] No memory leaks (test with Profiler)

### Cross-Platform
- [ ] iOS: Haptic feedback works
- [ ] Android: Elevation shadows work
- [ ] Both: BlurView renders (or fallback)
- [ ] Both: Navigation smooth

---

## 🎨 Screenshot Checklist

Test sırasında ekran görüntüleri al:

1. **Discover Mode - Hero Section**
   - Continue Listening variant
   - Welcome variant

2. **Studio Mode - Hero Section**
   - Quick Record CTA
   - Latest episode stats

3. **For You Section**
   - Gradient cards (Technology, Business, Health)
   - AI badge visible

4. **Trending Section**
   - Top 3 list
   - Engagement indicators

5. **Empty States**
   - Discover mode empty
   - Studio mode empty
   - Error state

6. **Mode Toggle**
   - Discover active
   - Studio active
   - Tutorial tooltip

---

## 📝 Bug Report Template

Eğer sorun bulursan:

```markdown
**Platform:** iOS / Android
**Device:** Model + OS Version
**Issue:** [Kısa açıklama]

**Adımlar:**
1. ...
2. ...

**Beklenen:** [Ne olmalıydı]
**Gerçek:** [Ne oldu]

**Screenshot:** [Ekle]
**Logs:** [Konsol log'ları]
```

---

## 🚀 Production Deploy Hazırlığı

### Pre-Deploy Checklist
- [ ] Tüm test'ler geçiyor (`npm test`)
- [ ] Linter temiz (`npm run lint`)
- [ ] Production build başarılı
- [ ] Physical device'da test edildi
- [ ] Performance profiling yapıldı
- [ ] Memory leaks yok
- [ ] Crash-free test session

### Deploy Commands
```bash
# Android
cd frontend
npx eas build --platform android --profile production

# iOS
npx eas build --platform ios --profile production
```

---

## 🎉 Tebrikler!

Yeni ana ekran tasarımını başarıyla test ettin! 

### Feedback Toplama
- Kullanıcı deneyimi nasıl?
- Hangi modda daha çok vakit geçiriliyor?
- Gradient card'lar dikkat çekici mi?
- Empty states yönlendirici mi?

### Next Steps
1. Analytics entegrasyonu
2. A/B testing
3. User feedback toplama
4. Iteration planning

---

**Hazırlayan:** AI Assistant  
**Tarih:** 5 Kasım 2025  
**Versiyon:** 1.0.0  

**Keyifli testler! 🎉🚀**

