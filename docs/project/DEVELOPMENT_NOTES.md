# Development Notes - ProPod Backend

## Schema vs Model Uyumsuzluk Kontrolü

### Problem

Schema ve Model arasındaki uyumsuzluklar Pydantic validation hatalarına neden olur. Bu sorunlar genellikle sessizce birikir ve production'da büyük sorunlara yol açabilir.

### Çözüm Adımları

#### 1. Veritabanı Kayıtlarını Kontrol Etme

```python
# Kullanıcıları kontrol etme
python -c "from app.database import SessionLocal; from app.models import User; db = SessionLocal(); users = db.query(User).all(); print(f'Total users: {len(users)}'); [print(f'User {u.id}: {u.email}, updated_at: {u.updated_at}') for u in users]; db.close()"

# Diğer modeller için benzer komutlar:
# PodcastLike kontrolü
python -c "from app.database import SessionLocal; from app.models import PodcastLike; db = SessionLocal(); likes = db.query(PodcastLike).all(); print(f'Total likes: {len(likes)}'); [print(f'Like {l.id}: user_id={l.user_id}, podcast_id={l.podcast_id}, updated_at={l.updated_at}') for l in likes]; db.close()"

# PodcastBookmark kontrolü
python -c "from app.database import SessionLocal; from app.models import PodcastBookmark; db = SessionLocal(); bookmarks = db.query(PodcastBookmark).all(); print(f'Total bookmarks: {len(bookmarks)}'); [print(f'Bookmark {b.id}: user_id={b.user_id}, podcast_id={b.podcast_id}, updated_at={b.updated_at}') for b in bookmarks]; db.close()"
```

#### 2. Mevcut Kayıtları Güncelleme

```python
# None olan updated_at field'larını güncelleme
python -c "from app.database import SessionLocal; from app.models import User; db = SessionLocal(); users = db.query(User).filter(User.updated_at.is_(None)).all(); [setattr(u, 'updated_at', u.created_at) for u in users]; db.commit(); print(f'Updated {len(users)} users'); db.close()"

# PodcastLike ve PodcastBookmark için
python -c "from app.database import SessionLocal; from app.models import PodcastLike, PodcastBookmark; db = SessionLocal(); likes = db.query(PodcastLike).filter(PodcastLike.updated_at.is_(None)).all(); bookmarks = db.query(PodcastBookmark).filter(PodcastBookmark.updated_at.is_(None)).all(); [setattr(item, 'updated_at', item.created_at) for item in likes + bookmarks]; db.commit(); print(f'Updated {len(likes)} likes and {len(bookmarks)} bookmarks'); db.close()"
```

### Alembic Migration Komutları

#### Migration Oluşturma

```bash
# Virtual environment'ı aktif et
source venv/bin/activate  # Linux/Mac
# veya
.\venv\Scripts\activate  # Windows PowerShell

# Migration oluştur
alembic revision --autogenerate -m "Migration açıklaması"

# Migration uygula
alembic upgrade head
```

#### Migration Geçmişi

```bash
# Migration geçmişini görüntüle
alembic history

# Belirli bir migration'a geri dön
alembic downgrade <revision_id>
```

### Tespit Edilen ve Çözülen Uyumsuzluklar

#### User Model/Schema

-   **Sorun:** `provider`, `photo_url` field'ları Model'de vardı ama Schema'da yoktu
-   **Çözüm:** User Schema'ya `provider` ve `photo_url` field'ları eklendi

#### PodcastLike Model/Schema

-   **Sorun:** `updated_at` field'ı hiçbirinde yoktu
-   **Çözüm:** Hem Model'e hem Schema'ya `updated_at` field'ı eklendi

#### PodcastBookmark Model/Schema

-   **Sorun:** `updated_at` field'ı hiçbirinde yoktu
-   **Çözüm:** Hem Model'e hem Schema'ya `updated_at` field'ı eklendi

### Önleyici Tedbirler

1. **Model değişikliklerinde Schema'ları da kontrol et**
2. **Alembic migration'larını düzenli kullan**
3. **Test coverage'ı artır**
4. **Schema validation testleri yaz**

### Yeni Paketler

#### Alembic

-   **Amaç:** Database migration yönetimi
-   **Kurulum:** `pip install alembic`
-   **Konfigürasyon:** `alembic init alembic`
-   **Kullanım:** Model değişikliklerinde otomatik migration oluşturma

### Önemli Notlar

-   Schema ve Model uyumsuzlukları production'da kritik hatalara neden olabilir
-   Alembic migration'ları production deployment için gerekli
-   Mevcut kayıtları güncellemek için script'ler yazılmalı
-   Bu kontrolleri düzenli olarak yapmak önemli
