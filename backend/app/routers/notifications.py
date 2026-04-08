"""Notifications endpoints — retrieve and mark in-app notifications."""
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=schemas.NotificationListResponse)
def list_notifications(
    skip: int = Query(0, ge=0, description="Number of notifications to skip"),
    limit: int = Query(30, ge=1, le=100, description="Max notifications to return"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Return paginated in-app notifications for the authenticated user,
    newest first.
    """
    notifications, total, unread_count = crud.get_notifications(
        db=db, user_id=current_user.id, skip=skip, limit=limit
    )
    return schemas.NotificationListResponse(
        notifications=notifications,
        total=total,
        unread_count=unread_count,
        limit=limit,
        offset=skip,
        has_more=total > skip + limit,
    )


@router.patch("/{notification_id}/read", response_model=schemas.NotificationResponse)
def mark_read(
    notification_id: int = Path(..., description="Notification ID to mark as read"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Mark a single notification as read."""
    notification = crud.mark_notification_read(
        db=db, notification_id=notification_id, user_id=current_user.id
    )
    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return notification


@router.post("/mark-all-read", response_model=schemas.SuccessMessage)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Mark all of the authenticated user's notifications as read."""
    count = crud.mark_all_notifications_read(db=db, user_id=current_user.id)
    return schemas.SuccessMessage(message=f"{count} notification(s) marked as read")
