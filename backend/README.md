# proPod Backend

This project is the FastAPI-based backend service for the proPod mobile application. Users can record, publish, and AI-edit podcasts with this backend.

## Technologies Used

-   FastAPI
-   SQLAlchemy
-   PostgreSQL (or SQLite)
-   JWT Authentication
-   Docker

## Setup

1. Add the required environment variables to a `.env` file:

    ```env
    DATABASE_URL=postgresql://user:password@localhost:5432/propod
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

3. To start with Docker:
    ```bash
    docker build -t propod-backend .
    docker run -p 8000:8000 --env-file .env propod-backend
    ```

## Main API Endpoints

-   `/users/register` : User registration
-   `/users/login` : User login (JWT)
-   `/podcasts/create` : Create podcast

## Developer Notes

-   AI integration and file upload features will be added in the future.
-   The codebase is structured to be compatible with microservice architecture.

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
