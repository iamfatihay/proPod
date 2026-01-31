# WiFi Değiştiğinde Yapılacaklar

## ⚡ Hızlı Rehber (2 Dakika)

### 1️⃣ Yeni Windows IP'yi Öğren

```powershell
# Windows PowerShell
ipconfig | findstr "IPv4"
# Örnek: 192.168.2.121
```

### 2️⃣ Backend .env Güncelle

```bash
cd ~/proPod/backend
nano .env
```

**Değiştir:**
```
BASE_URL=http://192.168.2.121:8000
```

### 3️⃣ Frontend .env Güncelle

```bash
cd ~/proPod/frontend
nano .env
```

**Değiştir (4 satır):**
```
API_BASE_URL=http://192.168.2.121:8000
EXPO_PUBLIC_API_URL=http://192.168.2.121:8000
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.2.121
EXPO_DEVTOOLS_LISTEN_ADDRESS=192.168.2.121
```

### 4️⃣ Başlat

```bash
# Backend
cd ~/proPod/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --reload

# Frontend (yeni terminal)
cd ~/proPod/frontend
npm run start:dev

# Telefonda QR tara → Çalışır! ✅
```

---

## 📝 Notlar

- **Windows IP** her WiFi'de değişir → .env güncellenir
- **Port forwarding** kalıcıdır → Güncelleme gereksiz
- **WSL IP** nadiren değişir → Aşağıya bak

---

## 🐛 Sorun Giderme

### Backend'e bağlanamıyor:

```bash
# Backend çalışıyor mu?
pgrep -f uvicorn

# Backend'e erişiliyor mu?
curl -I http://192.168.2.121:8000/docs  # 200 OK gelmeli

# .env doğru mu?
cat frontend/.env | grep API_BASE_URL
```

### Port forwarding kontrol:

```powershell
# Windows PowerShell
netsh interface portproxy show all
# 8000 ve 8081 görünmeli
```

### WSL IP değiştiyse (nadir):

```bash
# WSL IP öğren
ip addr show eth0 | grep "inet "
# Örnek: 172.20.131.67
```

```powershell
# Windows PowerShell (Admin)
# Port forwarding güncelle
netsh interface portproxy delete v4tov4 listenport=8000 listenaddress=0.0.0.0
netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=0.0.0.0

netsh interface portproxy add v4tov4 listenport=8000 listenaddress=0.0.0.0 connectport=8000 connectaddress=172.20.131.67
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=172.20.131.67
```
