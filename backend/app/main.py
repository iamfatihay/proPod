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
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv
import os

from app.routers import users, podcasts, ai, admin as admin_router, rtc, sharing, analytics, playlists, notifications, messages
from app.admin import setup_admin

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

# Initialize FastAPI application
app = FastAPI(
    title="ProPod API",
    description="Podcast creation and management API with AI features",
    version="1.0.0"
)

# Add session middleware for admin auth (BEFORE other middlewares)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("ADMIN_SECRET_KEY", "your-secret-key-change-in-production")
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
app.include_router(admin_router.router)
app.include_router(rtc.router)
app.include_router(sharing.router)  # Web sharing & deep linking (Phase 2-4)
app.include_router(analytics.router)  # Creator analytics dashboard (Phase 3)
app.include_router(playlists.router)  # User playlists for organizing podcasts
app.include_router(notifications.router)  # In-app notifications (likes, comments)
app.include_router(messages.router)      # Direct messages between users

# Setup admin panel (accessible at /admin)
admin_panel = setup_admin(app)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    """Handle Pydantic validation errors with detailed error messages.

    Pydantic v2 field_validators can place non-serializable objects (e.g. raw
    ValueError instances) into the 'ctx' dict.  Stringify those values so that
    JSONResponse never encounters an unserializable object.
    """
    safe_errors = []
    for e in exc.errors():
        err = dict(e)
        if "ctx" in err:
            err["ctx"] = {
                k: str(v) if not isinstance(v, (str, int, float, bool, type(None))) else v
                for k, v in err["ctx"].items()
            }
        safe_errors.append(err)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": safe_errors},
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
