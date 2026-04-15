"""CRUD (Create, Read, Update, Delete) operations for database models."""
from sqlalchemy.orm import Session, joinedload, contains_eager
from sqlalchemy import case, func, desc, and_, or_, select, union
from sqlalchemy.exc import IntegrityError
from passlib.context import CryptContext
from fastapi import HTTPException, status
import secrets
import datetime
import logging
from datetime import timezone
from typing import Optional, List, Dict, Tuple, Any
import httpx

logger = logging.getLogger(__name__)

from . import models, schemas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ==================== Helper Functions ====================

def enrich_podcast_with_stats(podcast: models.Podcast) -> models.Podcast:
    """
    Enrich podcast object with stats and AI data for serialization.
    Maps relationship data to direct attributes for Pydantic schema compatibility.
    
    Args:
        podcast: Podcast model object with loaded relationships
        
    Returns:
        models.Podcast: Same object with added attributes
    """
    # Map stats relationship to direct attributes
    if podcast.stats:
        podcast.play_count = podcast.stats.play_count
        podcast.like_count = podcast.stats.like_count
        podcast.bookmark_count = podcast.stats.bookmark_count
    else:
        podcast.play_count = 0
        podcast.like_count = 0
        podcast.bookmark_count = 0
    
    # Map AI data relationship to direct attributes
    if podcast.ai_data:
        podcast.transcription_text = podcast.ai_data.transcription_text
        podcast.transcription_language = podcast.ai_data.transcription_language
        podcast.transcription_confidence = podcast.ai_data.transcription_confidence
        podcast.ai_keywords = podcast.ai_data.keywords
        podcast.ai_summary = podcast.ai_data.summary
        podcast.ai_sentiment = podcast.ai_data.sentiment
        podcast.ai_categories = podcast.ai_data.categories
        podcast.ai_processing_status = podcast.ai_data.processing_status
        podcast.ai_processing_date = podcast.ai_data.processing_date
        podcast.ai_quality_score = podcast.ai_data.quality_score
    else:
        podcast.transcription_text = None
        podcast.transcription_language = None
        podcast.transcription_confidence = None
        podcast.ai_keywords = None
        podcast.ai_summary = None
        podcast.ai_sentiment = None
        podcast.ai_categories = None
        podcast.ai_processing_status = "pending"
        podcast.ai_processing_date = None
        podcast.ai_quality_score = None
    
    return podcast


# ==================== User CRUD Operations ====================

def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    """
    Get user by email address.
    
    Args:
        db: Database session
        email: User's email address
        
    Returns:
        Optional[models.User]: User object if found, None otherwise
    """
    return db.query(models.User).filter(models.User.email == email).first()


def get_user_by_reset_token(db: Session, token: str) -> Optional[models.User]:
    """
    Get user by reset token if token is valid and not expired.
    
    Args:
        db: Database session
        token: Password reset token
        
    Returns:
        Optional[models.User]: User object if valid token found, None otherwise
    """
    return db.query(models.User).filter(
        models.User.reset_token == token,
        models.User.reset_token_expires > datetime.datetime.now(timezone.utc)
    ).first()


def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    """
    Create a new user.
    
    Args:
        db: Database session
        user: User creation schema with email, name, and password
        
    Returns:
        models.User: Created user object
        
    Raises:
        HTTPException: If password is empty or whitespace-only
    """
    # Hash password if provided (OAuth users may not have passwords)
    hashed_password = None
    if user.password:
        # Validate password is not empty or whitespace
        if not user.password.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password cannot be empty or whitespace"
            )
        hashed_password = pwd_context.hash(user.password)
    
    db_user = models.User(
        email=user.email,
        name=user.name,
        hashed_password=hashed_password,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def create_google_user(db: Session, user_data: dict) -> models.User:
    """
    Create a new user from Google OAuth data.
    
    Args:
        db: Database session
        user_data: Dictionary containing user data from Google
        
    Returns:
        models.User: Created user object
    """
    db_user = models.User(**user_data)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user: models.User, user_update: schemas.UserUpdate) -> models.User:
    """
    Update user information.
    
    Args:
        db: Database session
        user: User object to update
        user_update: Schema containing fields to update
        
    Returns:
        models.User: Updated user object
    """
    for field, value in user_update.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def set_reset_token(db: Session, user: models.User) -> str:
    """
    Generate and set password reset token for user.
    
    Args:
        db: Database session
        user: User object
        
    Returns:
        str: Generated reset token
    """
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires = datetime.datetime.now(timezone.utc) + datetime.timedelta(hours=1)
    db.commit()
    db.refresh(user)
    return token


def reset_user_password(db: Session, user: models.User, new_password: str) -> models.User:
    """
    Reset user password and clear reset token.
    
    Args:
        db: Database session
        user: User object
        new_password: New plain text password
        
    Returns:
        models.User: Updated user object
    """
    user.hashed_password = pwd_context.hash(new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    db.refresh(user)
    return user


def change_user_password(db: Session, user: models.User, old_password: str, new_password: str) -> models.User:
    """
    Change user password after verifying old password.
    
    Args:
        db: Database session
        user: User object
        old_password: Current password for verification
        new_password: New password to set
        
    Returns:
        models.User: Updated user object
        
    Raises:
        HTTPException: If old password is incorrect
    """
    if not pwd_context.verify(old_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Old password is incorrect"
        )
    
    user.hashed_password = pwd_context.hash(new_password)
    db.commit()
    db.refresh(user)
    return user


def soft_delete_user(db: Session, user: models.User) -> models.User:
    """
    Soft delete user by setting is_active to False.
    
    Args:
        db: Database session
        user: User object to deactivate
        
    Returns:
        models.User: Deactivated user object
    """
    user.is_active = False
    db.commit()
    return user


# ==================== Podcast CRUD Operations ====================

def create_podcast(db: Session, podcast: schemas.PodcastCreate, owner_id: int) -> models.Podcast:
    """
    Create a new podcast.
    
    Args:
        db: Database session
        podcast: Podcast creation schema
        owner_id: ID of the podcast owner
        
    Returns:
        models.Podcast: Created podcast object
    """
    db_podcast = models.Podcast(**podcast.model_dump(), owner_id=owner_id)
    db.add(db_podcast)
    db.flush()  # Get the podcast ID without committing
    
    # Create stats entry
    db_stats = models.PodcastStats(
        podcast_id=db_podcast.id,
        play_count=0,
        like_count=0,
        bookmark_count=0,
        comment_count=0
    )
    db.add(db_stats)
    
    db.commit()
    db.refresh(db_podcast)
    
    # Enrich with stats for serialization
    enrich_podcast_with_stats(db_podcast)
    
    return db_podcast

def get_podcast(db: Session, podcast_id: int, increment_play_count: bool = True, include_deleted: bool = False) -> Optional[models.Podcast]:
    """
    Get podcast by ID with optional play count increment.
    
    Args:
        db: Database session
        podcast_id: Podcast ID
        increment_play_count: Whether to increment play count (default: True)
        include_deleted: Whether to include soft-deleted podcasts (default: False, admin only)
        
    Returns:
        Optional[models.Podcast]: Podcast object if found, None otherwise
    """
    query = db.query(models.Podcast).options(
        joinedload(models.Podcast.owner),
        joinedload(models.Podcast.stats),
        joinedload(models.Podcast.ai_data)
    ).filter(models.Podcast.id == podcast_id)
    
    # Exclude soft-deleted podcasts unless explicitly requested
    if not include_deleted:
        query = query.filter(models.Podcast.is_deleted == False)
    
    podcast = query.first()
    if not podcast:
        return None
    
    # Increment play count if requested
    if increment_play_count and podcast.stats:
        podcast.stats.play_count += 1
        db.commit()
    
    # Enrich podcast with stats and AI data for serialization
    enrich_podcast_with_stats(podcast)
    
    return podcast


def get_podcasts(
    db: Session, 
    skip: int = 0, 
    limit: int = 20,
    category: Optional[str] = None,
    owner_id: Optional[int] = None,
    search_query: Optional[str] = None,
    is_public: bool = True
) -> Tuple[List[models.Podcast], int]:
    """
    Get podcasts with filtering and pagination.
    
    Args:
        db: Database session
        skip: Number of records to skip (pagination)
        limit: Maximum number of records to return
        category: Filter by category
        owner_id: Filter by owner ID
        search_query: Search term for title and description
        is_public: Filter by public/private status
        
    Returns:
        Tuple[List[models.Podcast], int]: List of podcasts and total count
    """
    query = db.query(models.Podcast).options(
        joinedload(models.Podcast.owner),
        joinedload(models.Podcast.stats),
        joinedload(models.Podcast.ai_data)
    )
    
    # Always exclude soft-deleted podcasts for public queries
    query = query.filter(models.Podcast.is_deleted == False)
    
    # Apply filters
    if is_public:
        query = query.filter(models.Podcast.is_public == True)
    
    if category:
        query = query.filter(models.Podcast.category == category)
    
    if owner_id:
        query = query.filter(models.Podcast.owner_id == owner_id)
    
    if search_query:
        search_term = f"%{search_query}%"
        query = query.filter(
            or_(
                models.Podcast.title.ilike(search_term),
                models.Podcast.description.ilike(search_term)
            )
        )
    
    # Order by creation date (newest first)
    query = query.order_by(desc(models.Podcast.created_at))
    
    total = query.count()
    podcasts = query.offset(skip).limit(limit).all()
    
    # Enrich podcasts with stats and AI data
    for podcast in podcasts:
        enrich_podcast_with_stats(podcast)
    
    return (podcasts, total)


def search_podcasts(
    db: Session,
    query: str,
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    is_public: bool = True
) -> Tuple[List[models.Podcast], int]:
    """
    Search podcasts by title and description.
    
    Args:
        db: Database session
        query: Search query string
        skip: Number of records to skip (pagination)
        limit: Maximum number of records to return
        category: Optional category filter
        is_public: Filter by public/private status
        
    Returns:
        Tuple[List[models.Podcast], int]: List of podcasts and total count
    """
    search_query = db.query(models.Podcast).options(
        joinedload(models.Podcast.owner)
    )
    
    # Exclude soft-deleted podcasts
    search_query = search_query.filter(models.Podcast.is_deleted == False)
    
    # Apply public filter
    if is_public:
        search_query = search_query.filter(models.Podcast.is_public == True)
    
    # Apply category filter
    if category:
        search_query = search_query.filter(models.Podcast.category == category)
    
    # Apply search term
    search_term = f"%{query}%"
    search_query = search_query.filter(
        or_(
            models.Podcast.title.ilike(search_term),
            models.Podcast.description.ilike(search_term)
        )
    )
    
    # Order by relevance (you could add more sophisticated ranking later)
    search_query = search_query.order_by(desc(models.Podcast.created_at))
    
    total = search_query.count()
    podcasts = search_query.offset(skip).limit(limit).all()
    
    return (podcasts, total)


def update_podcast(db: Session, podcast: models.Podcast, podcast_update: schemas.PodcastUpdate) -> models.Podcast:
    """
    Update podcast information.
    
    Args:
        db: Database session
        podcast: Podcast object to update
        podcast_update: Schema containing fields to update
        
    Returns:
        models.Podcast: Updated podcast object
    """
    for field, value in podcast_update.model_dump(exclude_unset=True).items():
        setattr(podcast, field, value)
    
    podcast.updated_at = datetime.datetime.now(timezone.utc)
    db.commit()
    db.refresh(podcast)
    return podcast


def delete_podcast(db: Session, podcast: models.Podcast) -> bool:
    """
    Soft delete a podcast (marks as deleted but keeps in database).
    
    Args:
        db: Database session
        podcast: Podcast object to delete
        
    Returns:
        bool: True if deletion successful
    """
    import datetime
    podcast.is_deleted = True
    podcast.deleted_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    return True


def restore_podcast(db: Session, podcast: models.Podcast) -> bool:
    """
    Restore a soft-deleted podcast (admin only).
    
    Args:
        db: Database session
        podcast: Podcast object to restore
        
    Returns:
        bool: True if restoration successful
    """
    podcast.is_deleted = False
    podcast.deleted_at = None
    db.commit()
    return True


def hard_delete_podcast(db: Session, podcast: models.Podcast) -> bool:
    """
    Permanently delete a podcast from database (admin only, irreversible).
    
    Args:
        db: Database session
        podcast: Podcast object to permanently delete
        
    Returns:
        bool: True if deletion successful
    """
    db.delete(podcast)
    db.commit()
    return True


# ==================== Podcast Interaction CRUD Operations ====================

def get_user_podcast_interactions(db: Session, user_id: int, podcast_id: int) -> Dict[str, Any]:
    """
    Get user's interactions with a specific podcast.
    
    Args:
        db: Database session
        user_id: User ID
        podcast_id: Podcast ID
        
    Returns:
        Dict: Dictionary containing like, bookmark, and history status
    """
    like = db.query(models.PodcastLike).filter(
        models.PodcastLike.user_id == user_id,
        models.PodcastLike.podcast_id == podcast_id
    ).first()
    
    bookmark = db.query(models.PodcastBookmark).filter(
        models.PodcastBookmark.user_id == user_id,
        models.PodcastBookmark.podcast_id == podcast_id
    ).first()
    
    history = db.query(models.ListeningHistory).filter(
        models.ListeningHistory.user_id == user_id,
        models.ListeningHistory.podcast_id == podcast_id
    ).first()
    
    return {
        "is_liked": like is not None,
        "is_bookmarked": bookmark is not None,
        "listening_history": history
    }


def _safe_create_notification(db: Session, **kwargs) -> None:
    """
    Create a notification without raising — notification failures must never
    break the primary action (like / comment).
    """
    try:
        notification = models.Notification(**kwargs, read=False)
        db.add(notification)
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning(
            "Notification creation failed (non-fatal): %s | kwargs=%s",
            exc,
            {k: v for k, v in kwargs.items() if k not in ("user_id",)},
        )


def like_podcast(db: Session, user_id: int, podcast_id: int) -> models.PodcastLike:
    """
    Like a podcast.
    
    Args:
        db: Database session
        user_id: User ID
        podcast_id: Podcast ID
        
    Returns:
        models.PodcastLike: Created like object
        
    Raises:
        HTTPException: If podcast is already liked
    """
    # Check if already liked
    existing_like = db.query(models.PodcastLike).filter(
        models.PodcastLike.user_id == user_id,
        models.PodcastLike.podcast_id == podcast_id
    ).first()
    
    if existing_like:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Podcast already liked"
        )
    
    # Create like
    like = models.PodcastLike(user_id=user_id, podcast_id=podcast_id)
    db.add(like)

    # Update stats like count
    stats = db.query(models.PodcastStats).filter(models.PodcastStats.podcast_id == podcast_id).first()
    if stats:
        stats.like_count += 1

    db.commit()
    db.refresh(like)

    # ── Notification: notify the podcast owner (skip self-likes) ──────────
    podcast = db.query(models.Podcast).filter(models.Podcast.id == podcast_id).first()
    if podcast and podcast.owner_id != user_id:
        actor = db.query(models.User).filter(models.User.id == user_id).first()
        actor_name = actor.name if actor else "Someone"
        _safe_create_notification(
            db,
            user_id=podcast.owner_id,
            type="like",
            title="New Like ❤️",
            message=f"{actor_name} liked your podcast \"{podcast.title}\"",
            podcast_id=podcast_id,
            actor_id=user_id,
        )

    return like


def unlike_podcast(db: Session, user_id: int, podcast_id: int) -> bool:
    """
    Unlike a podcast.
    
    Args:
        db: Database session
        user_id: User ID
        podcast_id: Podcast ID
        
    Returns:
        bool: True if successful
        
    Raises:
        HTTPException: If like not found
    """
    like = db.query(models.PodcastLike).filter(
        models.PodcastLike.user_id == user_id,
        models.PodcastLike.podcast_id == podcast_id
    ).first()
    
    if not like:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Like not found"
        )
    
    # Remove like
    db.delete(like)
    
    # Update stats like count
    stats = db.query(models.PodcastStats).filter(models.PodcastStats.podcast_id == podcast_id).first()
    if stats and stats.like_count > 0:
        stats.like_count -= 1
    
    db.commit()
    return True


def bookmark_podcast(db: Session, user_id: int, podcast_id: int) -> models.PodcastBookmark:
    """
    Bookmark a podcast.
    
    Args:
        db: Database session
        user_id: User ID
        podcast_id: Podcast ID
        
    Returns:
        models.PodcastBookmark: Created bookmark object
        
    Raises:
        HTTPException: If podcast is already bookmarked
    """
    # Check if already bookmarked
    existing_bookmark = db.query(models.PodcastBookmark).filter(
        models.PodcastBookmark.user_id == user_id,
        models.PodcastBookmark.podcast_id == podcast_id
    ).first()
    
    if existing_bookmark:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Podcast already bookmarked"
        )
    
    # Create bookmark
    bookmark = models.PodcastBookmark(user_id=user_id, podcast_id=podcast_id)
    db.add(bookmark)
    
    # Update stats bookmark count
    stats = db.query(models.PodcastStats).filter(models.PodcastStats.podcast_id == podcast_id).first()
    if stats:
        stats.bookmark_count += 1
    
    db.commit()
    db.refresh(bookmark)
    return bookmark


def remove_bookmark(db: Session, user_id: int, podcast_id: int) -> bool:
    """
    Remove bookmark from a podcast.
    
    Args:
        db: Database session
        user_id: User ID
        podcast_id: Podcast ID
        
    Returns:
        bool: True if successful
        
    Raises:
        HTTPException: If bookmark not found
    """
    bookmark = db.query(models.PodcastBookmark).filter(
        models.PodcastBookmark.user_id == user_id,
        models.PodcastBookmark.podcast_id == podcast_id
    ).first()
    
    if not bookmark:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bookmark not found"
        )
    
    # Remove bookmark
    db.delete(bookmark)
    
    # Update stats bookmark count
    stats = db.query(models.PodcastStats).filter(models.PodcastStats.podcast_id == podcast_id).first()
    if stats and stats.bookmark_count > 0:
        stats.bookmark_count -= 1
    
    db.commit()
    return True


def get_user_likes(db: Session, user_id: int, skip: int = 0, limit: int = 20) -> List[models.Podcast]:
    """
    Get user's liked podcasts.
    
    Args:
        db: Database session
        user_id: User ID
        skip: Number of records to skip
        limit: Maximum number of records
        
    Returns:
        List[models.Podcast]: List of liked podcasts
    """
    likes = db.query(models.PodcastLike).options(
        joinedload(models.PodcastLike.podcast)
            .joinedload(models.Podcast.owner),
        joinedload(models.PodcastLike.podcast)
            .joinedload(models.Podcast.stats),
        joinedload(models.PodcastLike.podcast)
            .joinedload(models.Podcast.ai_data)
    ).filter(
        models.PodcastLike.user_id == user_id
    ).order_by(desc(models.PodcastLike.created_at)).offset(skip).limit(limit).all()
    
    podcasts = [like.podcast for like in likes]
    for podcast in podcasts:
        enrich_podcast_with_stats(podcast)
    
    return podcasts


def get_user_bookmarks(db: Session, user_id: int, skip: int = 0, limit: int = 20) -> List[models.Podcast]:
    """
    Get user's bookmarked podcasts.
    
    Args:
        db: Database session
        user_id: User ID
        skip: Number of records to skip
        limit: Maximum number of records
        
    Returns:
        List[models.Podcast]: List of bookmarked podcasts
    """
    bookmarks = db.query(models.PodcastBookmark).options(
        joinedload(models.PodcastBookmark.podcast)
            .joinedload(models.Podcast.owner),
        joinedload(models.PodcastBookmark.podcast)
            .joinedload(models.Podcast.stats),
        joinedload(models.PodcastBookmark.podcast)
            .joinedload(models.Podcast.ai_data)
    ).filter(
        models.PodcastBookmark.user_id == user_id
    ).order_by(desc(models.PodcastBookmark.created_at)).offset(skip).limit(limit).all()
    
    podcasts = [bookmark.podcast for bookmark in bookmarks]
    for podcast in podcasts:
        enrich_podcast_with_stats(podcast)
    
    return podcasts


# ==================== Listening History CRUD Operations ====================

def update_listening_history(
    db: Session, 
    user_id: int, 
    podcast_id: int, 
    position: int,
    listen_time: Optional[int] = None,
    completed: Optional[bool] = None
) -> models.ListeningHistory:
    """
    Update user's listening history for a podcast.
    
    Args:
        db: Database session
        user_id: User ID
        podcast_id: Podcast ID
        position: Current position in seconds
        listen_time: Total listen time in seconds
        completed: Whether podcast was fully listened
        
    Returns:
        models.ListeningHistory: Updated or created history object
    """
    history = db.query(models.ListeningHistory).filter(
        models.ListeningHistory.user_id == user_id,
        models.ListeningHistory.podcast_id == podcast_id
    ).first()
    
    if history:
        # Update existing history
        history.position = position
        if listen_time is not None:
            history.listen_time = listen_time
        if completed is not None:
            history.completed = completed
        history.updated_at = datetime.datetime.now(timezone.utc)
    else:
        # Create new history
        history = models.ListeningHistory(
            user_id=user_id,
            podcast_id=podcast_id,
            position=position,
            listen_time=listen_time or 0,
            completed=completed or False
        )
        db.add(history)
    
    db.commit()
    db.refresh(history)
    return history


def get_user_listening_history(db: Session, user_id: int, skip: int = 0, limit: int = 20) -> List[models.ListeningHistory]:
    """
    Get user's listening history.
    
    Args:
        db: Database session
        user_id: User ID
        skip: Number of records to skip
        limit: Maximum number of records
        
    Returns:
        List[models.ListeningHistory]: List of listening history entries
    """
    history = db.query(models.ListeningHistory).options(
        joinedload(models.ListeningHistory.podcast).joinedload(models.Podcast.owner)
    ).filter(
        models.ListeningHistory.user_id == user_id
    ).order_by(desc(models.ListeningHistory.updated_at)).offset(skip).limit(limit).all()
    
    return history


def get_continue_listening(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 10,
) -> List[schemas.ContinueListeningItem]:
    """
    Return podcasts the user started but has not finished listening to.

    Only includes non-deleted, public-or-owned podcasts with a recorded
    position > 0 and completed == False.  Results are ordered by the most
    recently played first so the client can render a "Continue Listening"
    carousel.

    Args:
        db: Database session
        user_id: Authenticated user ID
        skip: Pagination offset
        limit: Maximum items to return

    Returns:
        List of ContinueListeningItem schemas ready for serialisation.
    """
    rows = (
        db.query(
            models.ListeningHistory,
            models.Podcast,
            models.User.name.label("owner_name"),
        )
        .join(models.Podcast, models.ListeningHistory.podcast_id == models.Podcast.id)
        .join(models.User, models.Podcast.owner_id == models.User.id)
        .filter(
            models.ListeningHistory.user_id == user_id,
            models.ListeningHistory.completed == False,
            models.ListeningHistory.position > 0,
            models.Podcast.is_deleted == False,
            # Only expose podcasts that are public OR owned by the requesting
            # user.  Without this guard a podcast made private after the user
            # listened to it would still appear here, leaking metadata/URLs.
            or_(
                models.Podcast.is_public == True,
                models.Podcast.owner_id == user_id,
            ),
        )
        .order_by(desc(models.ListeningHistory.updated_at))
        .offset(skip)
        .limit(limit)
        .all()
    )

    items: List[schemas.ContinueListeningItem] = []
    for history, podcast, owner_name in rows:
        # Clamp to [0.0, 100.0]: a user can seek past the end (position >
        # duration) which would otherwise produce a value above 100%.
        raw_progress = (
            (history.position / podcast.duration) * 100
            if podcast.duration and podcast.duration > 0
            else 0.0
        )
        progress = round(min(100.0, max(0.0, raw_progress)), 1)
        items.append(
            schemas.ContinueListeningItem(
                podcast_id=podcast.id,
                title=podcast.title,
                description=podcast.description,
                audio_url=podcast.audio_url,
                thumbnail_url=podcast.thumbnail_url,
                category=podcast.category,
                duration=podcast.duration,
                owner_id=podcast.owner_id,
                owner_name=owner_name,
                position=history.position,
                listen_time=history.listen_time,
                progress_percent=progress,
                last_played_at=history.updated_at,
            )
        )
    return items


# ==================== Comment CRUD Operations ====================

def create_comment(db: Session, comment: schemas.PodcastCommentCreate, user_id: int) -> models.PodcastComment:
    """
    Create a new comment on a podcast.
    
    Args:
        db: Database session
        comment: Comment creation schema
        user_id: User ID of commenter
        
    Returns:
        models.PodcastComment: Created comment object
    """
    db_comment = models.PodcastComment(
        user_id=user_id,
        podcast_id=comment.podcast_id,
        content=comment.content,
        timestamp=comment.timestamp
    )
    db.add(db_comment)

    # Update stats comment count
    stats = db.query(models.PodcastStats).filter(
        models.PodcastStats.podcast_id == comment.podcast_id
    ).first()
    if stats:
        stats.comment_count += 1

    db.commit()
    db.refresh(db_comment)

    # ── Notification: notify the podcast owner (skip self-comments) ───────
    podcast = db.query(models.Podcast).filter(models.Podcast.id == comment.podcast_id).first()
    if podcast and podcast.owner_id != user_id:
        actor = db.query(models.User).filter(models.User.id == user_id).first()
        actor_name = actor.name if actor else "Someone"
        preview = comment.content[:60] + ("…" if len(comment.content) > 60 else "")
        _safe_create_notification(
            db,
            user_id=podcast.owner_id,
            type="comment",
            title="New Comment 💬",
            message=f"{actor_name} commented on \"{podcast.title}\": {preview}",
            podcast_id=comment.podcast_id,
            actor_id=user_id,
        )

    return db_comment


def get_podcast_comments(db: Session, podcast_id: int, skip: int = 0, limit: int = 50) -> List[models.PodcastComment]:
    """
    Get comments for a podcast.
    
    Args:
        db: Database session
        podcast_id: Podcast ID
        skip: Number of records to skip
        limit: Maximum number of records
        
    Returns:
        List[models.PodcastComment]: List of active comments
    """
    comments = db.query(models.PodcastComment).options(
        joinedload(models.PodcastComment.user)
    ).filter(
        models.PodcastComment.podcast_id == podcast_id,
        models.PodcastComment.is_active == True
    ).order_by(models.PodcastComment.timestamp).offset(skip).limit(limit).all()
    
    return comments


def update_comment(db: Session, comment: models.PodcastComment, comment_update: schemas.PodcastCommentUpdate) -> models.PodcastComment:
    """
    Update a comment.
    
    Args:
        db: Database session
        comment: Comment object to update
        comment_update: Schema containing fields to update
        
    Returns:
        models.PodcastComment: Updated comment object
    """
    for field, value in comment_update.model_dump(exclude_unset=True).items():
        setattr(comment, field, value)
    
    comment.updated_at = datetime.datetime.now(timezone.utc)
    db.commit()
    db.refresh(comment)
    return comment


def delete_comment(db: Session, comment: models.PodcastComment):
    """Soft delete a comment"""
    comment.is_active = False
    comment.updated_at = datetime.datetime.now(timezone.utc)

    # Update stats comment count
    stats = db.query(models.PodcastStats).filter(
        models.PodcastStats.podcast_id == comment.podcast_id
    ).first()
    if stats and stats.comment_count > 0:
        stats.comment_count -= 1

    db.commit()
    return comment


# Analytics CRUD
def get_podcast_analytics(db: Session, podcast_id: int):
    """Get analytics for a specific podcast"""
    podcast = db.query(models.Podcast).filter(models.Podcast.id == podcast_id).first()
    if not podcast:
        raise HTTPException(status_code=404, detail="Podcast not found")
    
    # Get listening history stats
    history_stats = db.query(
        func.count(models.ListeningHistory.id).label('total_listens'),
        func.avg(models.ListeningHistory.listen_time).label('avg_listen_time'),
        func.sum(
            case((models.ListeningHistory.completed == True, 1), else_=0)
        ).label('completed_listens')
    ).filter(models.ListeningHistory.podcast_id == podcast_id).first()
    
    # Get top listeners
    top_listeners = db.query(
        models.User,
        models.ListeningHistory.listen_time
    ).join(
        models.ListeningHistory
    ).filter(
        models.ListeningHistory.podcast_id == podcast_id
    ).order_by(
        desc(models.ListeningHistory.listen_time)
    ).limit(10).all()
    
    # Calculate completion rate
    completion_rate = 0.0
    if history_stats.total_listens > 0:
        completion_rate = (history_stats.completed_listens / history_stats.total_listens) * 100
    
    return {
        "total_plays": podcast.play_count,
        "total_likes": podcast.like_count,
        "total_bookmarks": podcast.bookmark_count,
        "total_comments": db.query(models.PodcastComment).filter(
            models.PodcastComment.podcast_id == podcast_id,
            models.PodcastComment.is_active == True
        ).count(),
        "average_listen_time": float(history_stats.avg_listen_time or 0),
        "completion_rate": completion_rate,
        "top_listeners": [listener[0] for listener in top_listeners]
    }


def get_trending_podcasts(db: Session, limit: int = 10, days: int = 7):
    """Get trending podcasts based on recent activity"""
    cutoff_date = datetime.datetime.now(timezone.utc) - datetime.timedelta(days=days)
    
    # Calculate trending score based on recent likes, bookmarks, and plays
    trending = db.query(
        models.Podcast,
        (
            func.count(models.PodcastLike.id) * 3 +  # Likes weight more
            func.count(models.PodcastBookmark.id) * 2 +  # Bookmarks weight medium
            func.count(models.ListeningHistory.id)  # Plays weight less
        ).label('trend_score')
    ).outerjoin(
        models.PodcastLike,
        and_(
            models.PodcastLike.podcast_id == models.Podcast.id,
            models.PodcastLike.created_at >= cutoff_date
        )
    ).outerjoin(
        models.PodcastBookmark,
        and_(
            models.PodcastBookmark.podcast_id == models.Podcast.id,
            models.PodcastBookmark.created_at >= cutoff_date
        )
    ).outerjoin(
        models.ListeningHistory,
        and_(
            models.ListeningHistory.podcast_id == models.Podcast.id,
            models.ListeningHistory.updated_at >= cutoff_date
        )
    ).filter(
        models.Podcast.is_public == True,
        models.Podcast.is_deleted == False,
    ).group_by(
        models.Podcast.id
    ).order_by(
        desc('trend_score')
    ).limit(limit).all()

    return [podcast[0] for podcast in trending]


def get_categories(db: Session) -> List[Dict[str, Any]]:
    """
    Get all podcast categories with their podcast counts.

    Only counts public, non-deleted podcasts. Categories are returned
    sorted by podcast count (descending), then alphabetically.

    Args:
        db: Database session

    Returns:
        List of dicts with 'category' and 'podcast_count' keys.
    """
    results = (
        db.query(
            models.Podcast.category,
            func.count(models.Podcast.id).label("podcast_count"),
        )
        .filter(
            models.Podcast.is_public == True,
            models.Podcast.is_deleted == False,
            # Exclude NULL/empty categories to avoid response-model validation
            # failures: CategoryInfo.category is typed as str, not Optional[str].
            models.Podcast.category.isnot(None),
            models.Podcast.category != "",
        )
        .group_by(models.Podcast.category)
        .order_by(desc("podcast_count"), models.Podcast.category)
        .all()
    )

    return [
        {"category": row.category, "podcast_count": row.podcast_count}
        for row in results
    ]


def get_recommended_podcasts(db: Session, user_id: int, limit: int = 10):
    """Get personalized podcast recommendations for a user"""
    # Get user's liked categories
    liked_categories = db.query(
        models.Podcast.category,
        func.count(models.PodcastLike.id).label('category_likes')
    ).join(
        models.PodcastLike
    ).filter(
        models.PodcastLike.user_id == user_id
    ).group_by(
        models.Podcast.category
    ).order_by(
        desc('category_likes')
    ).limit(3).all()

    if not liked_categories:
        # If no likes, return trending podcasts
        return get_trending_podcasts(db, limit)

    # Build the set of podcast IDs the user has already interacted with using
    # Core select() + union() — this avoids the legacy db.query() coercion
    # warning and is fully compatible with SQLAlchemy 2.0.
    user_podcast_ids = union(
        select(models.PodcastLike.podcast_id).where(
            models.PodcastLike.user_id == user_id
        ),
        select(models.PodcastBookmark.podcast_id).where(
            models.PodcastBookmark.user_id == user_id
        ),
    ).subquery("user_podcast_ids")

    # Use a single explicit LEFT JOIN on PodcastStats with contains_eager so
    # SQLAlchemy loads the relationship from the join result without adding a
    # second implicit join for eager loading (avoids redundant LEFT JOIN in SQL).
    # The explicit ON condition mirrors the pattern used in get_podcasts().
    recommended = (
        db.query(models.Podcast)
        .join(models.User, models.Podcast.owner_id == models.User.id)
        .outerjoin(
            models.PodcastStats,
            models.PodcastStats.podcast_id == models.Podcast.id,
        )
        .options(
            contains_eager(models.Podcast.stats),
            joinedload(models.Podcast.owner),
        )
        .filter(
            models.Podcast.is_deleted == False,
            models.Podcast.category.in_([cat[0] for cat in liked_categories]),
            models.Podcast.is_public == True,
            ~models.Podcast.id.in_(
                select(user_podcast_ids.c.podcast_id)
            ),
        )
        .order_by(
            desc(func.coalesce(models.PodcastStats.like_count, 0))
        )
        .limit(limit)
        .all()
    )

    for podcast in recommended:
        enrich_podcast_with_stats(podcast)

    return recommended


# ==================== Public User Profile ====================

def get_public_user_profile(
    db: Session,
    user_id: int,
    requesting_user_id: Optional[int] = None,
) -> Optional[Dict]:
    """
    Get a user's public profile with aggregate creator statistics.

    Returns non-sensitive user information and aggregate stats
    (podcast count, total plays, total likes) across all of
    the user's public, non-deleted podcasts.

    Args:
        db: Database session
        user_id: ID of the user whose profile to retrieve
        requesting_user_id: Optional ID of the authenticated user making the
            request.  Used to populate the ``is_following`` field.

    Returns:
        Dict with user info and aggregate stats, or None if user not found
    """
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.is_active == True
    ).first()

    if not user:
        return None

    # Aggregate stats across user's public podcasts
    stats = db.query(
        func.count(models.Podcast.id).label("podcast_count"),
        func.coalesce(func.sum(models.PodcastStats.play_count), 0).label("total_plays"),
        func.coalesce(func.sum(models.PodcastStats.like_count), 0).label("total_likes"),
    ).outerjoin(
        models.PodcastStats,
        models.PodcastStats.podcast_id == models.Podcast.id
    ).filter(
        models.Podcast.owner_id == user_id,
        models.Podcast.is_deleted == False,
        models.Podcast.is_public == True,
    ).first()

    # Real follower count from user_follows table
    follower_count = get_follower_count(db, user_id)

    # Whether the requesting user is already following this profile
    following = (
        is_following_creator(db, requesting_user_id, user_id)
        if requesting_user_id and requesting_user_id != user_id
        else False
    )

    return {
        "id": user.id,
        "name": user.name,
        "photo_url": user.photo_url,
        "created_at": user.created_at,
        "podcast_count": stats.podcast_count if stats else 0,
        "total_plays": int(stats.total_plays) if stats else 0,
        "total_likes": int(stats.total_likes) if stats else 0,
        "total_followers": follower_count,
        "is_following": following,
    }


# ==================== Playlist CRUD Operations ====================

def create_playlist(db: Session, playlist: schemas.PlaylistCreate, owner_id: int) -> models.Playlist:
    """
    Create a new playlist.

    Args:
        db: Database session
        playlist: Playlist creation schema
        owner_id: ID of the playlist owner

    Returns:
        models.Playlist: Created playlist object
    """
    db_playlist = models.Playlist(
        name=playlist.name,
        description=playlist.description,
        is_public=playlist.is_public,
        owner_id=owner_id,
    )
    db.add(db_playlist)
    db.commit()
    db.refresh(db_playlist)
    return db_playlist


def get_playlist(db: Session, playlist_id: int) -> Optional[models.Playlist]:
    """
    Get a playlist by ID with its items and associated podcasts.

    Args:
        db: Database session
        playlist_id: Playlist ID

    Returns:
        Optional[models.Playlist]: Playlist object if found, None otherwise
    """
    return db.query(models.Playlist).options(
        joinedload(models.Playlist.items)
            .joinedload(models.PlaylistItem.podcast)
            .joinedload(models.Podcast.owner),
        joinedload(models.Playlist.items)
            .joinedload(models.PlaylistItem.podcast)
            .joinedload(models.Podcast.stats),
        joinedload(models.Playlist.items)
            .joinedload(models.PlaylistItem.podcast)
            .joinedload(models.Podcast.ai_data),
        joinedload(models.Playlist.owner),
    ).filter(models.Playlist.id == playlist_id).first()


def get_user_playlists(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[List[Tuple[models.Playlist, int]], int]:
    """
    Get playlists owned by a user with pagination.

    Returns a tuple of (rows, total) where each row is (Playlist, item_count).
    The item_count is computed via a correlated subquery so no lazy loads are
    needed when building the response.

    Args:
        db: Database session
        user_id: Owner user ID
        skip: Number of records to skip
        limit: Maximum number of records

    Returns:
        Tuple of (list of (Playlist, item_count) tuples, total count)
    """
    item_count_subq = (
        db.query(func.count(models.PlaylistItem.id))
        .filter(models.PlaylistItem.playlist_id == models.Playlist.id)
        .correlate(models.Playlist)
        .scalar_subquery()
    )
    query = db.query(models.Playlist, item_count_subq.label("item_count")).filter(
        models.Playlist.owner_id == user_id,
    ).order_by(desc(models.Playlist.updated_at))

    total = db.query(func.count(models.Playlist.id)).filter(
        models.Playlist.owner_id == user_id,
    ).scalar() or 0
    rows = query.offset(skip).limit(limit).all()
    return rows, total


def get_public_playlists(
    db: Session,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[List[Tuple[models.Playlist, int]], int]:
    """
    Get all public playlists with pagination.

    Only includes playlists whose owner is active. Returns (rows, total)
    where each row is (Playlist, item_count) to avoid N+1 lazy loads.

    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records

    Returns:
        Tuple of (list of (Playlist, item_count) tuples, total count)
    """
    item_count_subq = (
        db.query(func.count(models.PlaylistItem.id))
        .filter(models.PlaylistItem.playlist_id == models.Playlist.id)
        .correlate(models.Playlist)
        .scalar_subquery()
    )
    base_filter = [
        models.Playlist.is_public == True,
        models.User.is_active == True,
    ]
    query = (
        db.query(models.Playlist, item_count_subq.label("item_count"))
        .join(models.User, models.User.id == models.Playlist.owner_id)
        .filter(*base_filter)
        .order_by(desc(models.Playlist.updated_at))
    )

    total = (
        db.query(func.count(models.Playlist.id))
        .join(models.User, models.User.id == models.Playlist.owner_id)
        .filter(*base_filter)
        .scalar() or 0
    )
    rows = query.offset(skip).limit(limit).all()
    return rows, total


def update_playlist(
    db: Session,
    playlist: models.Playlist,
    playlist_update: schemas.PlaylistUpdate,
) -> models.Playlist:
    """
    Update playlist information.

    Args:
        db: Database session
        playlist: Playlist object to update
        playlist_update: Schema containing fields to update

    Returns:
        models.Playlist: Updated playlist object
    """
    for field, value in playlist_update.model_dump(exclude_unset=True).items():
        setattr(playlist, field, value)

    playlist.updated_at = datetime.datetime.now(timezone.utc)
    db.commit()
    db.refresh(playlist)
    return playlist


def delete_playlist(db: Session, playlist: models.Playlist) -> bool:
    """
    Permanently delete a playlist and all its items.

    Args:
        db: Database session
        playlist: Playlist object to delete

    Returns:
        bool: True if deletion successful
    """
    db.delete(playlist)
    db.commit()
    return True


def add_podcast_to_playlist(
    db: Session,
    playlist_id: int,
    podcast_id: int,
) -> models.PlaylistItem:
    """
    Add a podcast to a playlist.

    Args:
        db: Database session
        playlist_id: Playlist ID
        podcast_id: Podcast ID to add

    Returns:
        models.PlaylistItem: Created playlist item

    Raises:
        HTTPException: If podcast is already in the playlist
    """
    existing = db.query(models.PlaylistItem).filter(
        models.PlaylistItem.playlist_id == playlist_id,
        models.PlaylistItem.podcast_id == podcast_id,
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Podcast already in playlist",
        )

    # Determine the next position
    max_pos = db.query(func.max(models.PlaylistItem.position)).filter(
        models.PlaylistItem.playlist_id == playlist_id,
    ).scalar()
    next_position = (max_pos or 0) + 1 if max_pos is not None else 0

    item = models.PlaylistItem(
        playlist_id=playlist_id,
        podcast_id=podcast_id,
        position=next_position,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def remove_podcast_from_playlist(
    db: Session,
    playlist_id: int,
    podcast_id: int,
) -> bool:
    """
    Remove a podcast from a playlist.

    Args:
        db: Database session
        playlist_id: Playlist ID
        podcast_id: Podcast ID to remove

    Returns:
        bool: True if successful

    Raises:
        HTTPException: If podcast is not in the playlist
    """
    item = db.query(models.PlaylistItem).filter(
        models.PlaylistItem.playlist_id == playlist_id,
        models.PlaylistItem.podcast_id == podcast_id,
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podcast not found in playlist",
        )

    removed_position = item.position
    db.delete(item)

    # Re-order remaining items to close the gap
    db.query(models.PlaylistItem).filter(
        models.PlaylistItem.playlist_id == playlist_id,
        models.PlaylistItem.position > removed_position,
    ).update(
        {models.PlaylistItem.position: models.PlaylistItem.position - 1},
        synchronize_session="fetch",
    )

    db.commit()
    return True


def get_user_public_podcasts(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[List[models.Podcast], int]:
    """
    Get a user's public, non-deleted podcasts with pagination.

    Args:
        db: Database session
        user_id: ID of the podcast owner
        skip: Number of results to skip (pagination offset)
        limit: Maximum results to return

    Returns:
        Tuple of (list of enriched Podcast objects, total count)
    """
    # Include is_active join to guard against inactive (soft-deleted) user accounts,
    # preventing accidental exposure of their podcasts on reuse without caller check.
    base_query = db.query(models.Podcast).options(
        joinedload(models.Podcast.stats),
        joinedload(models.Podcast.ai_data),
        joinedload(models.Podcast.owner),
    ).join(
        models.User, models.User.id == models.Podcast.owner_id
    ).filter(
        models.Podcast.owner_id == user_id,
        models.Podcast.is_deleted == False,
        models.Podcast.is_public == True,
        models.User.is_active == True,
    )

    total = db.query(func.count(models.Podcast.id)).join(
        models.User, models.User.id == models.Podcast.owner_id
    ).filter(
        models.Podcast.owner_id == user_id,
        models.Podcast.is_deleted == False,
        models.Podcast.is_public == True,
        models.User.is_active == True,
    ).scalar()

    podcasts = base_query.order_by(
        desc(models.Podcast.created_at)
    ).offset(skip).limit(limit).all()

    for podcast in podcasts:
        enrich_podcast_with_stats(podcast)

    return podcasts, total


# ---------------------------------------------------------------------------
# Notifications CRUD
# ---------------------------------------------------------------------------

def create_notification(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    message: str,
    podcast_id: int | None = None,
    actor_id: int | None = None,
) -> models.Notification:
    """
    Persist a new in-app notification for *user_id*.

    Args:
        db: Database session
        user_id: Recipient user ID
        type: Notification type string ('like', 'comment', 'system')
        title: Short heading shown in the notification card
        message: Body text shown in the notification card
        podcast_id: Optional related podcast
        actor_id: Optional user who triggered the event

    Returns:
        models.Notification: Persisted notification object
    """
    notification = models.Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        podcast_id=podcast_id,
        actor_id=actor_id,
        read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    # Send Expo push notification to all registered devices for this user.
    # This is fire-and-forget — a push failure must never break the in-app flow.
    try:
        device_tokens = get_device_tokens_for_user(db=db, user_id=user_id)
        token_strings = [dt.token for dt in device_tokens]
        if token_strings:
            _send_expo_push(
                tokens=token_strings,
                title=title,
                body=message,
                data={"type": type, "notificationId": notification.id},
            )
    except Exception as exc:
        logger.warning("Push dispatch error (non-blocking): %s", exc)

    return notification


def get_notifications(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 30,
) -> tuple[list[models.Notification], int, int]:
    """
    Return paginated notifications for a user, newest first.

    Returns:
        (notifications, total, unread_count)
    """
    base_q = db.query(models.Notification).filter(
        models.Notification.user_id == user_id,
    )
    total = base_q.count()
    unread_count = base_q.filter(models.Notification.read == False).count()
    notifications = (
        base_q.order_by(models.Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return notifications, total, unread_count


def mark_notification_read(
    db: Session,
    notification_id: int,
    user_id: int,
) -> models.Notification | None:
    """Mark a single notification as read (only if owned by user_id)."""
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == user_id,
    ).first()
    if notification and not notification.read:
        notification.read = True
        db.commit()
        db.refresh(notification)
    return notification


def mark_all_notifications_read(db: Session, user_id: int) -> int:
    """Mark all unread notifications for user as read. Returns count updated."""
    result = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == user_id,
            models.Notification.read == False,
        )
        .update({"read": True}, synchronize_session=False)
    )
    db.commit()
    return result


# ==================== Creator Follow CRUD Operations ====================

def follow_creator(db: Session, follower_id: int, followed_id: int) -> models.UserFollow:
    """
    Follow a creator.

    Args:
        db: Database session
        follower_id: The user pressing "Follow"
        followed_id: The creator being followed

    Returns:
        models.UserFollow: Created follow record

    Raises:
        HTTPException 400 if the follow already exists or user tries to follow themselves
    """
    if follower_id == followed_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot follow yourself",
        )

    # Check if followed user exists
    followed_user = db.query(models.User).filter(
        models.User.id == followed_id,
        models.User.is_active == True,
    ).first()
    if not followed_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Check for existing follow
    existing = db.query(models.UserFollow).filter(
        models.UserFollow.follower_id == follower_id,
        models.UserFollow.followed_id == followed_id,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already following this creator",
        )

    follow = models.UserFollow(follower_id=follower_id, followed_id=followed_id)
    db.add(follow)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already following this creator",
        )
    db.refresh(follow)
    return follow


def unfollow_creator(db: Session, follower_id: int, followed_id: int) -> bool:
    """
    Unfollow a creator.

    Args:
        db: Database session
        follower_id: The user pressing "Unfollow"
        followed_id: The creator being unfollowed

    Returns:
        bool: True if unfollow was successful

    Raises:
        HTTPException 404 if the follow record does not exist
    """
    follow = db.query(models.UserFollow).filter(
        models.UserFollow.follower_id == follower_id,
        models.UserFollow.followed_id == followed_id,
    ).first()
    if not follow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not following this creator",
        )
    db.delete(follow)
    db.commit()
    return True


def is_following_creator(db: Session, follower_id: int, followed_id: int) -> bool:
    """Return True if follower_id is currently following followed_id."""
    return db.query(models.UserFollow).filter(
        models.UserFollow.follower_id == follower_id,
        models.UserFollow.followed_id == followed_id,
    ).first() is not None


def get_follower_count(db: Session, user_id: int) -> int:
    """Return the number of followers a user has."""
    return db.query(models.UserFollow).filter(
        models.UserFollow.followed_id == user_id,
    ).count()


def get_following_list(db: Session, follower_id: int, skip: int = 0, limit: int = 50) -> List[models.User]:
    """
    Return the list of users that follower_id is following.

    Args:
        db: Database session
        follower_id: The user whose following list we want
        skip: Pagination offset
        limit: Max results

    Returns:
        List of User objects (the creators being followed)
    """
    return (
        db.query(models.User)
        .join(models.UserFollow, models.UserFollow.followed_id == models.User.id)
        .filter(
            models.UserFollow.follower_id == follower_id,
            models.User.is_active == True,
        )
        .order_by(models.UserFollow.created_at.desc(), models.User.id)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_following_feed(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 20,
) -> Tuple[List[models.Podcast], int]:
    """
    Return public podcasts from creators that ``user_id`` follows, newest first.

    Uses a single JOIN query instead of N individual user-podcast lookups so it
    stays efficient regardless of following-list size.

    Args:
        db: Database session
        user_id: The authenticated user whose following list drives the filter
        skip: Pagination offset
        limit: Max results per page (capped at 100 by the router)

    Returns:
        Tuple[List[Podcast], int]: Matching podcasts and the total count
    """
    from sqlalchemy import select as _select
    followed_ids_sq = _select(models.UserFollow.followed_id).where(
        models.UserFollow.follower_id == user_id
    )

    query = (
        db.query(models.Podcast)
        .join(models.User, models.Podcast.owner_id == models.User.id)
        .options(
            joinedload(models.Podcast.owner),
            joinedload(models.Podcast.stats),
            joinedload(models.Podcast.ai_data),
        )
        .filter(
            models.Podcast.owner_id.in_(followed_ids_sq),
            models.Podcast.is_public == True,
            models.Podcast.is_deleted == False,
            models.User.is_active == True,
        )
        .order_by(models.Podcast.created_at.desc())
    )

    total = query.count()
    podcasts = query.offset(skip).limit(limit).all()

    # Populate transient stats/AI fields so callers get play_count, like_count, etc.
    for podcast in podcasts:
        enrich_podcast_with_stats(podcast)

    return podcasts, total


# ==================== Direct Message CRUD Operations ====================

def send_direct_message(
    db: Session,
    sender_id: int,
    recipient_id: int,
    body: str,
) -> models.DirectMessage:
    """
    Persist a new direct message from sender to recipient.

    Args:
        db: Database session
        sender_id: ID of the sending user
        recipient_id: ID of the target user
        body: Message text (max 2 000 chars enforced at router level)

    Returns:
        models.DirectMessage: Persisted message
    """
    msg = models.DirectMessage(
        sender_id=sender_id,
        recipient_id=recipient_id,
        body=body,
        is_read=False,
    )
    db.add(msg)
    db.flush()
    message_id = msg.id
    db.commit()
    # Re-query with eager-loaded relationships in one round-trip
    return (
        db.query(models.DirectMessage)
        .options(
            joinedload(models.DirectMessage.sender),
            joinedload(models.DirectMessage.recipient),
        )
        .filter(models.DirectMessage.id == message_id)
        .one()
    )


def _enrich_dm(msg: models.DirectMessage) -> models.DirectMessage:
    """Attach convenience name/photo fields from related User rows."""
    msg.sender_name = msg.sender.name if msg.sender else None
    msg.sender_photo_url = msg.sender.photo_url if msg.sender else None
    msg.recipient_name = msg.recipient.name if msg.recipient else None
    msg.recipient_photo_url = msg.recipient.photo_url if msg.recipient else None
    return msg


def get_conversation(
    db: Session,
    user_a_id: int,
    user_b_id: int,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[models.DirectMessage], int]:
    """
    Return paginated messages between two users, newest first.

    Args:
        db: Database session
        user_a_id: One participant's ID
        user_b_id: The other participant's ID
        skip: Pagination offset
        limit: Max messages to return

    Returns:
        (messages, total)
    """
    thread_filter = or_(
        and_(
            models.DirectMessage.sender_id == user_a_id,
            models.DirectMessage.recipient_id == user_b_id,
        ),
        and_(
            models.DirectMessage.sender_id == user_b_id,
            models.DirectMessage.recipient_id == user_a_id,
        ),
    )
    total = db.query(models.DirectMessage).filter(thread_filter).count()
    messages = (
        db.query(models.DirectMessage)
        .options(
            joinedload(models.DirectMessage.sender),
            joinedload(models.DirectMessage.recipient),
        )
        .filter(thread_filter)
        .order_by(models.DirectMessage.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    for msg in messages:
        _enrich_dm(msg)
    return messages, total


def mark_conversation_read(
    db: Session,
    reader_id: int,
    partner_id: int,
) -> int:
    """
    Mark all unread messages from partner_id → reader_id as read.

    Returns:
        Number of messages updated
    """
    result = (
        db.query(models.DirectMessage)
        .filter(
            models.DirectMessage.sender_id == partner_id,
            models.DirectMessage.recipient_id == reader_id,
            models.DirectMessage.is_read == False,
        )
        .update({"is_read": True}, synchronize_session=False)
    )
    db.commit()
    return result


def get_dm_inbox(
    db: Session,
    user_id: int,
) -> list[dict]:
    """
    Build the DM inbox: one entry per conversation partner, showing the
    most-recent message and unread count.

    This does a Python-side aggregation instead of complex SQL so it stays
    compatible with both SQLite (test) and PostgreSQL (production).

    Returns:
        List of dicts matching the DirectMessageThread schema, newest-thread first.
    """
    messages = (
        db.query(models.DirectMessage)
        .options(
            joinedload(models.DirectMessage.sender),
            joinedload(models.DirectMessage.recipient),
        )
        .filter(
            or_(
                models.DirectMessage.sender_id == user_id,
                models.DirectMessage.recipient_id == user_id,
            )
        )
        .order_by(models.DirectMessage.created_at.desc())
        .all()
    )

    # Group by conversation partner
    threads: dict[int, dict] = {}
    for msg in messages:
        partner_id = msg.recipient_id if msg.sender_id == user_id else msg.sender_id
        partner_user = msg.recipient if msg.sender_id == user_id else msg.sender

        # Skip threads with inactive or deleted partners to keep inbox actionable
        if partner_user is None or not getattr(partner_user, "is_active", True):
            continue

        if partner_id not in threads:
            threads[partner_id] = {
                "partner_id": partner_id,
                "partner_name": partner_user.name,
                "partner_photo_url": partner_user.photo_url,
                "last_message_body": msg.body,
                "last_message_at": msg.created_at,
                "unread_count": 0,
            }
        # Count unread messages sent TO this user by that partner
        if msg.sender_id == partner_id and not msg.is_read:
            threads[partner_id]["unread_count"] += 1

    return list(threads.values())


# ── Device Token / Push Notification CRUD ────────────────────────────────────

def register_device_token(
    db: Session,
    user_id: int,
    token: str,
    platform: str = "unknown",
) -> models.DeviceToken:
    """
    Register (upsert) an Expo push notification token for a user.

    If the token already exists in the database (e.g. from a previous session
    or a different user) it is re-assigned to this user and its platform is
    updated.  This handles app-reinstall and user-switch scenarios.

    Args:
        db: Database session
        user_id: Owner of the token
        token: Expo push token string
        platform: 'ios' | 'android' | 'unknown'

    Returns:
        The persisted DeviceToken row.
    """
    existing = (
        db.query(models.DeviceToken).filter(models.DeviceToken.token == token).first()
    )
    if existing:
        existing.user_id = user_id
        existing.platform = platform
        db.commit()
        db.refresh(existing)
        return existing

    device_token = models.DeviceToken(
        user_id=user_id,
        token=token,
        platform=platform,
    )
    db.add(device_token)
    db.commit()
    db.refresh(device_token)
    return device_token


def get_device_tokens_for_user(db: Session, user_id: int) -> List[models.DeviceToken]:
    """Return all push tokens registered for *user_id*."""
    return (
        db.query(models.DeviceToken)
        .filter(models.DeviceToken.user_id == user_id)
        .all()
    )


def remove_device_token(db: Session, user_id: int, token: str) -> bool:
    """
    Remove a specific push token for a user (called on logout).

    Returns:
        True if a row was deleted, False if not found.
    """
    row = (
        db.query(models.DeviceToken)
        .filter(
            models.DeviceToken.user_id == user_id,
            models.DeviceToken.token == token,
        )
        .first()
    )
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True


def _send_expo_push(tokens: List[str], title: str, body: str, data: dict | None = None) -> None:
    """
    Fire-and-forget Expo Push API call.  Never raises — failures are logged.

    Expo Push API: https://docs.expo.dev/push-notifications/sending-notifications/
    Endpoint:      POST https://exp.host/--/api/v2/push/send
    Auth:          None required for basic delivery.

    Args:
        tokens: List of Expo push token strings.
        title:  Notification heading.
        body:   Notification body text.
        data:   Optional extras forwarded to the app (e.g. {'type': 'like'}).
    """
    if not tokens:
        return

    messages = [
        {
            "to": t,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
        }
        for t in tokens
    ]

    try:
        resp = httpx.post(
            "https://exp.host/--/api/v2/push/send",
            json=messages,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=5.0,
        )
        if resp.status_code != 200:
            logger.warning("Expo Push API returned %s: %s", resp.status_code, resp.text[:200])
    except Exception as exc:  # network error, timeout, etc.
        logger.warning("Expo Push send failed (non-blocking): %s", exc)
