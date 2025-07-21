from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import schemas, crud, models, auth
from ..database import SessionLocal

router = APIRouter(prefix="/podcasts", tags=["podcasts"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/create", response_model=schemas.Podcast)
def create_podcast(
    podcast: schemas.PodcastCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Create a new podcast"""
    return crud.create_podcast(db=db, podcast=podcast, owner_id=current_user.id)


@router.get("/{podcast_id}", response_model=schemas.Podcast)
def get_podcast(
    podcast_id: int = Path(..., description="The ID of the podcast to retrieve"),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional)
):
    """Get a specific podcast by ID"""
    podcast = crud.get_podcast(
        db=db, 
        podcast_id=podcast_id, 
        user_id=current_user.id if current_user else None
    )
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podcast not found"
        )
    return podcast


@router.get("/", response_model=schemas.PodcastListResponse)
def get_podcasts(
    skip: int = Query(0, ge=0, description="Number of podcasts to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of podcasts to return"),
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search in title and description"),
    owner_id: Optional[int] = Query(None, description="Filter by owner ID"),
    db: Session = Depends(get_db)
):
    """Get podcasts with filtering and pagination"""
    result = crud.get_podcasts(
        db=db,
        skip=skip,
        limit=limit,
        category=category,
        search_query=search,
        owner_id=owner_id,
        is_public=True
    )
    
    return schemas.PodcastListResponse(
        podcasts=result["podcasts"],
        total=result["total"],
        limit=limit,
        offset=skip,
        has_more=result["has_more"]
    )


@router.put("/{podcast_id}", response_model=schemas.Podcast)
def update_podcast(
    podcast_id: int = Path(..., description="The ID of the podcast to update"),
    podcast_update: schemas.PodcastUpdate = ...,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Update a podcast (owner only)"""
    podcast = crud.get_podcast(db=db, podcast_id=podcast_id)
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podcast not found"
        )
    
    if podcast.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this podcast"
        )
    
    return crud.update_podcast(db=db, podcast=podcast, podcast_update=podcast_update)


@router.delete("/{podcast_id}")
def delete_podcast(
    podcast_id: int = Path(..., description="The ID of the podcast to delete"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Delete a podcast (owner only)"""
    podcast = crud.get_podcast(db=db, podcast_id=podcast_id)
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podcast not found"
        )
    
    if podcast.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this podcast"
        )
    
    crud.delete_podcast(db=db, podcast=podcast)
    return {"message": "Podcast deleted successfully"}


# Podcast Interactions
@router.post("/{podcast_id}/like", response_model=schemas.PodcastLike)
def like_podcast(
    podcast_id: int = Path(..., description="The ID of the podcast to like"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Like a podcast"""
    # Check if podcast exists
    podcast = crud.get_podcast(db=db, podcast_id=podcast_id)
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podcast not found"
        )
    
    return crud.like_podcast(db=db, user_id=current_user.id, podcast_id=podcast_id)


@router.delete("/{podcast_id}/like")
def unlike_podcast(
    podcast_id: int = Path(..., description="The ID of the podcast to unlike"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Unlike a podcast"""
    crud.unlike_podcast(db=db, user_id=current_user.id, podcast_id=podcast_id)
    return {"message": "Podcast unliked successfully"}


@router.post("/{podcast_id}/bookmark", response_model=schemas.PodcastBookmark)
def bookmark_podcast(
    podcast_id: int = Path(..., description="The ID of the podcast to bookmark"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Bookmark a podcast"""
    # Check if podcast exists
    podcast = crud.get_podcast(db=db, podcast_id=podcast_id)
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podcast not found"
        )
    
    return crud.bookmark_podcast(db=db, user_id=current_user.id, podcast_id=podcast_id)


@router.delete("/{podcast_id}/bookmark")
def remove_bookmark(
    podcast_id: int = Path(..., description="The ID of the podcast to remove bookmark"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Remove bookmark from a podcast"""
    crud.remove_bookmark(db=db, user_id=current_user.id, podcast_id=podcast_id)
    return {"message": "Bookmark removed successfully"}


@router.get("/{podcast_id}/interactions", response_model=schemas.UserInteractions)
def get_podcast_interactions(
    podcast_id: int = Path(..., description="The ID of the podcast"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get user's interactions with a specific podcast"""
    return crud.get_user_podcast_interactions(
        db=db, 
        user_id=current_user.id, 
        podcast_id=podcast_id
    )


# Listening History
@router.post("/{podcast_id}/history", response_model=schemas.ListeningHistory)
def update_listening_history(
    podcast_id: int = Path(..., description="The ID of the podcast"),
    history_update: schemas.ListeningHistoryUpdate = ...,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Update listening history for a podcast"""
    # Check if podcast exists
    podcast = crud.get_podcast(db=db, podcast_id=podcast_id)
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podcast not found"
        )
    
    return crud.update_listening_history(
        db=db,
        user_id=current_user.id,
        podcast_id=podcast_id,
        position=history_update.position,
        listen_time=history_update.listen_time,
        completed=history_update.completed
    )


# Comments
@router.post("/{podcast_id}/comments", response_model=schemas.PodcastComment)
def create_comment(
    podcast_id: int = Path(..., description="The ID of the podcast"),
    comment_data: schemas.PodcastCommentCreate = ...,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Create a comment on a podcast"""
    # Ensure podcast_id matches
    if comment_data.podcast_id != podcast_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Podcast ID mismatch"
        )
    
    # Check if podcast exists
    podcast = crud.get_podcast(db=db, podcast_id=podcast_id)
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podcast not found"
        )
    
    return crud.create_comment(db=db, comment=comment_data, user_id=current_user.id)


@router.get("/{podcast_id}/comments", response_model=List[schemas.PodcastComment])
def get_podcast_comments(
    podcast_id: int = Path(..., description="The ID of the podcast"),
    skip: int = Query(0, ge=0, description="Number of comments to skip"),
    limit: int = Query(50, ge=1, le=100, description="Number of comments to return"),
    db: Session = Depends(get_db)
):
    """Get comments for a podcast"""
    return crud.get_podcast_comments(db=db, podcast_id=podcast_id, skip=skip, limit=limit)


@router.put("/comments/{comment_id}", response_model=schemas.PodcastComment)
def update_comment(
    comment_id: int = Path(..., description="The ID of the comment to update"),
    comment_update: schemas.PodcastCommentUpdate = ...,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Update a comment (owner only)"""
    comment = db.query(models.PodcastComment).filter(
        models.PodcastComment.id == comment_id,
        models.PodcastComment.is_active == True
    ).first()
    
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    
    if comment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this comment"
        )
    
    return crud.update_comment(db=db, comment=comment, comment_update=comment_update)


@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: int = Path(..., description="The ID of the comment to delete"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Delete a comment (owner only)"""
    comment = db.query(models.PodcastComment).filter(
        models.PodcastComment.id == comment_id,
        models.PodcastComment.is_active == True
    ).first()
    
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    
    if comment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this comment"
        )
    
    crud.delete_comment(db=db, comment=comment)
    return {"message": "Comment deleted successfully"}


# Analytics and Discovery
@router.get("/{podcast_id}/analytics", response_model=schemas.PodcastAnalytics)
def get_podcast_analytics(
    podcast_id: int = Path(..., description="The ID of the podcast"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get analytics for a podcast (owner only)"""
    podcast = crud.get_podcast(db=db, podcast_id=podcast_id)
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podcast not found"
        )
    
    if podcast.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view analytics for this podcast"
        )
    
    return crud.get_podcast_analytics(db=db, podcast_id=podcast_id)


@router.get("/discover/trending", response_model=List[schemas.Podcast])
def get_trending_podcasts(
    limit: int = Query(10, ge=1, le=50, description="Number of trending podcasts to return"),
    days: int = Query(7, ge=1, le=30, description="Number of days to consider for trending"),
    db: Session = Depends(get_db)
):
    """Get trending podcasts based on recent activity"""
    return crud.get_trending_podcasts(db=db, limit=limit, days=days)


@router.get("/discover/recommended", response_model=List[schemas.Podcast])
def get_recommended_podcasts(
    limit: int = Query(10, ge=1, le=50, description="Number of recommendations to return"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get personalized podcast recommendations"""
    return crud.get_recommended_podcasts(db=db, user_id=current_user.id, limit=limit)


@router.get("/discover/related/{podcast_id}", response_model=List[schemas.Podcast])
def get_related_podcasts(
    podcast_id: int = Path(..., description="The ID of the reference podcast"),
    limit: int = Query(10, ge=1, le=20, description="Number of related podcasts to return"),
    db: Session = Depends(get_db)
):
    """Get podcasts related to a specific podcast"""
    # Get the reference podcast
    podcast = crud.get_podcast(db=db, podcast_id=podcast_id)
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podcast not found"
        )
    
    # Get podcasts in the same category, excluding the reference podcast
    result = crud.get_podcasts(
        db=db,
        skip=0,
        limit=limit,
        category=podcast.category,
        is_public=True
    )
    
    # Filter out the reference podcast
    related_podcasts = [p for p in result["podcasts"] if p.id != podcast_id]
    
    return related_podcasts[:limit]


# User's Personal Collections
@router.get("/my/likes", response_model=List[schemas.Podcast])
def get_my_liked_podcasts(
    skip: int = Query(0, ge=0, description="Number of podcasts to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of podcasts to return"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get user's liked podcasts"""
    return crud.get_user_likes(db=db, user_id=current_user.id, skip=skip, limit=limit)


@router.get("/my/bookmarks", response_model=List[schemas.Podcast])
def get_my_bookmarked_podcasts(
    skip: int = Query(0, ge=0, description="Number of podcasts to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of podcasts to return"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get user's bookmarked podcasts"""
    return crud.get_user_bookmarks(db=db, user_id=current_user.id, skip=skip, limit=limit)


@router.get("/my/history", response_model=List[schemas.ListeningHistory])
def get_my_listening_history(
    skip: int = Query(0, ge=0, description="Number of history entries to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of history entries to return"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get user's listening history"""
    return crud.get_user_listening_history(db=db, user_id=current_user.id, skip=skip, limit=limit)


@router.get("/my/created", response_model=schemas.PodcastListResponse)
def get_my_podcasts(
    skip: int = Query(0, ge=0, description="Number of podcasts to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of podcasts to return"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get user's created podcasts"""
    result = crud.get_podcasts(
        db=db,
        skip=skip,
        limit=limit,
        owner_id=current_user.id,
        is_public=False  # Include both public and private podcasts for owner
    )
    
    return schemas.PodcastListResponse(
        podcasts=result["podcasts"],
        total=result["total"],
        limit=limit,
        offset=skip,
        has_more=result["has_more"]
    )
