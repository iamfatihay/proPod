# 🎨 Admin Panel Customization Guide

## 📋 Ne Kontrol Edebilirsin?

SQLAdmin'de `ModelView` class'ında kullanabileceğin tüm parametreler:

---

## 1️⃣ **GÖRÜNTÜLEME AYARLARI**

### **Liste Sayfası (List View)**

```python
class PodcastAdmin(ModelView, model=models.Podcast):
    # Hangi kolonlar görünsün
    column_list = [
        models.Podcast.id,
        models.Podcast.title,
        models.Podcast.category,
        models.Podcast.is_public
    ]
    
    # Detay sayfasında gizlenecek kolonlar
    column_details_exclude_list = [models.Podcast.description]
    
    # Liste sayfasında gizlenecek kolonlar  
    column_exclude_list = [models.Podcast.audio_url]
    
    # Kolon etiketleri (görünen isimler)
    column_labels = {
        "title": "Başlık",
        "category": "Kategori",
        "is_public": "Herkese Açık"
    }
    
    # Kolon genişlikleri
    column_formatters = {
        "title": lambda m, a: m.title[:50] + "..." if len(m.title) > 50 else m.title
    }
```

---

## 2️⃣ **ARAMA & SIRALAMA**

```python
class PodcastAdmin(ModelView, model=models.Podcast):
    # Aranabilir kolonlar (text search)
    column_searchable_list = [
        models.Podcast.title,
        models.Podcast.description
    ]
    
    # Sıralanabilir kolonlar
    column_sortable_list = [
        models.Podcast.created_at,
        models.Podcast.title
    ]
    
    # Varsayılan sıralama
    column_default_sort = ("created_at", True)  # True = descending
    # Veya multiple:
    column_default_sort = [("created_at", True), ("title", False)]
```

---

## 3️⃣ **PAGINATION (Sayfalama)**

```python
class PodcastAdmin(ModelView, model=models.Podcast):
    # Sayfa başına kayıt
    page_size = 50
    
    # Kullanıcının seçebileceği seçenekler
    page_size_options = [25, 50, 100, 200]
```

---

## 4️⃣ **FORM AYARLARI (Create/Edit)**

```python
class UserAdmin(ModelView, model=models.User):
    # Form'dan hariç tutulacak alanlar
    form_excluded_columns = [
        models.User.hashed_password,
        models.User.reset_token
    ]
    
    # Sadece okunabilir alanlar
    form_widget_args = {
        "created_at": {"readonly": True},
        "updated_at": {"readonly": True},
        "id": {"readonly": True}
    }
    
    # Form kolon etiketleri
    form_columns = [
        models.User.email,
        models.User.name,
        models.User.role,
        models.User.is_active
    ]
    
    # Ajax ile load edilecek relationship'ler
    form_ajax_refs = {
        "podcasts": {
            "fields": ("title",),
            "page_size": 10
        }
    }
```

---

## 5️⃣ **İZİNLER (Permissions)**

```python
class PodcastAdmin(ModelView, model=models.Podcast):
    # Yeni kayıt oluşturabilir mi?
    def can_create(self) -> bool:
        # Session'dan user role'ünü kontrol et
        return True  # veya False
    
    # Kayıt silinebilir mi?
    def can_delete(self) -> bool:
        return True
    
    # Kayıt düzenlenebilir mi?
    def can_edit(self) -> bool:
        return True
    
    # Detay sayfası görülebilir mi?
    def can_view_details(self) -> bool:
        return True
    
    # Export yapılabilir mi?
    def can_export(self) -> bool:
        return True
```

---

## 6️⃣ **İKON & İSİMLER**

```python
class PodcastAdmin(ModelView, model=models.Podcast):
    # Menüdeki isim (tekil)
    name = "Podcast"
    
    # Menüdeki isim (çoğul)
    name_plural = "Podcasts"
    
    # Font Awesome ikonu
    icon = "fa-solid fa-podcast"
    # Diğer örnekler:
    # "fa-solid fa-user"        # Kullanıcı
    # "fa-solid fa-chart-line"  # İstatistikler
    # "fa-solid fa-robot"       # AI
    # "fa-solid fa-heart"       # Like
    # "fa-solid fa-bookmark"    # Bookmark
```

---

## 7️⃣ **EXPORT (Veri İndirme)**

```python
class PodcastAdmin(ModelView, model=models.Podcast):
    # Export yapılabilir mi?
    can_export = True
    
    # Export edilecek kolonlar
    export_columns = [
        models.Podcast.id,
        models.Podcast.title,
        models.Podcast.category
    ]
    
    # Export formatları
    export_types = ["csv", "json", "excel"]
    
    # Export dosya adı
    export_max_rows = 1000  # Maksimum satır
```

---

## 8️⃣ **CUSTOM ACTIONS (Toplu İşlemler)**

```python
from sqladmin import action

class PodcastAdmin(ModelView, model=models.Podcast):
    # Toplu işlem butonu
    @action(
        name="publish_all",
        label="Hepsini Yayınla",
        confirmation_message="Emin misin?",
        add_in_detail=False,  # Detay sayfasında gösterme
        add_in_list=True      # Liste sayfasında göster
    )
    async def publish_all(self, request):
        pks = request.query_params.get("pks", "").split(",")
        # pks = seçilen podcast ID'leri
        # İşlem yap...
        return f"{len(pks)} podcast yayınlandı!"
```

---

## 9️⃣ **CUSTOM QUERIES (Özel Sorgular)**

```python
class PodcastAdmin(ModelView, model=models.Podcast):
    # Liste sorgusu özelleştir
    async def get_list(self, *args, **kwargs):
        # Sadece aktif podcast'leri göster
        return await super().get_list(*args, **kwargs)
    
    # Count sorgusunu özelleştir
    async def get_count(self, *args, **kwargs):
        return await super().get_count(*args, **kwargs)
```

---

## 🔟 **RELATIONSHIPS (İlişkiler)**

```python
class PodcastAdmin(ModelView, model=models.Podcast):
    # İlişkili kolonları göster
    column_list = [
        models.Podcast.id,
        models.Podcast.title,
        models.Podcast.owner,  # Relationship gösterilir
    ]
    
    # İlişkili kolonları detayda göster
    column_details_list = [
        models.Podcast.title,
        models.Podcast.owner,
        models.Podcast.likes,     # One-to-many
        models.Podcast.comments   # One-to-many
    ]
```

---

## 🎨 **GLOBAL ADMIN AYARLARI** (setup_admin)

```python
def setup_admin(app):
    admin = Admin(
        app=app,
        engine=engine,
        
        # Panel başlığı
        title="proPod Admin Panel",
        
        # Logo URL
        logo_url="/static/logo.png",
        
        # Favicon
        favicon_url="/static/favicon.ico",
        
        # Base URL (sub-path için)
        base_url="/admin",
        
        # Authentication backend
        authentication_backend=AdminAuth(secret_key="..."),
        
        # Custom templates klasörü
        templates_dir="app/admin_templates",
        
        # Custom static files klasörü  
        statics_dir="app/admin_statics",
    )
    return admin
```

---

## 📊 **ÖRNEK: TAM KONTROL EDİLMİŞ MODEL**

```python
class PodcastAdmin(ModelView, model=models.Podcast):
    # Genel
    name = "Podcast"
    name_plural = "Podcasts"
    icon = "fa-solid fa-podcast"
    
    # Liste görünümü
    column_list = [
        models.Podcast.id,
        models.Podcast.title,
        models.Podcast.category,
        models.Podcast.owner,
        models.Podcast.is_public,
        models.Podcast.created_at
    ]
    
    # Arama
    column_searchable_list = [
        models.Podcast.title,
        models.Podcast.description
    ]
    
    # Sıralama
    column_sortable_list = [
        models.Podcast.created_at,
        models.Podcast.title
    ]
    column_default_sort = ("created_at", True)
    
    # Pagination
    page_size = 50
    page_size_options = [25, 50, 100]
    
    # Form
    form_excluded_columns = [
        models.Podcast.is_deleted,
        models.Podcast.deleted_at
    ]
    
    form_widget_args = {
        "created_at": {"readonly": True},
        "updated_at": {"readonly": True}
    }
    
    # İzinler
    def can_delete(self) -> bool:
        # Sadece owner veya admin silebilir
        return True
    
    def can_create(self) -> bool:
        return True
    
    # Export
    can_export = True
    export_types = ["csv", "json"]
```

---

## 🚀 **HEMEN DENEYEBİLECEĞİN ÖZELLİKLER**

### 1. İkonları Değiştir:
```python
# admin.py'de
icon = "fa-solid fa-microphone"  # Podcast için
icon = "fa-solid fa-users"       # Users için
```

### 2. Sayfa Başına Kayıt Artır:
```python
page_size = 100
```

### 3. Türkçe Etiketler Ekle:
```python
column_labels = {
    "title": "Başlık",
    "description": "Açıklama",
    "created_at": "Oluşturulma Tarihi"
}
```

### 4. Bazı Kolonları Gizle:
```python
column_exclude_list = [models.Podcast.audio_url]
```

---

## 📚 **KAYNAK**

SQLAdmin Docs: https://aminalaee.dev/sqladmin/

Font Awesome Icons: https://fontawesome.com/search?o=r&m=free

---

**Şimdi ne değiştirmek istersin?** 🎨
