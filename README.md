# ProPod - Podcast Uygulaması

## 📱 Proje Açıklaması

ProPod, AI destekli podcast kaydetme, yayınlama ve düzenleme için cross-platform (Android, iOS, Web) mobil uygulamasıdır. Hızlı MVP geliştirme, ölçeklenebilirlik ve sürdürülebilirlik için tasarlanmıştır.

---

## 🆕 Son Güncellemeler (2025-01-19)

-   **Schema vs Model uyumsuzlukları çözüldü** - User, PodcastLike, PodcastBookmark modellerinde eksik field'lar eklendi
-   **Alembic Migration sistemi** - Database migration yönetimi için Alembic kuruldu ve yapılandırıldı
-   **Pydantic validation hataları çözüldü** - Login endpoint'indeki validation hataları tamamen giderildi
-   **Database tutarlılığı** - Tüm Schema ve Model'ler artık tamamen uyumlu
-   **Development dokümantasyonu** - Schema/Model kontrol komutları ve migration rehberi eklendi
-   **Fixed podcast duration storage and display** - Duration field added to PodcastCreate schema, AI transcription duration persistence implemented
-   **Enhanced podcast interactions** - Like/bookmark toggle functionality with visual feedback in details page
-   **Improved UI consistency** - Unified header design across all detail pages using Appbar.Header

---

## 🛠 Teknoloji Stack'i

### Frontend (React Native + Expo)
-   **expo-router**: File-based navigation
-   **NativeWind**: Tailwind CSS for React Native styling
-   **React Native Paper**: UI components
-   **Zustand**: Simple global state management
-   **expo-av**: Audio recording/playback
-   **expo-file-system**: File management
-   **expo-secure-store**: Secure token storage (authentication)
-   **expo-auth-session**: Google OAuth integration
-   **@expo/vector-icons**: Icons
-   **jest-expo, @testing-library/react-native**: Testing

### Backend (FastAPI)
-   **FastAPI**: Python web API framework
-   **SQLAlchemy**: ORM for database
-   **Alembic**: Database Migrations
-   **JWT (python-jose)**: Authentication
-   **PostgreSQL / SQLite**: Database
-   **passlib**: Password hashing
-   **python-dotenv**: Environment variable management
-   **AI Services**: Whisper, Content Analysis

---

## 🚀 Hızlı Başlangıç

### 1. Backend Kurulumu

```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
pip install -r requirements.txt
# .env dosyası oluştur (backend/.env.example'a bak)
python -m app.init_db
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend Kurulumu

```bash
cd frontend
npm install
# .env dosyası oluştur (frontend/.env.example'a bak)
# API_BASE_URL=http://localhost:8000
npx expo start --dev-client -c --tunnel
```

### 3. Cihaz/Emülatörde Çalıştırma

-   Android: `npm run android`
-   iOS: `npm run ios`
-   Web: `npm run web`

---

## 📁 Proje Yapısı

```
proPod/
├── frontend/          # React Native uygulaması
│   ├── app/          # Screens (expo-router)
│   ├── src/          # Components, services, state, etc.
│   └── android/      # Android build files
├── backend/           # FastAPI backend servisi
│   ├── app/          # API, models, routers
│   ├── alembic/      # Database migration'ları
│   └── tests/        # Test dosyaları
└── docs/             # Detaylı dokümantasyon
    ├── DEVELOPMENT_NOTES.md
    ├── API_DOCUMENTATION.md
    ├── AI_INTEGRATION_GUIDE.md
    └── TEST_DOCUMENTATION.md
```

---

## 🔧 Geliştirici Notları

### Schema vs Model Uyumsuzlukları

Bu projede Schema (Pydantic) ve Model (SQLAlchemy) arasındaki uyumsuzluklar kritik hatalara neden olabilir.

**Kontrol Komutları:**
```bash
# Backend dizinine git
cd backend
.\venv\Scripts\Activate.ps1

# Kullanıcıları kontrol et
python -c "from app.database import SessionLocal; from app.models import User; db = SessionLocal(); users = db.query(User).all(); print(f'Total users: {len(users)}'); [print(f'User {u.id}: {u.email}, updated_at: {u.updated_at}') for u in users]; db.close()"
```

### Database Migration'ları

Model değişikliklerinde Alembic migration'ları kullanın:

```bash
# Migration oluştur
alembic revision --autogenerate -m "Migration açıklaması"

# Migration uygula
alembic upgrade head
```

### Build İşlemleri

```bash
# Frontend build
cd frontend
npx expo-doctor  # Önce kontrol et
npx eas build --platform android --profile development

# Backend Docker build
cd backend
docker build -t propod-backend .
docker run -p 8000:8000 --env-file .env propod-backend
```

---

## 📋 Ana API Endpoints

-   `/users/register` : Kullanıcı kaydı
-   `/users/login` : Kullanıcı girişi (JWT)
-   `/podcasts/create` : Podcast oluşturma
-   `/podcasts/upload` : Ses dosyası yükleme
-   `/podcasts/{id}/process-ai` : AI işleme (transkripsiyon, analiz)
-   `/podcasts/{id}/like` : Podcast beğenme/beğenmeme
-   `/podcasts/{id}/bookmark` : Podcast yer imi ekleme/çıkarma
-   `/podcasts/{id}/interactions` : Kullanıcı etkileşimlerini getirme

---

## 🌟 Proje Hedefleri

-   Yüksek kaliteli ses kaydı ve düzenleme
-   AI destekli özellikler (transkripsiyon, gürültü azaltma)
-   Canlı podcast yayını (gelecek)
-   Basit, ölçeklenebilir state management
-   Modern, responsive UI/UX
-   Güvenli authentication ve Google OAuth desteği

---

## 📝 Önemli Notlar

-   Tüm environment değişkenleri `.env` dosyaları ile yönetilir (asla commit etmeyin!)
-   Sadece proje kökünde bir `.gitignore` kullanılır
-   Local development için SQLite; production için PostgreSQL kullanın
-   Android emülatör için API base URL olarak `10.0.2.2` kullanın; gerçek cihaz için bilgisayarınızın local IP'sini kullanın
-   **Schema vs Model uyumsuzlukları kontrol edilmeli** - Model değişikliklerinde Schema'ları da kontrol edin
-   **Alembic migration'ları düzenli kullanın** - Model değişikliklerinde migration oluşturun
-   **Pydantic validation hataları** - Schema ve Model'lerin uyumlu olduğundan emin olun

---

## 🚨 Sorun Giderme

### Pydantic Validation Hataları
- Schema ve Model'lerin uyumlu olduğundan emin olun
- Mevcut kayıtları güncelleyin: `DEVELOPMENT_NOTES.md` dosyasındaki komutları kullanın

### Database Migration Sorunları
- Alembic migration'larını düzenli uygulayın
- Migration geçmişini kontrol edin: `alembic history`

### Login Endpoint Hataları
- User model'indeki `updated_at` field'ının dolu olduğundan emin olun
- Mevcut kullanıcıları güncelleyin

---

**Son güncelleme:** 2025-01-19