"""User authentication and profile management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Path, Query
from sqlalchemy.orm import Session
from pathlib import Path as SysPath
from typing import Dict
import os
import asyncio
import secrets
import datetime

from .. import schemas, crud, models, auth
from ..database import get_db
from ..schemas import User as UserSchema, BaseModel, ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest
from ..config import settings
from ..services.email_service import email_service
from ..services import google_auth_service

router = APIRouter(prefix="/users", tags=["users"])

# In-memory store for reset tokens (dev only)
reset_tokens: Dict[str, Dict] = {}

class AuthResponse(BaseModel):
    """Authentication response with tokens and user information."""
    access_token: str
    refresh_token: str
    token_type: str
    user: UserSchema


class RefreshTokenRequest(BaseModel):
    refresh_token: str


@router.post("/register", response_model=AuthResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)) -> AuthResponse:
    """
    Register a new user.
    
    Args:
        user: User registration data (email, name, password)
        db: Database session
        
    Returns:
        AuthResponse: Access token, refresh token, and user information
        
    Raises:
        HTTPException: If email is already registered or password missing for local users
    """
    # Validate password is provided for local users
    if user.provider == "local" and (not user.password or not user.password.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required for local user registration"
        )
    
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )
    
    db_user = crud.create_user(db, user)
    access_token = auth.create_access_token(data={"sub": db_user.email})
    refresh_token = auth.create_refresh_token(data={"sub": db_user.email})
    
    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserSchema.model_validate(db_user)
    )


@router.post("/login", response_model=AuthResponse)
async def login(user: schemas.UserLogin, db: Session = Depends(get_db)) -> AuthResponse:
    """
    Authenticate user and return tokens.
    
    Args:
        user: User login credentials (email, password)
        db: Database session
        
    Returns:
        AuthResponse: Access token, refresh token, and user information
        
    Raises:
        HTTPException: If credentials are invalid
    """
    db_user = crud.get_user_by_email(db, email=user.email)
    
    # Validate user exists
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or password"
        )
    
    # Validate user has a password (OAuth users don't have passwords)
    if not db_user.hashed_password or not db_user.hashed_password.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or password"
        )
    
    # Verify password
    if not auth.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or password"
        )
    
    access_token = auth.create_access_token(data={"sub": db_user.email})
    refresh_token = auth.create_refresh_token(data={"sub": db_user.email})
    
    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserSchema.model_validate(db_user)
    )


@router.post("/google-login", response_model=AuthResponse)
def google_login(user: schemas.GoogleLoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    """
    Authenticate or register a user via Google OAuth.

    The backend validates the Google access token directly with Google,
    then treats the verified email address as the account identity.

    If the verified email already exists, returns tokens for that account.
    If the verified email is new, creates a Google-backed account and returns tokens.
    """
    google_profile = google_auth_service.fetch_google_user_profile(
        user.google_access_token
    )

    db_user = crud.get_user_by_email(db, email=google_profile["email"])
    if not db_user:
        db_user = crud.create_google_user(db, google_profile)
    access_token = auth.create_access_token(data={"sub": db_user.email})
    refresh_token = auth.create_refresh_token(data={"sub": db_user.email})
    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserSchema.model_validate(db_user)
    )


@router.post("/refresh-token")
def refresh_token_endpoint(request: RefreshTokenRequest):
    payload = auth.verify_token(request.refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    access_token = auth.create_access_token(data={"sub": payload["sub"]})
    return {"access_token": access_token, "token_type": "bearer"}

# Get current user's profile


@router.get("/me", response_model=UserSchema)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return UserSchema.model_validate(current_user)

# Update current user's profile


@router.put("/me", response_model=UserSchema)
def update_me(update: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Update current user's profile (name only)."""
    updated_user = crud.update_user(db, current_user, update)
    return UserSchema.model_validate(updated_user)

# Upload profile photo


@router.post("/me/photo", response_model=UserSchema)
async def upload_profile_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Upload profile photo for current user.
    Validates image type, size, and saves to media/profile-photos directory.
    Returns updated user with new photo_url.
    """
    try:
        # Merge user into current session to avoid detached instance error
        user = db.merge(current_user)

        # Validate file type
        allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
        max_size = 5 * 1024 * 1024  # 5MB

        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported file type: {file.content_type}. Allowed types: {', '.join(allowed_types)}",
            )

        # Read file content to check size
        contents = await file.read()
        if len(contents) > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size: {max_size // (1024*1024)}MB",
            )

        # Ensure media/profile-photos directory exists
        media_dir = SysPath(os.path.dirname(__file__)
                            ).parent.parent / "media" / "profile-photos"
        os.makedirs(media_dir, exist_ok=True)

        # Build a safe filename
        original_suffix = SysPath(file.filename).suffix or ".jpg"
        safe_name = f"user_{user.id}_{int(asyncio.get_event_loop().time()*1e9)}{original_suffix}"
        dest_path = media_dir / safe_name

        # Delete old profile photo if exists
        if user.photo_url and user.photo_url.startswith(settings.BASE_URL):
            old_filename = user.photo_url.split("/")[-1]
            old_path = media_dir / old_filename
            if old_path.exists():
                try:
                    old_path.unlink()
                except Exception:
                    pass  # Don't fail if old file can't be deleted

        # Save file to disk
        with open(dest_path, "wb") as f:
            f.write(contents)

        # Public URL path (served via /media)
        public_path = f"/media/profile-photos/{safe_name}"
        full_photo_url = f"{settings.BASE_URL}{public_path}"

        # Update user's photo_url in database
        user.photo_url = full_photo_url
        db.commit()
        db.refresh(user)

        return UserSchema.model_validate(user)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Photo upload failed: {str(e)}",
        )

# Change password endpoint


@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(request: ChangePasswordRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    crud.change_user_password(
        db, current_user, request.old_password, request.new_password)
    return {"message": "Password changed successfully"}

# Delete account endpoint (soft delete)


@router.post("/delete", status_code=status.HTTP_200_OK)
def delete_account(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    crud.soft_delete_user(db, current_user)
    return {"message": "Account deleted successfully"}


@router.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, request.email)
    if not user:
        # Always return same message to avoid email enumeration
        return {"msg": "If this email exists, a reset link has been sent."}

    if settings.ENV == "prod":
        # Prod: Store token in database
        token = crud.set_reset_token(db, user)
        # Send email with reset link
        email_sent = email_service.send_password_reset_email(user.email, token)
        if not email_sent:
            # Log error but don't reveal to user
            pass
        return {"msg": "If this email exists, a reset link has been sent."}
    else:
        # Dev: Store token in memory and return in response for testing
        token = secrets.token_urlsafe(32)
        reset_tokens[token] = {
            "user_id": user.id,
            "expires": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)
        }
        # Send dev email (console + file)
        email_service.send_password_reset_email(user.email, token)
        return {
            "msg": "If this email exists, a reset link has been sent.",
            "token": token  # Only for dev testing
        }


@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    if settings.ENV == "prod":
        # Prod: Get user by token from database
        user = crud.get_user_by_reset_token(db, request.token)
        if not user:
            raise HTTPException(
                status_code=400, detail="Invalid or expired token")
        crud.reset_user_password(db, user, request.new_password)
    else:
        # Dev: Get user by token from memory
        token_data = reset_tokens.get(request.token)
        if not token_data or token_data["expires"] < datetime.datetime.now(datetime.timezone.utc):
            raise HTTPException(
                status_code=400, detail="Invalid or expired token")
        user = db.query(models.User).filter(
            models.User.id == token_data["user_id"]).first()
        if not user:
            raise HTTPException(status_code=400, detail="User not found")
        # Update password and remove token from memory
        user.hashed_password = crud.pwd_context.hash(request.new_password)
        db.commit()
        del reset_tokens[request.token]

    return {"msg": "Password reset successful."}


# ==================== Public User Profiles ====================


@router.get("/{user_id}/profile", response_model=schemas.PublicUserProfile)
def get_user_profile(
    user_id: int = Path(..., description="The ID of the user"),
    db: Session = Depends(get_db),
):
    """
    Get a user's public profile with aggregate creator statistics.

    Returns non-sensitive profile information including podcast count,
    total plays, and total likes. Does not require authentication.
    """
    profile = crud.get_public_user_profile(db=db, user_id=user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return profile


@router.get("/{user_id}/podcasts", response_model=schemas.PodcastListResponse)
def get_user_podcasts(
    user_id: int = Path(..., description="The ID of the user"),
    skip: int = Query(0, ge=0, description="Number of podcasts to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of podcasts to return"),
    db: Session = Depends(get_db),
):
    """
    Get a user's public podcasts with pagination.

    Returns only public, non-deleted podcasts sorted by creation date
    (newest first). Does not require authentication.
    """
    # Verify user exists and is active
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.is_active == True,
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    podcasts, total = crud.get_user_public_podcasts(
        db=db,
        user_id=user_id,
        skip=skip,
        limit=limit,
    )

    return schemas.PodcastListResponse(
        podcasts=podcasts,
        total=total,
        limit=limit,
        offset=skip,
        has_more=total > skip + limit,
    )
