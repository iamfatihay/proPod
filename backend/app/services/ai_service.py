"""
AI Service Coordinator.

This module coordinates all AI operations for podcast processing:
- Transcription
- Content analysis
- Status tracking
- Error recovery
"""

import logging
import json
from datetime import datetime
from typing import Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.orm import Session

from app.services.transcription_service import (
    get_transcription_service,
    TranscriptionResult,
    TranscriptionError,
    AudioValidationError
)
from app.services.content_analyzer import (
    get_content_analyzer,
    AnalysisResult
)
from app import models


logger = logging.getLogger(__name__)


class ProcessingStage(str, Enum):
    """Stages of AI processing."""
    
    PENDING = "pending"
    TRANSCRIBING = "transcribing"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class ProcessingOptions:
    """
    Options for AI processing.
    
    Attributes:
        enable_transcription: Whether to transcribe audio
        enable_analysis: Whether to analyze content
        language: Language code for transcription ('auto' for detection)
        keyword_count: Number of keywords to extract
        summary_length: Summary length ('short', 'medium', 'long')
    """
    
    enable_transcription: bool = True
    enable_analysis: bool = True
    language: str = "auto"
    keyword_count: int = 10
    summary_length: str = "medium"


@dataclass
class ProcessingResult:
    """
    Result of complete AI processing.
    
    Attributes:
        podcast_id: ID of processed podcast
        status: Processing status
        stage: Current processing stage
        transcription: Transcription result (if completed)
        analysis: Analysis result (if completed)
        error: Error message (if failed)
        started_at: Processing start time
        completed_at: Processing completion time
        processing_time: Total processing time in seconds
    """
    
    podcast_id: int
    status: ProcessingStage
    stage: ProcessingStage
    transcription: Optional[TranscriptionResult] = None
    analysis: Optional[AnalysisResult] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    processing_time: Optional[float] = None


class AIService:
    """
    Coordinator service for all AI operations.
    
    Manages the complete AI processing pipeline:
    1. Audio transcription
    2. Content analysis
    3. Database updates
    4. Status tracking
    
    Example:
        service = AIService()
        result = await service.process_podcast_full(
            podcast_id=123,
            audio_path="/path/to/audio.mp3",
            options=ProcessingOptions(enable_transcription=True)
        )
    """
    
    def __init__(self):
        """Initialize AI service coordinator."""
        self.transcription_service = get_transcription_service()
        self.content_analyzer = get_content_analyzer()
        logger.info("AI Service Coordinator initialized")
    
    @staticmethod
    def _serialize_to_json(data: Optional[list]) -> Optional[str]:
        """Serialize list to JSON string with error handling."""
        if not data:
            return None
        try:
            return json.dumps(data)
        except (TypeError, ValueError) as e:
            logger.warning(f"JSON serialization failed: {e}")
            return None
    
    async def process_podcast_full(
        self,
        podcast_id: int,
        audio_path: str,
        db: Session,
        options: Optional[ProcessingOptions] = None
    ) -> ProcessingResult:
        """
        Execute complete AI processing pipeline for a podcast.
        
        Steps:
        1. Validate podcast and audio file
        2. Transcribe audio (if enabled)
        3. Analyze content (if enabled)
        4. Save results to database
        5. Return processing result
        
        Args:
            podcast_id: Database ID of podcast
            audio_path: Path to audio file
            db: Database session
            options: Processing options
            
        Returns:
            ProcessingResult with all data
        """
        options = options or ProcessingOptions()
        started_at = datetime.utcnow()
        
        result = ProcessingResult(
            podcast_id=podcast_id,
            status=ProcessingStage.PENDING,
            stage=ProcessingStage.PENDING,
            started_at=started_at
        )
        
        try:
            logger.info(f"Starting AI processing for podcast #{podcast_id}")
            
            # Get podcast from database
            podcast = db.query(models.Podcast).filter(
                models.Podcast.id == podcast_id
            ).first()
            
            if not podcast:
                raise ValueError(f"Podcast #{podcast_id} not found")
            
            # Status is already set to "processing" by the endpoint (atomic operation)
            # No need to set it here again - just verify ai_data exists
            if not podcast.ai_data:
                raise ValueError(f"AI data not initialized for podcast #{podcast_id}")
            
            # Stage 1: Transcription
            transcription_result = None
            if options.enable_transcription:
                result.status = ProcessingStage.TRANSCRIBING
                result.stage = ProcessingStage.TRANSCRIBING
                
                logger.info(f"Transcribing podcast #{podcast_id}")
                
                try:
                    transcription_result = await self.transcription_service.transcribe_audio(
                        file_path=audio_path,
                        language=options.language
                    )
                    
                    result.transcription = transcription_result
                    
                    # Save transcription to database
                    podcast.ai_data.transcription_text = transcription_result.text
                    podcast.ai_data.transcription_language = transcription_result.language
                    podcast.ai_data.transcription_confidence = transcription_result.confidence
                    db.commit()
                    
                    logger.info(
                        f"Transcription completed for podcast #{podcast_id}: "
                        f"{transcription_result.word_count} words"
                    )
                    
                except (TranscriptionError, AudioValidationError) as e:
                    error_msg = f"Transcription failed: {str(e)}"
                    logger.error(error_msg)
                    result.error = error_msg
                    result.status = ProcessingStage.FAILED
                    
                    podcast.ai_data.processing_status = "failed"
                    db.commit()
                    
                    return result
            
            # Stage 2: Content Analysis
            analysis_result = None
            if options.enable_analysis and transcription_result:
                result.status = ProcessingStage.ANALYZING
                result.stage = ProcessingStage.ANALYZING
                
                logger.info(f"Analyzing content for podcast #{podcast_id}")
                
                try:
                    analysis_options = {
                        "keyword_count": options.keyword_count,
                        "summary_length": options.summary_length,
                        "confidence": transcription_result.confidence,
                        "duration": transcription_result.duration
                    }
                    
                    analysis_result = await self.content_analyzer.analyze_content(
                        text=transcription_result.text,
                        options=analysis_options
                    )
                    
                    result.analysis = analysis_result
                    
                    # Save analysis to database (serialize lists to JSON strings)
                    podcast.ai_data.keywords = self._serialize_to_json(analysis_result.keywords)
                    podcast.ai_data.summary = analysis_result.summary
                    podcast.ai_data.sentiment = analysis_result.sentiment.value
                    podcast.ai_data.categories = self._serialize_to_json(analysis_result.categories)
                    podcast.ai_data.quality_score = analysis_result.quality_score
                    db.commit()
                    
                    logger.info(
                        f"Analysis completed for podcast #{podcast_id}: "
                        f"score {analysis_result.quality_score:.1f}/10"
                    )
                    
                except ContentAnalysisError as e:
                    error_msg = f"Content analysis failed: {str(e)}"
                    logger.error(error_msg)
                    # Don't fail completely, transcription is still saved
                    result.error = error_msg
            
            # Mark as completed
            result.status = ProcessingStage.COMPLETED
            result.stage = ProcessingStage.COMPLETED
            result.completed_at = datetime.utcnow()
            result.processing_time = (
                result.completed_at - result.started_at
            ).total_seconds()
            
            podcast.ai_data.processing_status = "completed"
            podcast.ai_data.processing_date = result.completed_at
            db.commit()
            
            logger.info(
                f"AI processing completed for podcast #{podcast_id} "
                f"in {result.processing_time:.1f}s"
            )
            
            return result
            
        except Exception as e:
            error_msg = f"AI processing failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
            
            result.status = ProcessingStage.FAILED
            result.stage = ProcessingStage.FAILED
            result.error = error_msg
            result.completed_at = datetime.utcnow()
            
            # Update database
            if 'podcast' in locals() and podcast and podcast.ai_data:
                podcast.ai_data.processing_status = "failed"
                db.commit()
            
            return result
    
    async def get_processing_status(
        self,
        podcast_id: int,
        db: Session
    ) -> Dict[str, Any]:
        """
        Get current processing status for a podcast.
        
        Args:
            podcast_id: Database ID of podcast
            db: Database session
            
        Returns:
            Status dictionary
        """
        podcast = db.query(models.Podcast).filter(
            models.Podcast.id == podcast_id
        ).first()
        
        if not podcast or not podcast.ai_data:
            return {
                "podcast_id": podcast_id,
                "status": "not_found",
                "message": "Podcast or AI data not found"
            }
        
        ai_data = podcast.ai_data
        
        return {
            "podcast_id": podcast_id,
            "status": ai_data.processing_status,
            "has_transcription": bool(ai_data.transcription_text),
            "has_analysis": bool(ai_data.summary),
            "quality_score": ai_data.quality_score,
            "processing_date": ai_data.processing_date.isoformat() if ai_data.processing_date else None,
            "language": ai_data.transcription_language
        }
    
    async def reprocess_podcast(
        self,
        podcast_id: int,
        audio_path: str,
        db: Session,
        options: Optional[ProcessingOptions] = None
    ) -> ProcessingResult:
        """
        Reprocess podcast with new options.
        
        Clears existing AI data and processes again.
        
        Args:
            podcast_id: Database ID of podcast
            audio_path: Path to audio file
            db: Database session
            options: New processing options
            
        Returns:
            ProcessingResult
        """
        logger.info(f"Reprocessing podcast #{podcast_id}")
        
        # Clear existing AI data
        podcast = db.query(models.Podcast).filter(
            models.Podcast.id == podcast_id
        ).first()
        
        if podcast and podcast.ai_data:
            ai_data = podcast.ai_data
            ai_data.transcription_text = None
            ai_data.transcription_language = None
            ai_data.transcription_confidence = None
            ai_data.keywords = None
            ai_data.summary = None
            ai_data.sentiment = None
            ai_data.categories = None
            ai_data.quality_score = None
            ai_data.processing_status = "pending"
            ai_data.processing_date = None
            db.commit()
        
        # Process with new options
        return await self.process_podcast_full(
            podcast_id=podcast_id,
            audio_path=audio_path,
            db=db,
            options=options
        )


# Singleton instance
_ai_service: Optional[AIService] = None


def get_ai_service() -> AIService:
    """
    Get singleton AI service instance.
    
    Returns:
        AIService instance
    """
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
