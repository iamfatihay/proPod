"""
ProPod FastAPI Backend Application.

This module initializes the FastAPI application with all necessary
middleware, exception handlers, and routers.
"""
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import os

from app.routers import users, podcasts, ai

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

# Initialize FastAPI application
app = FastAPI(
    title="ProPod API",
    description="Podcast creation and management API with AI features",
    version="1.0.0"
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users.router)
app.include_router(podcasts.router)
app.include_router(ai.router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    """Handle Pydantic validation errors with detailed error messages."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )


@app.get("/", tags=["Health"])
def read_root():
    """Health check endpoint."""
    return {
        "message": "ProPod FastAPI backend is running!",
        "status": "healthy",
        "version": "1.0.0"
    }


# Serve uploaded media files
media_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "media"))
os.makedirs(media_root, exist_ok=True)
app.mount("/media", StaticFiles(directory=media_root), name="media")
