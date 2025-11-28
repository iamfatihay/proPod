"""Podcast management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from pathlib import Path as SysPath
import json
import asyncio
import os

from .. import schemas, crud, models, auth, config
from ..database import get_db
from ..services.ai_service import ai_service

router = APIRouter(prefix="/podcasts", tags=["podcasts"])


@router.post("/create", response_model=schemas.Podcast)
def create_podcast(
    podcast: schemas.PodcastCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Create a new podcast"""
    return crud.create_podcast(db=db, podcast=podcast, owner_id=current_user.id)


@router.post("/upload", response_model=schemas.AudioUploadResponse)
async def upload_podcast_audio(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Upload a podcast audio file and return its public URL path"""
    try:
        # Validate file type and size
        allowed_types = {"audio/mpeg", "audio/mp4",
                         "audio/m4a", "audio/aac", "audio/wav", "audio/ogg"}
        max_size = 100 * 1024 * 1024  # 100MB

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

        # Ensure media directory exists
        media_dir = SysPath(os.path.dirname(__file__)
                            ).parent.parent / "media" / "audio"
        os.makedirs(media_dir, exist_ok=True)

        # Build a safe filename
        original_suffix = SysPath(file.filename).suffix or ".mp3"
        safe_name = f"podcast_{current_user.id}_{int(asyncio.get_event_loop().time()*1e9)}{original_suffix}"
        dest_path = media_dir / safe_name

        # Save file to disk
        with open(dest_path, "wb") as f:
            f.write(contents)

        # Public URL path (served via /media)
        public_path = f"/media/audio/{safe_name}"

        # Get base URL from config
        settings = config.Settings()
        full_audio_url = f"{settings.BASE_URL}{public_path}"

        return schemas.AudioUploadResponse(
            audio_url=full_audio_url,
            file_size=len(contents),
            content_type=file.content_type,
            filename=safe_name
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Audio upload failed: {str(e)}",
        )


@router.post("/{podcast_id}/process-ai", response_model=schemas.AIProcessingResult)
async def process_podcast_with_ai(
    podcast_id: int = Path(...,
                           description="The ID of the podcast to process"),
    request: schemas.AIProcessingRequest = ...,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Process podcast with AI enhancement
    """
    try:
        # Get podcast
        podcast = crud.get_podcast(db=db, podcast_id=podcast_id)
        if not podcast:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Podcast not found"
            )

        # Check ownership
        if podcast.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to process this podcast"
            )

        # Update processing status
        podcast.ai_processing_status = "processing"
        db.commit()

        try:
            # Prepare AI processing options
            options = {
                "enhance_audio": request.enhance_audio,
                "transcribe": request.transcribe,
                "analyze_content": request.analyze_content,
                "audio_options": {
                    "noise_reduction": True,
                    "normalize": True,
                    "compress": True,
                    "quality": "high"
                },
                "transcription_options": {
                    "language": request.language if request.language != "auto" else None,
                    "include_timestamps": True,
                    "include_word_timestamps": False
                },
                "analysis_options": {
                    "extract_keywords": True,
                    "suggest_categories": True,
                    "generate_summary": True,
                    "analyze_sentiment": True
                }
            }

            # Process with AI
            ai_results = await ai_service.process_podcast_audio(podcast.audio_url, options)

            # Update podcast with AI results
            if ai_results["success"]:
                # Update transcription
                if ai_results.get("transcription"):
                    transcription = ai_results["transcription"]
                    podcast.transcription_text = transcription.get("text", "")
                    podcast.transcription_language = transcription.get(
                        "language", "")
                    podcast.transcription_confidence = json.dumps({
                        "probability": transcription.get("language_probability", 0.0),
                        "segments_count": len(transcription.get("segments", []))
                    })
                    # Persist duration from transcription if provided (seconds)
                    try:
                        trans_duration = transcription.get("duration")
                        if isinstance(trans_duration, (int, float)) and trans_duration > 0:
                            podcast.duration = int(trans_duration)
                    except Exception:
                        pass

                # Update content analysis
                if ai_results.get("analysis"):
                    analysis = ai_results["analysis"]
                    podcast.ai_keywords = json.dumps(
                        analysis.get("keywords", []))
                    podcast.ai_summary = analysis.get("summary", "")

                    sentiment = analysis.get("sentiment", {})
                    podcast.ai_sentiment = sentiment.get("label", "neutral")
                    podcast.ai_categories = json.dumps(
                        analysis.get("categories", []))

                # Update audio stats
                if ai_results.get("audio_stats"):
                    podcast.ai_quality_score = json.dumps(
                        ai_results["audio_stats"])

                podcast.ai_enhanced = True
                podcast.ai_processing_status = "completed"
                podcast.ai_processing_date = models.datetime.datetime.now(
                    models.datetime.timezone.utc)

                # Auto-suggest category if empty
                if not podcast.category or podcast.category == "General":
                    if ai_results.get("analysis", {}).get("categories"):
                        top_category = ai_results["analysis"]["categories"][0]
                        if top_category.get("confidence", 0) > 0.7:
                            podcast.category = top_category["category"]
            else:
                podcast.ai_processing_status = "failed"

            db.commit()

            return {
                "success": ai_results["success"],
                "processing_time": ai_results["processing_time"],
                "message": "AI processing completed successfully" if ai_results["success"] else "AI processing failed",
                "podcast_id": podcast_id,
                "ai_enhanced": podcast.ai_enhanced,
                "errors": ai_results.get("errors", [])
            }

        except Exception as e:
            # Update failed status
            podcast.ai_processing_status = "failed"
            db.commit()
            raise e

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI processing failed: {str(e)}"
        )


@router.get("/{podcast_id}", response_model=schemas.Podcast)
def get_podcast(
    podcast_id: int = Path(..., description="The ID of the podcast to retrieve"),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional)
):
    """Get a specific podcast by ID and increment play count."""
    podcast = crud.get_podcast(
        db=db,
        podcast_id=podcast_id,
        increment_play_count=True
    )
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podcast not found"
        )
    return podcast


@router.get("/search", response_model=schemas.PodcastListResponse)
def search_podcasts(
    query: str = Query(..., min_length=1, description="Search query"),
    category: Optional[str] = Query(None, description="Filter by category"),
    skip: int = Query(0, ge=0, description="Number of podcasts to skip"),
    limit: int = Query(
        20, ge=1, le=100, description="Number of podcasts to return"),
    db: Session = Depends(get_db)
):
    """Search podcasts by title and description"""
    result = crud.search_podcasts(
        db=db,
        query=query,
        category=category,
        skip=skip,
        limit=limit,
        is_public=True
    )

    podcasts, total = result
    return schemas.PodcastListResponse(
        podcasts=podcasts,
        total=total,
        limit=limit,
        offset=skip,
        has_more=total > skip + limit
    )


@router.get("/", response_model=schemas.PodcastListResponse)
def get_podcasts(
    skip: int = Query(0, ge=0, description="Number of podcasts to skip"),
    limit: int = Query(
        20, ge=1, le=100, description="Number of podcasts to return"),
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(
        None, description="Search in title and description"),
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

    podcasts, total = result
    return schemas.PodcastListResponse(
        podcasts=podcasts,
        total=total,
        limit=limit,
        offset=skip,
        has_more=total > skip + limit
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


@router.delete("/{podcast_id}", response_model=schemas.SuccessMessage)
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
    return schemas.SuccessMessage(message="Podcast deleted successfully")


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


@router.delete("/{podcast_id}/like", response_model=schemas.SuccessMessage)
def unlike_podcast(
    podcast_id: int = Path(..., description="The ID of the podcast to unlike"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Unlike a podcast"""
    crud.unlike_podcast(db=db, user_id=current_user.id, podcast_id=podcast_id)
    return schemas.SuccessMessage(message="Podcast unliked successfully")


@router.post("/{podcast_id}/bookmark", response_model=schemas.PodcastBookmark)
def bookmark_podcast(
    podcast_id: int = Path(...,
                           description="The ID of the podcast to bookmark"),
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


@router.delete("/{podcast_id}/bookmark", response_model=schemas.SuccessMessage)
def remove_bookmark(
    podcast_id: int = Path(...,
                           description="The ID of the podcast to remove bookmark"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Remove bookmark from a podcast"""
    crud.remove_bookmark(db=db, user_id=current_user.id, podcast_id=podcast_id)
    return schemas.SuccessMessage(message="Bookmark removed successfully")


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
    limit: int = Query(
        50, ge=1, le=100, description="Number of comments to return"),
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


@router.delete("/comments/{comment_id}", response_model=schemas.SuccessMessage)
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
    return schemas.SuccessMessage(message="Comment deleted successfully")


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
    limit: int = Query(
        10, ge=1, le=50, description="Number of trending podcasts to return"),
    days: int = Query(
        7, ge=1, le=30, description="Number of days to consider for trending"),
    db: Session = Depends(get_db)
):
    """Get trending podcasts based on recent activity"""
    return crud.get_trending_podcasts(db=db, limit=limit, days=days)


@router.get("/discover/recommended", response_model=List[schemas.Podcast])
def get_recommended_podcasts(
    limit: int = Query(
        10, ge=1, le=50, description="Number of recommendations to return"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get personalized podcast recommendations"""
    return crud.get_recommended_podcasts(db=db, user_id=current_user.id, limit=limit)


@router.get("/discover/related/{podcast_id}", response_model=List[schemas.Podcast])
def get_related_podcasts(
    podcast_id: int = Path(..., description="The ID of the reference podcast"),
    limit: int = Query(
        10, ge=1, le=20, description="Number of related podcasts to return"),
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
    limit: int = Query(
        20, ge=1, le=100, description="Number of podcasts to return"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get user's liked podcasts"""
    return crud.get_user_likes(db=db, user_id=current_user.id, skip=skip, limit=limit)


@router.get("/my/bookmarks", response_model=List[schemas.Podcast])
def get_my_bookmarked_podcasts(
    skip: int = Query(0, ge=0, description="Number of podcasts to skip"),
    limit: int = Query(
        20, ge=1, le=100, description="Number of podcasts to return"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get user's bookmarked podcasts"""
    return crud.get_user_bookmarks(db=db, user_id=current_user.id, skip=skip, limit=limit)


@router.get("/my/history", response_model=List[schemas.ListeningHistory])
def get_my_listening_history(
    skip: int = Query(
        0, ge=0, description="Number of history entries to skip"),
    limit: int = Query(
        20, ge=1, le=100, description="Number of history entries to return"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get user's listening history"""
    return crud.get_user_listening_history(db=db, user_id=current_user.id, skip=skip, limit=limit)


@router.get("/my/created", response_model=schemas.PodcastListResponse)
def get_my_podcasts(
    skip: int = Query(0, ge=0, description="Number of podcasts to skip"),
    limit: int = Query(
        20, ge=1, le=100, description="Number of podcasts to return"),
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
