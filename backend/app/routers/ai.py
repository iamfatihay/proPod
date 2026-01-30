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
import os
import json
import logging

from app.database import get_db, SessionLocal
from app.auth import get_current_user
from app import models, schemas
from app.config import settings
from app.services.ai_service import (
    get_ai_service,
    ProcessingOptions,
    ProcessingStage
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["AI Processing"])


# Get backend root directory (where manage.py or main.py lives)
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


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
    
    **Parameters:**
    - **podcast_id**: ID of the podcast to process
    - **enable_transcription**: Enable audio transcription (default: true)
    - **enable_analysis**: Enable content analysis (default: true)
    - **language**: Language code ('auto', 'en', 'tr', etc.)
    
    **Returns:**
    Processing task details and estimated time.
    """
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
            detail="Not authorized to process this podcast"
        )
    
    # Check if audio file exists
    if not podcast.audio_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Podcast has no audio file"
        )
    
    # Construct audio file path using config-driven approach
    # podcast.audio_url format: "/media/audio/filename.mp3"
    audio_path = os.path.join(
        BACKEND_ROOT,
        podcast.audio_url.lstrip("/")
    )
    audio_path = os.path.abspath(audio_path)
    
    if not os.path.exists(audio_path):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Audio file not found: {podcast.audio_url}"
        )
    
    # Check if already processing
    if podcast.ai_data and podcast.ai_data.processing_status == "processing":
        return {
            "message": "Processing already in progress",
            "podcast_id": podcast_id,
            "status": "processing"
        }
    
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
        try:
            logger.info(f"Background processing started for podcast #{podcast_id}")
            result = await ai_service.process_podcast_full(
                podcast_id=podcast_id,
                audio_path=audio_path,
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
        finally:
            task_db.close()
    
    # Add to background tasks
    background_tasks.add_task(process_in_background)
    
    # Return immediate response
    return {
        "message": "AI processing started",
        "podcast_id": podcast_id,
        "status": "processing",
        "stages": {
            "transcription": "pending" if enable_transcription else "skipped",
            "analysis": "pending" if enable_analysis else "skipped"
        },
        "estimated_time_seconds": 60,  # Rough estimate
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
    
    **Parameters:**
    - **podcast_id**: ID of the podcast to reprocess
    - **enable_transcription**: Enable audio transcription
    - **enable_analysis**: Enable content analysis
    - **language**: Language code for transcription
    
    **Returns:**
    Reprocessing task details.
    """
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
    
    # Construct audio path using config-driven approach
    audio_path = os.path.join(
        BACKEND_ROOT,
        podcast.audio_url.lstrip("/")
    )
    audio_path = os.path.abspath(audio_path)
    
    if not os.path.exists(audio_path):
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
                audio_path=audio_path,
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
async def check_ai_health():
    """
    Check AI service configuration and availability.
    
    **Returns:**
    - Service availability status
    - Configured providers
    - API key status (without revealing keys)
    """
    from app.config import settings
    
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
        }
    }
