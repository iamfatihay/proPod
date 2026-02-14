# GitHub Actions CI/CD Pipeline

Bu dizin proPod projesi için GitHub Actions workflow'larını içerir.

## 📋 Mevcut Workflow'lar

### 1. Full CI Pipeline (`ci.yml`)
**Tetiklenme:** Her PR ve push'ta (master, main, develop branch'leri için)

Bu workflow hem backend hem frontend testlerini paralel olarak çalıştırır ve genel durumu raporlar.

- ✅ **Backend testleri**: Python/FastAPI testleri
- ✅ **Frontend testleri**: Jest ile React Native testleri
- ✅ **Final status check**: Tüm testlerin durumunu kontrol eder

### 2. Backend CI (`backend-ci.yml`)
**Tetiklenme:** Backend dosyalarında değişiklik olduğunda

Backend için özel CI pipeline:
- Python 3.11 kurulumu
- PostgreSQL test veritabanı
- FFmpeg kurulumu (audio processing için)
- Pytest ile testler
- Test environment değişkenleri

### 3. Frontend CI (`frontend-ci.yml`)
**Tetiklenme:** Frontend dosyalarında değişiklik olduğunda

Frontend için özel CI pipeline:
- Node.js 20.x kurulumu
- NPM dependency kurulumu
- ESLint kontrolü
- Jest testleri
- Coverage raporu

## 🚀 Kullanım

### PR Açarken
1. Yeni bir branch oluşturun
2. Değişikliklerinizi commit edin
3. PR açın → Otomatik olarak CI pipeline başlar
4. PR sayfasında test sonuçlarını görün
5. Tüm testler geçerse merge edebilirsiniz

### Lokal Test Etme

**Backend:**
```bash
cd backend
pytest tests/ -v
```

**Frontend:**
```bash
cd frontend
npm test
# veya CI modunda
npm run test:ci
```

## 🔧 Workflow Yapılandırması

### Branch Koruması (Önerilen)
GitHub repo ayarlarından branch protection rules ekleyin:

1. Settings → Branches → Add rule
2. Branch pattern: `master` (veya `main`)
3. ✅ Require status checks to pass before merging
4. Seçin: `Backend Tests`, `Frontend Tests`, `All Tests Passed ✓`
5. ✅ Require branches to be up to date before merging

### Environment Secrets
CI için gereken secret'lar (ileride eklenebilir):
- `OPENAI_API_KEY`: OpenAI API anahtarı (production testleri için)
- `ASSEMBLYAI_API_KEY`: AssemblyAI API anahtarı
- Diğer production environment değişkenleri

## 📊 Status Badge Ekleme

README.md dosyanıza ekleyebilirsiniz:

```markdown
![CI Status](https://github.com/iamfatihay/proPod/workflows/Full%20CI%20Pipeline/badge.svg)
```

## 🔍 Sorun Giderme

### Backend testleri başarısız oluyor
- PostgreSQL bağlantı sorunları: Service configuration'ı kontrol edin
- FFmpeg eksik: Workflow'da kurulum adımı var mı kontrol edin
- Environment variables: Test environment ayarlarını kontrol edin

### Frontend testleri başarısız oluyor
- Node version uyumsuzluğu: package.json'da engine gereksinimi kontrol edin
- Cache sorunları: Workflow'da cache'i temizleyin
- Lint hataları: Lokal'de `npm run lint:fix` çalıştırın

### Workflow çalışmıyor
- Branch isimleri doğru mu kontrol edin (master/main/develop)
- Path filters: Sadece ilgili dosyalar değiştiğinde tetiklenir
- YAML syntax: Workflow dosyalarında syntax hatası var mı kontrol edin

## 📝 Notlar

- Backend ve frontend testleri **paralel** çalışır (daha hızlı)
- Frontend lint hataları workflow'u durdurmaz (`continue-on-error: true`)
- Test veritabanı her CI run'da temiz bir PostgreSQL container ile başlar
- Cache kullanımı dependency kurulumunu hızlandırır

## 🎯 Gelecek İyileştirmeler

- [ ] E2E testleri için workflow ekle
- [ ] Code coverage raporunu PR'a yorum olarak ekle
- [ ] Docker build testleri
- [ ] Deploy workflow'ları (staging/production)
- [ ] Performance benchmark testleri
- [ ] Security scanning (Dependabot, CodeQL)
