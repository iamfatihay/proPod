# ProPod - Podcast Uygulaması

## Proje Yapısı

```
proPod/
├── frontend/          # React Native uygulaması
├── backend/           # FastAPI backend servisi
│   ├── app/          # Ana uygulama kodu
│   ├── alembic/      # Database migration'ları
│   ├── tests/        # Test dosyaları
│   └── DEVELOPMENT_NOTES.md  # Geliştirici notları
└── README.md         # Bu dosya
```

## Önemli Geliştirici Notları

### Schema vs Model Uyumsuzlukları

Bu projede Schema (Pydantic) ve Model (SQLAlchemy) arasındaki uyumsuzluklar kritik hatalara neden olabilir. 

**Kontrol Komutları:**
```bash
# Backend dizinine git
cd backend

# Virtual environment'ı aktif et
.\venv\Scripts\Activate.ps1

# Kullanıcıları kontrol et
python -c "from app.database import SessionLocal; from app.models import User; db = SessionLocal(); users = db.query(User).all(); print(f'Total users: {len(users)}'); [print(f'User {u.id}: {u.email}, updated_at: {u.updated_at}') for u in users]; db.close()"
```

**Detaylı bilgi:** `backend/DEVELOPMENT_NOTES.md`

### Database Migration'ları

Model değişikliklerinde Alembic migration'ları kullanın:

```bash
# Migration oluştur
alembic revision --autogenerate -m "Migration açıklaması"

# Migration uygula
alembic upgrade head
```

### Yeni Paketler

#### Alembic (Database Migrations)
- **Kurulum:** `pip install alembic`
- **Konfigürasyon:** `alembic init alembic`
- **Kullanım:** Model değişikliklerinde otomatik migration oluşturma

### Önemli Commit'ler

- **2025-01-19:** Schema vs Model uyumsuzlukları çözüldü, Alembic migration sistemi kuruldu
- **2025-01-15:** Podcast duration storage, media handling, API documentation

### Geliştirme Kuralları

1. **Model değişikliklerinde Schema'ları da kontrol et**
2. **Alembic migration'larını düzenli kullan**
3. **Schema vs Model uyumsuzluklarını düzenli kontrol et**
4. **Test coverage'ı artır**
5. **Dokümantasyonu güncel tut**

### Hızlı Başlangıç

#### Backend
```bash
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend
```bash
cd frontend
npm install
npx expo start
```

### Sorun Giderme

#### Pydantic Validation Hataları
- Schema ve Model'lerin uyumlu olduğundan emin olun
- `DEVELOPMENT_NOTES.md` dosyasındaki kontrol komutlarını kullanın

#### Database Migration Sorunları
- Alembic migration'larını düzenli uygulayın
- Migration geçmişini kontrol edin: `alembic history`

#### Login Endpoint Hataları
- User model'indeki `updated_at` field'ının dolu olduğundan emin olun
- Mevcut kullanıcıları güncelleyin: `DEVELOPMENT_NOTES.md` dosyasındaki komutları kullanın
