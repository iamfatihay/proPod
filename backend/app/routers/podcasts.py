"""Podcast management endpoints."""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Query, Path, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from pathlib import Path as SysPath, PurePath
import json
import time
import os
from pydub import AudioSegment

from .. import schemas, crud, models, auth, config
from ..database import get_db
from ..services.ai_service import get_ai_service

router = APIRouter(prefix="/podcasts", tags=["podcasts"])

# Maximum upload size in bytes (100 MB). Extracted as a module constant so
# tests can monkeypatch it to avoid allocating large in-memory payloads.
MAX_UPLOAD_SIZE = 100 * 1024 * 1024


@router.post("/create", response_model=schemas.Podcast)
def create_podcast(
    podcast: schemas.PodcastCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Create a new podcast.

    The new-episode follower notification fan-out is dispatched as a
    BackgroundTask so the creator receives an immediate HTTP response
    regardless of how many followers they have.
    """
    db_podcast = crud.create_podcast(db=db, podcast=podcast, owner_id=current_user.id)
    # Only schedule the fan-out for public episodes — private ones are filtered
    # inside _notify_followers_new_episode too, but skipping the task entirely
    # is a cheap early guard.
    if db_podcast.is_public:
        background_tasks.add_task(
            crud.notify_followers_new_episode_background,
            podcast_id=db_podcast.id,
        )
    return db_podcast


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
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported file type: {file.content_type}. Allowed types: {', '.join(allowed_types)}",
            )

        # Read file content to check size
        contents = await file.read()
        if len(contents) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size: {MAX_UPLOAD_SIZE // (1024*1024)}MB",
            )

        # Ensure media directory exists
        media_dir = SysPath(os.path.dirname(__file__)
                            ).parent.parent / "media" / "audio"
        os.makedirs(media_dir, exist_ok=True)

        # Build a safe filename
        original_suffix = SysPath(file.filename).suffix or ".mp3"
        safe_name = f"podcast_{current_user.id}_{time.time_ns()}{original_suffix}"
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


@router.post("/merge-upload", response_model=schemas.AudioUploadResponse)
async def merge_and_upload_audio_segments(
    files: List[UploadFile] = File(...),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Merge multiple audio segments and return single audio URL.
    Used for draft recovery with multiple recording sessions.
    
    - Accepts multiple audio files in order
    - Merges them using pydub/ffmpeg
    - Returns single audio URL
    """
    if not files or len(files) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No audio files provided"
        )
    
    try:
        # Validate all files
        allowed_types = {"audio/mpeg", "audio/mp4", "audio/m4a", "audio/aac", "audio/wav", "audio/ogg"}
        max_size_per_file = 100 * 1024 * 1024  # 100MB per file
        max_total_size = 300 * 1024 * 1024  # 300MB total across all files
        
        temp_files = []
        total_size = 0
        
        # Read and validate all files
        for idx, file in enumerate(files):
            # Sanitize filename to prevent directory traversal
            safe_filename = PurePath(file.filename).name if file.filename else f"file_{idx}"
            
            if file.content_type not in allowed_types:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"File {idx+1} ({safe_filename}): Unsupported type {file.content_type}"
                )
            
            contents = await file.read()
            if len(contents) > max_size_per_file:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File {idx+1} ({safe_filename}) too large (max {max_size_per_file // (1024*1024)}MB)"
                )
            
            total_size += len(contents)
            
            # Check total size limit
            if total_size > max_total_size:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Total upload size exceeds {max_total_size // (1024*1024)}MB limit"
                )
            
            temp_files.append((safe_filename, contents, file.content_type))
        
        # Ensure temp and media directories exist
        media_dir = SysPath(os.path.dirname(__file__)).parent.parent / "media" / "audio"
        temp_dir = media_dir / "temp"
        os.makedirs(media_dir, exist_ok=True)
        os.makedirs(temp_dir, exist_ok=True)
        
        # Save temp files and load as AudioSegments
        audio_segments = []
        temp_paths = []
        
        try:
            for idx, (filename, contents, content_type) in enumerate(temp_files):
                # Determine format from content_type
                format_map = {
                    "audio/mpeg": "mp3",
                    "audio/mp4": "mp4",
                    "audio/m4a": "m4a", 
                    "audio/aac": "aac",
                    "audio/wav": "wav",
                    "audio/ogg": "ogg"
                }
                audio_format = format_map.get(content_type, "m4a")
                
                # Save to temp file with unique timestamp
                temp_path = temp_dir / f"segment_{idx}_{time.time_ns()}.{audio_format}"
                temp_paths.append(temp_path)
                
                with open(temp_path, "wb") as f:
                    f.write(contents)
                
                # Load as AudioSegment
                try:
                    segment = AudioSegment.from_file(str(temp_path), format=audio_format)
                    audio_segments.append(segment)
                except Exception as e:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Failed to load audio segment {idx+1}: {str(e)}"
                    )
            
            # Merge all segments
            if len(audio_segments) == 1:
                merged_audio = audio_segments[0]
            else:
                merged_audio = audio_segments[0]
                for segment in audio_segments[1:]:
                    merged_audio += segment  # Concatenate
            
            # Export merged audio with unique timestamp
            output_filename = f"podcast_{current_user.id}_{time.time_ns()}.m4a"
            output_path = media_dir / output_filename
            
            merged_audio.export(
                str(output_path),
                format="ipod",  # m4a format
                codec="aac",
                bitrate="128k"
            )
        finally:
            # Always cleanup temp files, even if an error occurred
            for temp_path in temp_paths:
                if temp_path.exists():
                    try:
                        os.remove(temp_path)
                    except Exception:
                        pass  # Ignore cleanup errors
        
        # Public URL
        public_path = f"/media/audio/{output_filename}"
        settings = config.Settings()
        full_audio_url = f"{settings.BASE_URL}{public_path}"
        
        return schemas.AudioUploadResponse(
            audio_url=full_audio_url,
            file_size=os.path.getsize(output_path),
            content_type="audio/mp4",
            filename=output_filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Audio merge failed: {str(e)}"
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
            ai_service = get_ai_service()
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


@router.get("/following-feed", response_model=schemas.PodcastListResponse)
def get_following_feed(
    skip: int = Query(0, ge=0, description="Number of podcasts to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of podcasts to return"),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Return public podcasts from creators the current user follows, newest first.

    Requires authentication. Returns an empty list (not 404) when the user has
    no followed creators or those creators have no public podcasts yet.
    """
    podcasts, total = crud.get_following_feed(
        db=db,
        user_id=current_user.id,
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


@router.get("/{podcast_id}", response_model=schemas.Podcast)
def get_podcast(
    podcast_id: int = Path(...,
                           description="The ID of the podcast to retrieve"),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(
        auth.get_current_user_optional)
):
    """
    Get a specific podcast by ID.

    Note: This endpoint automatically increments the podcast's play count.
    """
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


@router.get("/{podcast_id}/ai-data", response_model=schemas.PodcastAIDataResponse)
def get_podcast_ai_data(
    podcast_id: int = Path(..., description="The ID of the podcast"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get AI analysis data for a podcast"""
    # Check if podcast exists
    podcast = crud.get_podcast(db=db, podcast_id=podcast_id)
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podcast not found"
        )
    
    # Check permissions: podcast must be public OR user must be the owner
    if not podcast.is_public and podcast.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view AI data for this podcast"
        )
    
    # Get AI data
    ai_data = db.query(models.PodcastAIData).filter(
        models.PodcastAIData.podcast_id == podcast_id
    ).first()
    
    if not ai_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI data not found for this podcast"
        )
    
    # Parse JSON fields
    keywords = json.loads(ai_data.keywords) if ai_data.keywords else []
    categories = json.loads(ai_data.categories) if ai_data.categories else []
    
    return schemas.PodcastAIDataResponse(
        id=ai_data.id,
        podcast_id=ai_data.podcast_id,
        transcription_text=ai_data.transcription_text,
        transcription_language=ai_data.transcription_language,
        transcription_confidence=ai_data.transcription_confidence,
        keywords=keywords,
        summary=ai_data.summary,
        sentiment=ai_data.sentiment,
        categories=categories,
        quality_score=ai_data.quality_score,
        processing_time_seconds=ai_data.processing_time_seconds,
        created_at=ai_data.created_at,
        updated_at=ai_data.updated_at
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


@router.delete("/{podcast_id}/history", response_model=schemas.SuccessMessage)
def delete_listening_history(
    podcast_id: int = Path(..., description="The ID of the podcast"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Remove a podcast from the current user's listening history."""
    # Verify podcast exists first so we can return a meaningful 404
    podcast = crud.get_podcast(db=db, podcast_id=podcast_id, increment_play_count=False)
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podcast not found"
        )

    deleted = crud.delete_listening_history(
        db=db,
        user_id=current_user.id,
        podcast_id=podcast_id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="History entry not found"
        )
    return {"message": "History entry removed"}


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


@router.get("/discover/categories", response_model=List[schemas.CategoryInfo])
def get_categories(
    db: Session = Depends(get_db),
):
    """List all podcast categories with their podcast counts.

    Returns categories sorted by number of public podcasts (descending),
    useful for populating category filters and browse-by-category screens.
    """
    return crud.get_categories(db=db)


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
    podcasts, total = crud.get_podcasts(
        db=db,
        skip=0,
        limit=limit,
        category=podcast.category,
        is_public=True
    )

    # Filter out the reference podcast
    related_podcasts = [p for p in podcasts if p.id != podcast_id]

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


@router.get("/my/continue-listening", response_model=List[schemas.ContinueListeningItem])
def get_continue_listening(
    skip: int = Query(
        0, ge=0, description="Number of entries to skip"),
    limit: int = Query(
        10, ge=1, le=50, description="Number of entries to return"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Get podcasts the user started but hasn't finished.

    Returns in-progress podcasts ordered by most recently played,
    suitable for rendering a 'Continue Listening' widget on the home screen.
    Only podcasts with a saved position > 0 and not yet marked as completed
    are included.
    """
    return crud.get_continue_listening(
        db=db, user_id=current_user.id, skip=skip, limit=limit,
    )


@router.get("/my/created", response_model=schemas.PodcastListResponse)
def get_my_podcasts(
    skip: int = Query(0, ge=0, description="Number of podcasts to skip"),
    limit: int = Query(
        20, ge=1, le=100, description="Number of podcasts to return"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get user's created podcasts"""
    podcasts, total = crud.get_podcasts(
        db=db,
        skip=skip,
        limit=limit,
        owner_id=current_user.id,
        is_public=False  # Include both public and private podcasts for owner
    )

    return schemas.PodcastListResponse(
        podcasts=podcasts,
        total=total,
        limit=limit,
        offset=skip,
        has_more=total > skip + limit
    )
