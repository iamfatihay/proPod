# WiFi Değiştiğinde Yapılacaklar

## 🔄 Hızlı Rehber (5 Dakika)

### 1️⃣ Yeni IP'leri Öğren

**WSL Terminal:**
```bash
# WSL IP
ip addr show eth0 | grep "inet " | awk '{print $2}' | cut -d/ -f1
# Örnek: 172.20.131.67
```

**Windows PowerShell:**
```powershell
# Windows IP
ipconfig | findstr "IPv4"
# Örnek: 192.168.2.121
```

### 2️⃣ Port Forwarding Güncelle

**Windows PowerShell (Admin olarak aç):**

```powershell
# Eski kuralları sil
netsh interface portproxy delete v4tov4 listenport=8000 listenaddress=0.0.0.0
netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=0.0.0.0

# Yeni WSL IP ile ekle (WSL IP değişirse - nadiren olur)
netsh interface portproxy add v4tov4 listenport=8000 listenaddress=0.0.0.0 connectport=8000 connectaddress=<YENİ_WSL_IP>
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=<YENİ_WSL_IP>

# Kontrol et
netsh interface portproxy show all
```

### 3️⃣ Frontend .env Güncelle

**WSL Terminal:**
```bash
cd ~/proPod/frontend
nano .env

# Değiştir:
API_BASE_URL=http://<YENİ_WINDOWS_IP>:8000
EXPO_PUBLIC_API_URL=http://<YENİ_WINDOWS_IP>:8000
```

### 4️⃣ Test Et

```bash
# Backend test
curl http://<YENİ_WINDOWS_IP>:8000/docs

# Eğer çalışıyorsa:
# Backend + Frontend başlat
# QR scan et
# HAZIR! ✅
```

---

## 📝 Notlar

- **Windows IP** her WiFi değişiminde değişir (192.168.x.x formatı)
- **WSL IP** nadiren değişir (genelde 172.20.x.x sabit kalır)
- Port forwarding **kalıcıdır** (Windows restart sonrası bile kalır)
- Firewall kuralları **bir kez eklenir**, tekrar eklemeye gerek yok

---

## 🐛 Sorun Giderme

### Telefon "Failed to connect" diyor:

```bash
# 1. Backend çalışıyor mu?
pgrep -f uvicorn

# 2. Port forwarding doğru mu?
netsh interface portproxy show all  # Windows'ta

# 3. Firewall açık mı?
# Windows Güvenlik → Güvenlik Duvarı → 8000 ve 8081 portları açık mı?

# 4. Test et
curl http://<WINDOWS_IP>:8000/docs  # WSL'den
```

### Metro bundler bağlanamıyor:

```bash
# Expo'yu yeniden başlat
cd ~/proPod/frontend
pkill -f "expo"
npm run start:dev

# Yeni QR scan et
```
