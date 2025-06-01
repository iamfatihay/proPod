# proPod Backend

Bu proje, proPod mobil uygulaması için geliştirilen FastAPI tabanlı backend servisidir. Kullanıcılar podcast kaydedebilir, yayınlayabilir ve AI destekli düzenleme yapabilir.

## Kullanılan Teknolojiler

-   FastAPI
-   SQLAlchemy
-   PostgreSQL (veya SQLite)
-   JWT Authentication
-   Docker

## Kurulum

1. Gerekli ortam değişkenlerini `.env` dosyasına ekleyin:

    ```env
    DATABASE_URL=postgresql://kullanici:sifre@localhost:5432/propod
    SECRET_KEY=supersecretkey
    ALGORITHM=HS256
    ACCESS_TOKEN_EXPIRE_MINUTES=30
    ```

2. Geliştirme ortamında başlatmak için:

    ```bash
    pip install -r requirements.txt
    uvicorn app.main:app --reload
    ```

3. Docker ile başlatmak için:
    ```bash
    docker build -t propod-backend .
    docker run -p 8000:8000 --env-file .env propod-backend
    ```

## Temel API Endpointleri

-   `/users/register` : Kullanıcı kaydı
-   `/users/login` : Kullanıcı girişi (JWT)
-   `/podcasts/create` : Podcast oluşturma

## Geliştirici Notları

-   AI entegrasyonu ve dosya yükleme özellikleri ileride eklenecektir.
-   Kodlar mikroservis mimarisine uygun şekilde yapılandırılmıştır.
