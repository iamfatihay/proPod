from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, and_, or_
from . import models, schemas
from passlib.context import CryptContext
from fastapi import HTTPException
import secrets
import datetime
from datetime import timezone
from typing import Optional, List, Dict

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# User CRUD
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def get_user_by_reset_token(db: Session, token: str):
    """Get user by reset token if token is valid and not expired"""
    return db.query(models.User).filter(
        models.User.reset_token == token,
        models.User.reset_token_expires > datetime.datetime.now(timezone.utc)
    ).first()


def create_user(db: Session, user: schemas.UserCreate):
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


def create_google_user(db: Session, user_data: dict):
    db_user = models.User(**user_data)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user: models.User, user_update: schemas.UserUpdate):
    for field, value in user_update.dict(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def set_reset_token(db: Session, user: models.User):
    """Generate and set reset token for user"""
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires = datetime.datetime.now(timezone.utc) + datetime.timedelta(hours=1)
    db.commit()
    db.refresh(user)
    return token


def reset_user_password(db: Session, user: models.User, new_password: str):
    """Reset user password and clear reset token"""
    user.hashed_password = pwd_context.hash(new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    db.refresh(user)
    return user


def change_user_password(db: Session, user: models.User, old_password: str, new_password: str):
    if not pwd_context.verify(old_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Old password is incorrect")
    
    user.hashed_password = pwd_context.hash(new_password)
    db.commit()
    db.refresh(user)
    return user


def soft_delete_user(db: Session, user: models.User):
    user.is_active = False
    db.commit()
    return user


# Podcast CRUD
def create_podcast(db: Session, podcast: schemas.PodcastCreate, owner_id: int):
    db_podcast = models.Podcast(**podcast.dict(), owner_id=owner_id)
    db.add(db_podcast)
    db.commit()
    db.refresh(db_podcast)
    return db_podcast


def get_podcast(db: Session, podcast_id: int, user_id: Optional[int] = None):
    """Get podcast with optional user-specific data"""
    query = db.query(models.Podcast).options(
        joinedload(models.Podcast.owner)
    ).filter(models.Podcast.id == podcast_id)
    
    podcast = query.first()
    if not podcast:
        return None
    
    # Increment play count
    podcast.play_count += 1
    db.commit()
    
    return podcast


def get_podcasts(
    db: Session, 
    skip: int = 0, 
    limit: int = 20,
    category: Optional[str] = None,
    owner_id: Optional[int] = None,
    search_query: Optional[str] = None,
    is_public: bool = True
):
    """Get podcasts with filtering and pagination"""
    query = db.query(models.Podcast).options(
        joinedload(models.Podcast.owner)
    )
    
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
    
    return {
        "podcasts": podcasts,
        "total": total,
        "has_more": total > skip + limit
    }


def update_podcast(db: Session, podcast: models.Podcast, podcast_update: schemas.PodcastUpdate):
    for field, value in podcast_update.dict(exclude_unset=True).items():
        setattr(podcast, field, value)
    
    podcast.updated_at = datetime.datetime.now(timezone.utc)
    db.commit()
    db.refresh(podcast)
    return podcast


def delete_podcast(db: Session, podcast: models.Podcast):
    db.delete(podcast)
    db.commit()
    return True


# Podcast Interaction CRUD
def get_user_podcast_interactions(db: Session, user_id: int, podcast_id: int):
    """Get user's interactions with a specific podcast"""
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


def like_podcast(db: Session, user_id: int, podcast_id: int):
    """Like a podcast"""
    # Check if already liked
    existing_like = db.query(models.PodcastLike).filter(
        models.PodcastLike.user_id == user_id,
        models.PodcastLike.podcast_id == podcast_id
    ).first()
    
    if existing_like:
        raise HTTPException(status_code=400, detail="Podcast already liked")
    
    # Create like
    like = models.PodcastLike(user_id=user_id, podcast_id=podcast_id)
    db.add(like)
    
    # Update podcast like count
    podcast = db.query(models.Podcast).filter(models.Podcast.id == podcast_id).first()
    if podcast:
        podcast.like_count += 1
    
    db.commit()
    db.refresh(like)
    return like


def unlike_podcast(db: Session, user_id: int, podcast_id: int):
    """Unlike a podcast"""
    like = db.query(models.PodcastLike).filter(
        models.PodcastLike.user_id == user_id,
        models.PodcastLike.podcast_id == podcast_id
    ).first()
    
    if not like:
        raise HTTPException(status_code=404, detail="Like not found")
    
    # Remove like
    db.delete(like)
    
    # Update podcast like count
    podcast = db.query(models.Podcast).filter(models.Podcast.id == podcast_id).first()
    if podcast and podcast.like_count > 0:
        podcast.like_count -= 1
    
    db.commit()
    return True


def bookmark_podcast(db: Session, user_id: int, podcast_id: int):
    """Bookmark a podcast"""
    # Check if already bookmarked
    existing_bookmark = db.query(models.PodcastBookmark).filter(
        models.PodcastBookmark.user_id == user_id,
        models.PodcastBookmark.podcast_id == podcast_id
    ).first()
    
    if existing_bookmark:
        raise HTTPException(status_code=400, detail="Podcast already bookmarked")
    
    # Create bookmark
    bookmark = models.PodcastBookmark(user_id=user_id, podcast_id=podcast_id)
    db.add(bookmark)
    
    # Update podcast bookmark count
    podcast = db.query(models.Podcast).filter(models.Podcast.id == podcast_id).first()
    if podcast:
        podcast.bookmark_count += 1
    
    db.commit()
    db.refresh(bookmark)
    return bookmark


def remove_bookmark(db: Session, user_id: int, podcast_id: int):
    """Remove bookmark from a podcast"""
    bookmark = db.query(models.PodcastBookmark).filter(
        models.PodcastBookmark.user_id == user_id,
        models.PodcastBookmark.podcast_id == podcast_id
    ).first()
    
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    
    # Remove bookmark
    db.delete(bookmark)
    
    # Update podcast bookmark count
    podcast = db.query(models.Podcast).filter(models.Podcast.id == podcast_id).first()
    if podcast and podcast.bookmark_count > 0:
        podcast.bookmark_count -= 1
    
    db.commit()
    return True


def get_user_likes(db: Session, user_id: int, skip: int = 0, limit: int = 20):
    """Get user's liked podcasts"""
    likes = db.query(models.PodcastLike).options(
        joinedload(models.PodcastLike.podcast).joinedload(models.Podcast.owner)
    ).filter(
        models.PodcastLike.user_id == user_id
    ).order_by(desc(models.PodcastLike.created_at)).offset(skip).limit(limit).all()
    
    return [like.podcast for like in likes]


def get_user_bookmarks(db: Session, user_id: int, skip: int = 0, limit: int = 20):
    """Get user's bookmarked podcasts"""
    bookmarks = db.query(models.PodcastBookmark).options(
        joinedload(models.PodcastBookmark.podcast).joinedload(models.Podcast.owner)
    ).filter(
        models.PodcastBookmark.user_id == user_id
    ).order_by(desc(models.PodcastBookmark.created_at)).offset(skip).limit(limit).all()
    
    return [bookmark.podcast for bookmark in bookmarks]


# Listening History CRUD
def update_listening_history(
    db: Session, 
    user_id: int, 
    podcast_id: int, 
    position: int,
    listen_time: Optional[int] = None,
    completed: Optional[bool] = None
):
    """Update user's listening history for a podcast"""
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


def get_user_listening_history(db: Session, user_id: int, skip: int = 0, limit: int = 20):
    """Get user's listening history"""
    history = db.query(models.ListeningHistory).options(
        joinedload(models.ListeningHistory.podcast).joinedload(models.Podcast.owner)
    ).filter(
        models.ListeningHistory.user_id == user_id
    ).order_by(desc(models.ListeningHistory.updated_at)).offset(skip).limit(limit).all()
    
    return history


# Comment CRUD
def create_comment(db: Session, comment: schemas.PodcastCommentCreate, user_id: int):
    """Create a new comment on a podcast"""
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


def get_podcast_comments(db: Session, podcast_id: int, skip: int = 0, limit: int = 50):
    """Get comments for a podcast"""
    comments = db.query(models.PodcastComment).options(
        joinedload(models.PodcastComment.user)
    ).filter(
        models.PodcastComment.podcast_id == podcast_id,
        models.PodcastComment.is_active == True
    ).order_by(models.PodcastComment.timestamp).offset(skip).limit(limit).all()
    
    return comments


def update_comment(db: Session, comment: models.PodcastComment, comment_update: schemas.PodcastCommentUpdate):
    """Update a comment"""
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
        models.Podcast.category.in_([cat[0] for cat in liked_categories]),
        models.Podcast.is_public == True,
        ~models.Podcast.id.in_(user_podcast_ids)
    ).order_by(
        desc(models.Podcast.like_count)
    ).limit(limit).all()
    
    return recommended
