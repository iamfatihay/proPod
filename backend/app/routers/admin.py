"""Admin-only endpoints for managing podcasts and users."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from .. import schemas, crud, models, auth
from ..database import get_db
from ..models import UserRole

router = APIRouter(prefix="/admin", tags=["admin"])


def verify_admin(current_user: models.User = Depends(auth.get_current_user)):
    """
    Verify that the current user has admin privileges.
    
    Args:
        current_user: Authenticated user
        
    Returns:
        User object if authorized
        
    Raises:
        HTTPException: If user doesn't have admin role
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


def verify_super_admin(current_user: models.User = Depends(auth.get_current_user)):
    """
    Verify that the current user is a super admin (application owner).
    
    Args:
        current_user: Authenticated user
        
    Returns:
        User object if authorized
        
    Raises:
        HTTPException: If user is not super admin
    """
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required"
        )
    return current_user


def verify_moderator(current_user: models.User = Depends(auth.get_current_user)):
    """
    Verify that the current user has at least moderator privileges.
    
    Args:
        current_user: Authenticated user
        
    Returns:
        User object if authorized
        
    Raises:
        HTTPException: If user doesn't have moderator role or higher
    """
    if current_user.role not in [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Moderator access required"
        )
    return current_user


@router.get("/podcasts/deleted", response_model=List[schemas.Podcast])
def get_deleted_podcasts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: models.User = Depends(verify_admin)
):
    """
    Get list of soft-deleted podcasts (admin only).
    
    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        db: Database session
        admin: Verified admin user
        
    Returns:
        List of soft-deleted podcasts
    """
    deleted_podcasts = db.query(models.Podcast).options(
        joinedload(models.Podcast.owner)
    ).filter(
        models.Podcast.is_deleted == True
    ).order_by(
        models.Podcast.deleted_at.desc()
    ).offset(skip).limit(limit).all()
    
    return deleted_podcasts


@router.post("/podcasts/{podcast_id}/restore", response_model=schemas.Podcast)
def restore_deleted_podcast(
    podcast_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(verify_admin)
):
    """
    Restore a soft-deleted podcast (admin only).
    
    Args:
        podcast_id: ID of the podcast to restore
        db: Database session
        admin: Verified admin user
        
    Returns:
        Restored podcast
        
    Raises:
        HTTPException: If podcast not found or not deleted
    """
    # Get podcast including deleted ones
    podcast = crud.get_podcast(db=db, podcast_id=podcast_id, include_deleted=True, increment_play_count=False)
    
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podcast not found"
        )
    
    if not podcast.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Podcast is not deleted"
        )
    
    crud.restore_podcast(db=db, podcast=podcast)
    
    return podcast


@router.delete("/podcasts/{podcast_id}/hard-delete", response_model=schemas.SuccessMessage)
def hard_delete_podcast(
    podcast_id: int,
    db: Session = Depends(get_db),
    super_admin: models.User = Depends(verify_super_admin)
):
    """
    Permanently delete a podcast from database (super admin only, irreversible).
    
    ⚠️ WARNING: This action cannot be undone!
    Only the application owner (super admin) can perform this action.
    
    Args:
        podcast_id: ID of the podcast to permanently delete
        db: Database session
        admin: Verified admin user
        
    Returns:
        Success message
        
    Raises:
        HTTPException: If podcast not found
    """
    # Get podcast including deleted ones
    podcast = crud.get_podcast(db=db, podcast_id=podcast_id, include_deleted=True, increment_play_count=False)
    
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podcast not found"
        )
    
    crud.hard_delete_podcast(db=db, podcast=podcast)
    
    return schemas.SuccessMessage(message="Podcast permanently deleted")


@router.get("/stats", response_model=dict)
def get_admin_stats(
    db: Session = Depends(get_db),
    admin: models.User = Depends(verify_admin)
):
    """
    Get admin statistics (admin only).
    
    Returns:
        Dictionary with various statistics
    """
    total_users = db.query(models.User).filter(models.User.is_active == True).count()
    total_podcasts = db.query(models.Podcast).filter(models.Podcast.is_deleted == False).count()
    deleted_podcasts = db.query(models.Podcast).filter(models.Podcast.is_deleted == True).count()
    total_likes = db.query(models.PodcastLike).count()
    total_bookmarks = db.query(models.PodcastBookmark).count()
    
    return {
        "total_users": total_users,
        "total_podcasts": total_podcasts,
        "deleted_podcasts": deleted_podcasts,
        "total_likes": total_likes,
        "total_bookmarks": total_bookmarks
    }


# ==================== User Management ====================

@router.get("/users", response_model=List[schemas.User])
def get_all_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    admin: models.User = Depends(verify_admin)
):
    """
    Get list of all users (admin only).
    
    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        include_inactive: Include inactive users
        db: Database session
        admin: Verified admin user
        
    Returns:
        List of users
    """
    query = db.query(models.User)
    
    if not include_inactive:
        query = query.filter(models.User.is_active == True)
    
    users = query.order_by(models.User.created_at.desc()).offset(skip).limit(limit).all()
    return users


@router.patch("/users/{user_id}/role", response_model=schemas.User)
def update_user_role(
    user_id: int,
    new_role: UserRole,
    db: Session = Depends(get_db),
    super_admin: models.User = Depends(verify_super_admin)
):
    """
    Update user role (super admin only).
    
    Args:
        user_id: ID of the user to update
        new_role: New role to assign
        db: Database session
        super_admin: Verified super admin user
        
    Returns:
        Updated user
        
    Raises:
        HTTPException: If user not found or trying to modify own role
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent super admin from demoting themselves
    if user.id == super_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify own role"
        )
    
    user.role = new_role
    db.commit()
    db.refresh(user)
    
    return user


@router.delete("/users/{user_id}/deactivate", response_model=schemas.SuccessMessage)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(verify_admin)
):
    """
    Deactivate a user account (admin only).
    
    Args:
        user_id: ID of the user to deactivate
        db: Database session
        admin: Verified admin user
        
    Returns:
        Success message
        
    Raises:
        HTTPException: If user not found
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent admin from deactivating themselves
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate own account"
        )
    
    user.is_active = False
    db.commit()
    
    return schemas.SuccessMessage(message=f"User {user.email} deactivated")


# ---------------------------------------------------------------------------
# Expo Push Receipt Polling
# ---------------------------------------------------------------------------

@router.post("/push-receipts/check", response_model=schemas.PushReceiptCheckResponse)
def check_push_receipts(
    min_age_minutes: int = Query(
        15,
        ge=1,
        le=1440,
        description="Only check tickets at least this many minutes old (Expo minimum: 15).",
    ),
    batch_size: int = Query(
        100,
        ge=1,
        le=1000,
        description="Maximum number of tickets to process in this call.",
    ),
    db: Session = Depends(get_db),
    admin: models.User = Depends(verify_admin),
):
    """
    Check Expo push receipts and prune DeviceNotRegistered tokens (admin only).

    Expo returns receipt data ~15 minutes after a push is sent.  Call this
    endpoint periodically (e.g. every 30 minutes via a cron job) to:

    1. Confirm successful deliveries (status="ok").
    2. Detect dead tokens (status="error", error="DeviceNotRegistered") and
       delete them from the device_tokens table to avoid wasted future pushes.
    3. Delete processed/expired ticket rows from push_tickets.

    Returns a summary of actions taken.
    """
    return crud.check_push_receipts(db=db, min_age_minutes=min_age_minutes, batch_size=batch_size)
