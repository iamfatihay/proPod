"""CRUD (Create, Read, Update, Delete) operations for database models."""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, and_, or_
from passlib.context import CryptContext
from fastapi import HTTPException, status
import secrets
import datetime
from datetime import timezone
from typing import Optional, List, Dict, Tuple, Any

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
    for field, value in user_update.dict(exclude_unset=True).items():
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
    db_podcast = models.Podcast(**podcast.dict(), owner_id=owner_id)
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
    for field, value in podcast_update.dict(exclude_unset=True).items():
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
    db.commit()
    db.refresh(db_comment)
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
    for field, value in comment_update.dict(exclude_unset=True).items():
        setattr(comment, field, value)
    
    comment.updated_at = datetime.datetime.now(timezone.utc)
    db.commit()
    db.refresh(comment)
    return comment


def delete_comment(db: Session, comment: models.PodcastComment):
    """Soft delete a comment"""
    comment.is_active = False
    comment.updated_at = datetime.datetime.now(timezone.utc)
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
        func.count(
            func.case([(models.ListeningHistory.completed == True, 1)])
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
        models.Podcast.is_public == True
    ).group_by(
        models.Podcast.id
    ).order_by(
        desc('trend_score')
    ).limit(limit).all()
    
    return [podcast[0] for podcast in trending]


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
    
    # Get podcasts from preferred categories that user hasn't interacted with
    user_podcast_ids = db.query(models.PodcastLike.podcast_id).filter(
        models.PodcastLike.user_id == user_id
    ).union(
        db.query(models.PodcastBookmark.podcast_id).filter(
            models.PodcastBookmark.user_id == user_id
        )
    ).subquery()
    
    recommended = db.query(models.Podcast).options(
        joinedload(models.Podcast.owner)
    ).filter(
        models.Podcast.is_deleted == False,
        models.Podcast.category.in_([cat[0] for cat in liked_categories]),
        models.Podcast.is_public == True,
        ~models.Podcast.id.in_(user_podcast_ids)
    ).order_by(
        desc(models.Podcast.like_count)
    ).limit(limit).all()
    
    return recommended
