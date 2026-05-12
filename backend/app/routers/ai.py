"""
AI Processing API Endpoints.

Provides endpoints for:
- Starting AI processing for podcasts
- Checking processing status
- Retrieving AI results
- Reprocessing podcasts
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from urllib.parse import urlparse
import json
import logging
import tempfile
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict
import httpx

from app.database import get_db, SessionLocal
from app.auth import get_current_user
from app import models, schemas
from app.config import settings
from app.services.ai_service import (
    get_ai_service,
    ProcessingOptions
)
from app.services.transcription_service import TranscriptionService


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["AI Processing"])

REMOTE_AUDIO_CONTENT_TYPE_SUFFIXES = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/mp4": ".mp4",
    "video/mp4": ".mp4",
    "audio/m4a": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/webm": ".webm",
}


# Rate limiting cache (in-memory, per-user request tracking)
_rate_limit_cache: Dict[int, list] = defaultdict(list)
MAX_REQUESTS_PER_HOUR = 20  # Free users
MAX_REQUESTS_PER_HOUR_PREMIUM = 100  # Premium users


def check_rate_limit(user: models.User):
    """
    Check if user has exceeded rate limit for AI processing.
    
    Rate limits:
    - Free users: 20 requests per hour
    - Premium users: 100 requests per hour
    
    Args:
        user: User making the request
        
    Raises:
        HTTPException: If rate limit exceeded (429 status)
    """
    now = datetime.utcnow()
    hour_ago = now - timedelta(hours=1)
    
    # Clean old requests (remove entries older than 1 hour)
    _rate_limit_cache[user.id] = [
        req_time for req_time in _rate_limit_cache[user.id]
        if req_time > hour_ago
    ]
    
    # Determine limit based on premium status
    limit = MAX_REQUESTS_PER_HOUR_PREMIUM if user.is_premium else MAX_REQUESTS_PER_HOUR
    
    # Check if limit exceeded
    if len(_rate_limit_cache[user.id]) >= limit:
        logger.warning(
            f"Rate limit exceeded for user {user.id} ({user.username}): "
            f"{len(_rate_limit_cache[user.id])}/{limit} requests in last hour"
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "Rate limit exceeded",
                "message": f"Maximum {limit} AI processing requests per hour allowed",
                "retry_after_seconds": 3600,
                "is_premium": user.is_premium
            }
        )
    
    # Add current request timestamp
    _rate_limit_cache[user.id].append(now)
    logger.debug(
        f"Rate limit check passed for user {user.id}: "
        f"{len(_rate_limit_cache[user.id])}/{limit} requests"
    )


def _is_remote_audio_url(audio_url: str) -> bool:
    """Treat non-/media HTTP(S) URLs as remote sources that must be downloaded."""
    parsed_url = urlparse(audio_url)
    return (
        parsed_url.scheme in {"http", "https"}
        and bool(parsed_url.netloc)
        and not parsed_url.path.startswith("/media/")
    )


def _get_allowed_remote_audio_hosts() -> set[str]:
    """Allow only the backend host and Google Cloud Storage recording hosts."""
    allowed_hosts = {"storage.googleapis.com"}
    base_host = urlparse(settings.BASE_URL).hostname
    if base_host:
        allowed_hosts.add(base_host.lower())
    return allowed_hosts


def _is_allowed_remote_audio_host(hostname: Optional[str]) -> bool:
    """Restrict remote downloads to explicitly trusted media hosts."""
    if not hostname:
        return False

    normalized_host = hostname.lower()
    allowed_hosts = _get_allowed_remote_audio_hosts()
    return any(
        normalized_host == allowed_host
        or normalized_host.endswith(f".{allowed_host}")
        for allowed_host in allowed_hosts
    )


def _get_remote_audio_suffix(audio_url: str, content_type: Optional[str]) -> str:
    """Choose a supported local suffix for a downloaded remote audio asset."""
    suffix = Path(urlparse(audio_url).path).suffix.lower()
    if suffix in TranscriptionService.SUPPORTED_FORMATS:
        return suffix

    normalized_content_type = (content_type or "").split(";", 1)[0].strip().lower()
    mapped_suffix = REMOTE_AUDIO_CONTENT_TYPE_SUFFIXES.get(normalized_content_type)
    if mapped_suffix in TranscriptionService.SUPPORTED_FORMATS:
        return mapped_suffix

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported remote audio format"
    )


def _resolve_local_audio_path(audio_url: str) -> Path:
    """Resolve a local media URL/path into a validated backend file path."""
    local_audio_url = audio_url
    if local_audio_url.startswith("http://") or local_audio_url.startswith("https://"):
        local_audio_url = urlparse(local_audio_url).path.lstrip("/")

    try:
        audio_path = settings.BACKEND_ROOT / local_audio_url.lstrip("/")
        audio_path = audio_path.resolve()

        if not str(audio_path).startswith(str(settings.BACKEND_ROOT.resolve())):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid audio file path"
            )
    except (ValueError, OSError) as e:
        logger.error(f"Path resolution error for {audio_url}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid audio file path"
        )

    if not audio_path.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Audio file not found: {audio_url}"
        )

    return audio_path


async def _download_remote_audio_to_temp_file(audio_url: str) -> Path:
    """Download a remote recording to a temporary local file for AI processing."""
    try:
        async with httpx.AsyncClient(timeout=settings.AI_TIMEOUT_SECONDS) as client:
            async with client.stream("GET", audio_url) as response:
                if not _is_allowed_remote_audio_host(response.request.url.host):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Remote audio host is not allowed"
                    )

                response.raise_for_status()

                max_size_bytes = settings.AI_MAX_AUDIO_SIZE_MB * 1024 * 1024
                content_length = response.headers.get("Content-Length")
                if content_length:
                    try:
                        declared_size = int(content_length)
                    except ValueError:
                        declared_size = None
                    if declared_size and declared_size > max_size_bytes:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Remote audio file is too large for AI processing"
                        )

                suffix = _get_remote_audio_suffix(
                    audio_url,
                    response.headers.get("Content-Type"),
                )
                with tempfile.NamedTemporaryFile(
                    delete=False,
                    prefix="propod_ai_",
                    suffix=suffix,
                ) as temp_file:
                    temp_path = Path(temp_file.name)

                downloaded_bytes = 0
                with temp_path.open("wb") as file_handle:
                    async for chunk in response.aiter_bytes():
                        if chunk:
                            downloaded_bytes += len(chunk)
                            if downloaded_bytes > max_size_bytes:
                                raise HTTPException(
                                    status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="Remote audio file is too large for AI processing"
                                )
                            file_handle.write(chunk)

        return temp_path
    except Exception:
        if 'temp_path' in locals():
            temp_path.unlink(missing_ok=True)
        raise


def estimate_processing_time(
    duration_seconds: int,
    provider: str,
    device: str,
    user_is_premium: bool = False
) -> int:
    """
    Estimate AI processing time based on audio duration and provider configuration.
    
    Processing speed multipliers (relative to audio duration):
    - OpenAI API: ~2x realtime (10min audio = ~20s processing)
    - Local GPU: ~5x realtime (10min audio = ~50s processing)
    - Local CPU: ~30x realtime (10min audio = ~5min processing)
    
    Args:
        duration_seconds: Audio duration in seconds
        provider: AI provider mode (local/openai/hybrid)
        device: Whisper device (cpu/cuda/mps)
        user_is_premium: Whether user has premium subscription (for hybrid mode)
    
    Returns:
        Estimated processing time in seconds
    """
    if not duration_seconds or duration_seconds == 0:
        return 60  # Fallback if duration unknown
    
    # Determine actual provider for hybrid mode
    actual_provider = provider
    if provider == "hybrid":
        actual_provider = "openai" if user_is_premium else "local"
    
    # Calculate transcription time based on provider
    if actual_provider == "openai":
        # OpenAI is fast: ~2x realtime
        transcription_time = duration_seconds * 2
    elif actual_provider == "local":
        if "cuda" in device.lower() or "mps" in device.lower():
            # GPU is medium: ~5x realtime
            transcription_time = duration_seconds * 5
        else:
            # CPU is slow: ~30x realtime
            transcription_time = duration_seconds * 30
    else:
        transcription_time = 60  # Fallback
    
    # Add analysis overhead
    if actual_provider == "openai":
        analysis_time = 15  # GPT-4 analysis takes ~10-20s
    else:
        analysis_time = 5   # Local analysis is instant
    
    total_estimate = transcription_time + analysis_time
    
    # Clamp to reasonable range (30s to 1 hour)
    return int(max(30, min(total_estimate, 3600)))


@router.post(
    "/process-podcast/{podcast_id}",
    response_model=Dict[str, Any],
    summary="Start AI processing for a podcast",
    description="Initiates AI transcription and analysis for a podcast audio file."
)
async def process_podcast(
    podcast_id: int,
    background_tasks: BackgroundTasks,
    enable_transcription: bool = True,
    enable_analysis: bool = True,
    language: str = "auto",
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Start AI processing for a podcast.
    
    **Processing includes:**
    - Audio transcription using OpenAI Whisper
    - Content analysis using GPT-4 (keywords, summary, sentiment)
    - Quality scoring
    - Category suggestions
    
    **Rate Limits:**
    - Free users: 20 requests per hour
    - Premium users: 100 requests per hour
    
    Args:
        podcast_id: ID of the podcast to process
        background_tasks: FastAPI background tasks handler
        enable_transcription: Enable audio transcription
        enable_analysis: Enable content analysis
        language: Audio language for transcription (auto, en, tr, etc.)
        current_user: Authenticated user from JWT
        db: Database session
    
    Returns:
        Processing status with estimated completion time
    
    Raises:
        HTTPException 404: If podcast not found
        HTTPException 403: If user doesn't own the podcast
        HTTPException 400: If audio file is missing
        HTTPException 429: If rate limit exceeded
    """
    # Rate limiting check
    check_rate_limit(current_user)
    
    # Get podcast from database
    podcast = db.query(models.Podcast).filter(
        models.Podcast.id == podcast_id
    ).first()
    
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Podcast #{podcast_id} not found"
        )
    
    # Check permission (owner, moderator, or admin)
    if podcast.owner_id != current_user.id and current_user.role not in ["MODERATOR", "ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to process this podcast"
        )
    
    # Check if audio file exists
    if not podcast.audio_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Podcast has no audio file"
        )
    
    remote_audio_url: Optional[str] = None
    local_audio_path: Optional[Path] = None
    if _is_remote_audio_url(podcast.audio_url):
        remote_host = urlparse(podcast.audio_url).hostname
        if not _is_allowed_remote_audio_host(remote_host):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Remote audio host is not allowed"
            )
        remote_audio_url = podcast.audio_url
    else:
        local_audio_path = _resolve_local_audio_path(podcast.audio_url)
    
    # Check if already processing
    if podcast.ai_data and podcast.ai_data.processing_status == "processing":
        return {
            "message": "Processing already in progress",
            "podcast_id": podcast_id,
            "status": "processing"
        }
    
    # Atomically mark as processing to prevent race conditions
    # This ensures no duplicate processing if multiple requests arrive simultaneously
    if not podcast.ai_data:
        ai_data = models.PodcastAIData(
            podcast_id=podcast_id,
            processing_status="processing"
        )
        db.add(ai_data)
    else:
        podcast.ai_data.processing_status = "processing"
    
    db.commit()  # Commit immediately - other requests will now see "processing" status
    
    # Create processing options
    options = ProcessingOptions(
        enable_transcription=enable_transcription,
        enable_analysis=enable_analysis,
        language=language
    )
    
    # Start processing in background
    ai_service = get_ai_service()
    
    async def process_in_background():
        """Background task for AI processing."""
        # Create new session for background task (request session will be closed)
        task_db = SessionLocal()
        temp_audio_path: Optional[Path] = None
        try:
            processing_audio_path = str(local_audio_path) if local_audio_path else None
            if remote_audio_url:
                logger.info(
                    f"Downloading remote audio for podcast #{podcast_id} before AI processing"
                )
                temp_audio_path = await _download_remote_audio_to_temp_file(remote_audio_url)
                processing_audio_path = str(temp_audio_path)

            logger.info(f"Background processing started for podcast #{podcast_id}")
            result = await ai_service.process_podcast_full(
                podcast_id=podcast_id,
                audio_path=processing_audio_path,
                db=task_db,
                options=options
            )
            logger.info(
                f"Background processing completed for podcast #{podcast_id}: "
                f"status={result.status.value}"
            )
        except Exception as e:
            logger.error(
                f"Background processing failed for podcast #{podcast_id}: {e}",
                exc_info=True
            )
            task_db.rollback()

            ai_data = task_db.query(models.PodcastAIData).filter(
                models.PodcastAIData.podcast_id == podcast_id
            ).first()
            if ai_data:
                ai_data.processing_status = "failed"
                task_db.commit()
        finally:
            if temp_audio_path:
                temp_audio_path.unlink(missing_ok=True)
            task_db.close()
    
    # Add to background tasks
    background_tasks.add_task(process_in_background)
    
    # Calculate realistic processing time estimate
    estimated_time = estimate_processing_time(
        duration_seconds=podcast.duration or 0,
        provider=settings.AI_PROVIDER,
        device=settings.WHISPER_DEVICE,
        user_is_premium=current_user.is_premium
    )
    
    # Return immediate response
    return {
        "message": "AI processing started",
        "podcast_id": podcast_id,
        "status": "processing",
        "stages": {
            "transcription": "pending" if enable_transcription else "skipped",
            "analysis": "pending" if enable_analysis else "skipped"
        },
        "estimated_time_seconds": estimated_time,
        "language": language
    }


@router.get(
    "/status/{podcast_id}",
    response_model=Dict[str, Any],
    summary="Get AI processing status",
    description="Check the current status of AI processing for a podcast."
)
async def get_processing_status(
    podcast_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the current AI processing status for a podcast.
    
    **Returns:**
    - Processing status (pending, processing, completed, failed)
    - Available results (transcription, analysis)
    - Processing date
    - Quality score (if completed)
    """
    ai_service = get_ai_service()
    status_data = await ai_service.get_processing_status(
        podcast_id=podcast_id,
        db=db
    )
    
    if status_data["status"] == "not_found":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=status_data["message"]
        )
    
    return status_data


@router.get(
    "/results/{podcast_id}",
    response_model=Dict[str, Any],
    summary="Get AI processing results",
    description="Retrieve the complete AI processing results for a podcast."
)
async def get_ai_results(
    podcast_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get complete AI processing results for a podcast.
    
    **Returns:**
    - Full transcription text
    - Extracted keywords
    - Content summary
    - Sentiment analysis
    - Suggested categories
    - Quality score
    - Processing metadata
    """
    podcast = db.query(models.Podcast).filter(
        models.Podcast.id == podcast_id
    ).first()
    
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Podcast #{podcast_id} not found"
        )
    
    if not podcast.ai_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No AI data available for this podcast"
        )
    
    ai_data = podcast.ai_data
    
    # Check if processing completed
    if ai_data.processing_status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"AI processing not completed. Status: {ai_data.processing_status}"
        )
    
    return {
        "podcast_id": podcast_id,
        "transcription": {
            "text": ai_data.transcription_text,
            "language": ai_data.transcription_language,
            "confidence": ai_data.transcription_confidence,
            "word_count": len(ai_data.transcription_text.split()) if ai_data.transcription_text else 0
        },
        "analysis": {
            "keywords": json.loads(ai_data.keywords) if ai_data.keywords else [],
            "summary": ai_data.summary,
            "sentiment": ai_data.sentiment,
            "categories": json.loads(ai_data.categories) if ai_data.categories else [],
            "quality_score": ai_data.quality_score
        },
        "metadata": {
            "processing_date": ai_data.processing_date.isoformat() if ai_data.processing_date else None,
            "status": ai_data.processing_status
        }
    }


@router.post(
    "/reprocess/{podcast_id}",
    response_model=Dict[str, Any],
    summary="Reprocess podcast with AI",
    description="Clear existing AI data and reprocess the podcast."
)
async def reprocess_podcast(
    podcast_id: int,
    background_tasks: BackgroundTasks,
    enable_transcription: bool = True,
    enable_analysis: bool = True,
    language: str = "auto",
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reprocess a podcast with new AI settings.
    
    **Warning:** This will clear existing AI data.
    
    **Rate Limits:**
    - Free users: 20 requests per hour
    - Premium users: 100 requests per hour
    
    **Parameters:**
    - **podcast_id**: ID of the podcast to reprocess
    - **enable_transcription**: Enable audio transcription
    - **enable_analysis**: Enable content analysis
    - **language**: Language code for transcription
    
    **Returns:**
    Reprocessing task details.
    
    **Raises:**
    - 404: Podcast not found
    - 403: Permission denied
    - 429: Rate limit exceeded
    """
    # Rate limiting check
    check_rate_limit(current_user)
    
    # Get podcast from database
    podcast = db.query(models.Podcast).filter(
        models.Podcast.id == podcast_id
    ).first()
    
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Podcast #{podcast_id} not found"
        )
    
    # Check permission (owner, moderator, or admin)
    if podcast.creator_id != current_user.id and current_user.role not in ["MODERATOR", "ADMIN", "SUPER_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to reprocess this podcast"
        )
    
    # Check audio file
    if not podcast.audio_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Podcast has no audio file"
        )
    
    # Construct audio path with security validation
    # Prevent path traversal attacks by ensuring resolved path stays within BACKEND_ROOT
    try:
        audio_path = settings.BACKEND_ROOT / podcast.audio_url.lstrip("/")
        audio_path = audio_path.resolve()
        
        # Security check: ensure path stays within allowed directory
        if not str(audio_path).startswith(str(settings.BACKEND_ROOT.resolve())):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid audio file path"
            )
    except (ValueError, OSError) as e:
        logger.error(f"Path resolution error for {podcast.audio_url}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid audio file path"
        )
    
    if not audio_path.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Audio file not found: {podcast.audio_url}"
        )
    
    # Create processing options
    options = ProcessingOptions(
        enable_transcription=enable_transcription,
        enable_analysis=enable_analysis,
        language=language
    )
    
    # Start reprocessing in background
    ai_service = get_ai_service()
    
    async def reprocess_in_background():
        """Background task for reprocessing."""
        # Create new session for background task (request session will be closed)
        task_db = SessionLocal()
        try:
            logger.info(f"Background reprocessing started for podcast #{podcast_id}")
            result = await ai_service.reprocess_podcast(
                podcast_id=podcast_id,
                audio_path=str(audio_path),  # Convert Path to string
                db=task_db,
                options=options
            )
            logger.info(
                f"Background reprocessing completed for podcast #{podcast_id}: "
                f"status={result.status.value}"
            )
        except Exception as e:
            logger.error(
                f"Background reprocessing failed for podcast #{podcast_id}: {e}",
                exc_info=True
            )
            task_db.rollback()
        finally:
            task_db.close()
    
    # Add to background tasks
    background_tasks.add_task(reprocess_in_background)
    
    return {
        "message": "Reprocessing started",
        "podcast_id": podcast_id,
        "status": "processing",
        "note": "Previous AI data will be replaced"
    }


@router.get(
    "/health",
    summary="Check AI service health",
    description="Check if AI services are configured and available."
)
async def check_ai_health(
    current_user: models.User = Depends(get_current_user)
):
    """
    Check AI service configuration and availability.
    
    **Requires authentication** to prevent exposing system configuration.
    
    **Returns:**
    - Service availability status
    - Configured providers
    - API key status (without revealing keys)
    """
    from app.config import settings
    
    # Only admins/moderators can see detailed configuration
    if current_user.role in ["MODERATOR", "ADMIN", "SUPER_ADMIN"]:
        return {
            "status": "healthy",
            "services": {
                "transcription": {
                    "openai": bool(settings.OPENAI_API_KEY),
                    "assemblyai": bool(settings.ASSEMBLYAI_API_KEY)
                },
                "analysis": {
                    "openai_gpt4": bool(settings.OPENAI_API_KEY)
                }
            },
            "models": {
                "transcription": settings.AI_TRANSCRIPTION_MODEL,
                "analysis": settings.AI_ANALYSIS_MODEL
            },
            "limits": {
                "max_audio_size_mb": settings.AI_MAX_AUDIO_SIZE_MB,
                "timeout_seconds": settings.AI_TIMEOUT_SECONDS
            },
            "provider": settings.AI_PROVIDER
        }
    else:
        # Regular users get minimal info
        return {
            "status": "healthy",
            "available": True
        }
