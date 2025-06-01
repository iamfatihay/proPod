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
