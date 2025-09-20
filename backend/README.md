# Volo Backend

This project is the FastAPI-based backend service for the Volo mobile application. Users can record, publish, and AI-edit podcasts with this backend.

## Recent Updates (2025-01-19)

-   **Fixed Schema vs Model uyumsuzlukları** - User, PodcastLike, PodcastBookmark modellerinde eksik field'lar eklendi
-   **Alembic Migration sistemi** - Database migration yönetimi için Alembic kuruldu ve yapılandırıldı
-   **Pydantic validation hataları çözüldü** - Login endpoint'indeki validation hataları tamamen giderildi
-   **Database tutarlılığı** - Tüm Schema ve Model'ler artık tamamen uyumlu
-   **Development dokümantasyonu** - Schema/Model kontrol komutları ve migration rehberi eklendi

## Technologies Used

-   FastAPI
-   SQLAlchemy
-   Alembic (Database Migrations)
-   PostgreSQL (or SQLite)
-   JWT Authentication
-   Docker
-   AI Services (Whisper, Content Analysis)

## Setup

1. Add the required environment variables to a `.env` file:

    ```env
    DATABASE_URL=postgresql://user:password@localhost:5432/volo
    SECRET_KEY=supersecretkey
    ALGORITHM=HS256
    ACCESS_TOKEN_EXPIRE_MINUTES=30
    REFRESH_TOKEN_EXPIRE_DAYS=7
    ```

2. To start in development mode:

    ```bash
    pip install -r requirements.txt
    uvicorn app.main:app --reload
    ```

3. Database migrations (Alembic):

    ```bash
    # Virtual environment'ı aktif et
    .\venv\Scripts\Activate.ps1
    
    # Migration oluştur
    alembic revision --autogenerate -m "Migration açıklaması"
    
    # Migration uygula
    alembic upgrade head
    ```

4. To start with Docker:
   `bash
    docker build -t volo-backend .
docker run -p 8000:8000 --env-file .env volo-backend
    `

## Main API Endpoints

-   `/users/register` : User registration
-   `/users/login` : User login (JWT)
-   `/podcasts/create` : Create podcast
-   `/podcasts/upload` : Upload audio files
-   `/podcasts/{id}/process-ai` : AI processing (transcription, analysis)
-   `/podcasts/{id}/like` : Like/unlike podcast
-   `/podcasts/{id}/bookmark` : Bookmark/unbookmark podcast
-   `/podcasts/{id}/interactions` : Get user interactions

## Developer Notes

-   AI integration and file upload features are now fully implemented.
-   The codebase is structured to be compatible with microservice architecture.
-   Media files are served statically via `/media` endpoint.
-   Duration is automatically calculated from AI transcription results.
-   **Schema vs Model uyumsuzlukları kontrol edilmeli** - DEVELOPMENT_NOTES.md dosyasındaki komutları kullanın
-   **Alembic migration'ları düzenli kullanın** - Model değişikliklerinde migration oluşturun
-   **Pydantic validation hataları** - Schema ve Model'lerin uyumlu olduğundan emin olun

# Backend Setup

## Environment Variables

This backend requires a `.env` file in the `backend/` directory. You can use the provided `.env.example` as a template:

```bash
cp .env.example .env
```

**Required variables:**

-   `SECRET_KEY`: Secret key for JWT signing (must be kept secret!)
-   `ALGORITHM`: JWT algorithm (e.g. HS256)
-   `ACCESS_TOKEN_EXPIRE_MINUTES`: Access token expiration time (in minutes)
-   `REFRESH_TOKEN_EXPIRE_DAYS`: Refresh token expiration time (in days)
-   `DATABASE_URL`: Database connection string (e.g. sqlite:///./test.db)

If any of these variables are missing, the backend will not start.
