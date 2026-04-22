# Ağ Değişince Ne Yapmalı?

## Neden sorun çıkar?

Backend ve frontend local IP adresi (`192.168.x.x`) üzerinden haberleşir.
Bu IP sadece aynı WiFi ağında geçerlidir. Telefon farklı bir ağdaysa (mobil data,
başka WiFi) bu adrese ulaşamaz.

Çözüm: Tunnel ile backend'i gerçek bir HTTPS URL'ine taşımak.

---

## Hangi durumda ne kullanmalısın?

| Durum | Yöntem |
|-------|--------|
| Telefon ve laptop aynı WiFi | `npm run dev` (tunnel yok) |
| Telefon mobil datada | `npm run dev:tunnel` |
| Farklı WiFi ağlarındasın | `npm run dev:tunnel` |
| 100ms RTC webhook testi | `npm run dev:tunnel` |
| Başkasıyla uzaktan test | `npm run dev:tunnel` |

---

## Aynı WiFi — Normal Başlatma

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Expo QR kodunu tara, telefon bağlanır.

---

## Farklı Ağ / Mobil Data — Tunnel Başlatma

**Adımlar:**

**Terminal 1 — Backend (önce bunu aç):**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — Tunnel + Expo:**
```bash
cd frontend
npm run dev:tunnel
```

Script otomatik olarak:
1. Backend'in çalışıp çalışmadığını kontrol eder (çalışmıyorsa kendisi başlatır)
2. Backend için localtunnel açar → public HTTPS URL alır
3. `frontend/.env` ve `backend/.env` dosyalarını günceller
4. Expo'yu tunnel modunda başlatır

QR kodunu tara, telefon bağlanır.

---

## Neden localtunnel + Expo tunnel?

Expo'nun `--tunnel` modu ngrok kullanır. Free ngrok aynı anda sadece **1 session**
açmaya izin verir. Eğer backend için de ngrok kullansak ikincisi reddedilir.

localtunnel bu kısıtı olmayan ücretsiz bir alternatif — hesap gerektirmez.

```
Telefon → https://xxxxx.loca.lt  → localtunnel → backend:8000  (API)
Telefon → https://xxxxx.ngrok.io → Expo tunnel → Metro:8081    (JS bundle)
```

---

## Sorun Giderme

### localtunnel URL gelmiyor
```bash
cat /tmp/propod-lt.log
# localtunnel kurulu mu?
npx localtunnel --version
```

### Expo tunnel başlamıyor
```bash
# @expo/ngrok kurulu mu?
cd frontend && npx expo install @expo/ngrok
```

### Backend'e hâlâ bağlanamıyor
localtunnel bazen "bypass" sayfası gösterir. Tarayıcıdan URL'yi aç,
"click to continue" varsa bir kez tıkla.

### Port 8000 zaten kullanımda hatası
Eski bir backend process kalmış demektir:
```bash
fuser -k 8000/tcp
pkill -f uvicorn
```
