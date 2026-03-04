# Dev Başlatma Rehberi

## ⚡ Tek Komutla Başlat

Eskiden WiFi değişince 4 satır .env güncellemesi gerekiyordu.
Artık tek komut yeterli:

```bash
# Aynı WiFi'deysen (telefon + laptop):
bash scripts/start-dev.sh

# Webhook testi / farklı ağ / mobil data ise:
bash scripts/start-dev-tunnel.sh
```

`start-dev.sh` ne yapar:
1. Windows WiFi IP'yi PowerShell ile otomatik algılar
2. `frontend/.env` → `REACT_NATIVE_PACKAGER_HOSTNAME` günceller
3. `API_BASE_URL`'yi boşaltır → `apiService.js` otomatik algılar
4. Backend'i başlatır (arka planda)
5. Expo'yu LAN modunda başlatır

---

## Ne Zaman Hangi Scripti Kullanmalısın?

| Durum | Script |
|-------|--------|
| Telefon ve laptop aynı WiFi | `start-dev.sh` |
| 100ms RTC webhook testi | `start-dev-tunnel.sh` |
| Telefon mobil datada | `start-dev-tunnel.sh` |
| Uzaktan test / başkasıyla paylaşım | `start-dev-tunnel.sh` |

---

## Nasıl Çalışıyor? (Teknik Detay)

**LAN modunda (`start-dev.sh`):**

```
Telefon → Windows:8000 → (port forwarding) → WSL:8000 (Backend)
Telefon → Windows:8081 → (port forwarding) → WSL:8081 (Metro)
```

`apiService.js` içinde auto-detect mantığı var:
```javascript
// API_BASE_URL boşsa, Metro'nun hostUri'sinden türet
const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0];
return `http://${debuggerHost}:8000`;
```
`REACT_NATIVE_PACKAGER_HOSTNAME=192.168.x.x` olduğunda, `hostUri = 192.168.x.x:8081`
→ API URL otomatik olarak `http://192.168.x.x:8000` olur.
→ WiFi değişince script'i bir kez çalıştırmak yeterli.

**Tunnel modunda (`start-dev-tunnel.sh`):**

```
Telefon → ngrok URL → Backend
Telefon → Expo tunnel → Metro
```

Script ngrok'u başlatır, URL'yi otomatik okur, `API_BASE_URL` günceller.
100ms webhook endpoint'ini ngrok URL'siyle konfigüre edebilirsin:
```
$NGROK_URL/rtc/webhook
```

---

## Manuel Başlatma (Script Çalışmazsa)

### 1. Windows IP'yi öğren

```powershell
# Windows PowerShell
ipconfig | findstr "IPv4"
# Örnek: 192.168.2.121
```

### 2. frontend/.env güncelle

```bash
cd ~/proPod/frontend
nano .env
```

Değiştir:
```
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.2.121
EXPO_DEVTOOLS_LISTEN_ADDRESS=192.168.2.121
API_BASE_URL=
EXPO_PUBLIC_API_URL=
```

### 3. Başlat

```bash
# Backend (Terminal 1)
cd ~/proPod/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --reload

# Frontend (Terminal 2)
cd ~/proPod/frontend
npm run start:dev
```

---

## Port Forwarding (bir kez kur, bir daha dokunma)

Port forwarding WSL yeniden başladığında sıfırlanır.

```powershell
# Windows PowerShell (Admin) — port forwarding kur/güncelle
$wslIp = (wsl -- ip addr show eth0 | Select-String "inet " | ForEach-Object { $_.ToString().Trim().Split(" ")[1].Split("/")[0] })
netsh interface portproxy delete v4tov4 listenport=8000 listenaddress=0.0.0.0
netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=0.0.0.0
netsh interface portproxy add v4tov4 listenport=8000 listenaddress=0.0.0.0 connectport=8000 connectaddress=$wslIp
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=$wslIp

# Kontrol
netsh interface portproxy show all
```

---

## Sorun Giderme

### Backend'e bağlanamıyor:

```bash
# Backend çalışıyor mu?
pgrep -f uvicorn

# Port forwarding aktif mi? (Windows PowerShell)
netsh interface portproxy show all
# 8000 ve 8081 görünmeli

# Backend erişilebilir mi?
curl -I http://localhost:8000/docs
```

### ngrok URL alınamıyor:

```bash
# ngrok kurulu mu?
ngrok version

# ngrok authenticate edildi mi? (ücretsiz hesap gerekli)
# https://dashboard.ngrok.com/get-started/your-authtoken
ngrok config add-authtoken <token>

# Manuel kontrol
curl http://localhost:4040/api/tunnels | python3 -m json.tool
```
