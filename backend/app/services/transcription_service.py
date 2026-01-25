"""
Transcription Service for Audio Processing.

This module provides audio transcription functionality using OpenAI Whisper API
and AssemblyAI as fallback. It handles file validation, processing, and error recovery.
"""

import os
import asyncio
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum

import httpx
from openai import AsyncOpenAI, OpenAIError
from pydub import AudioSegment

from app.config import settings


logger = logging.getLogger(__name__)


class TranscriptionProvider(str, Enum):
    """Available transcription service providers."""
    
    OPENAI = "openai"
    ASSEMBLYAI = "assemblyai"


class ProcessingStatus(str, Enum):
    """Transcription processing status states."""
    
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class TranscriptionResult:
    """
    Result of audio transcription.
    
    Attributes:
        text: Transcribed text content
        language: Detected language code (e.g., 'en', 'tr')
        confidence: Confidence score (0.0 to 1.0)
        duration: Audio duration in seconds
        provider: Service provider used
        word_count: Number of words in transcription
        metadata: Additional provider-specific data
    """
    
    text: str
    language: str
    confidence: float
    duration: float
    provider: TranscriptionProvider
    word_count: int
    metadata: Dict[str, Any]


class TranscriptionError(Exception):
    """Base exception for transcription errors."""
    pass


class AudioValidationError(TranscriptionError):
    """Raised when audio file validation fails."""
    pass


class TranscriptionService:
    """
    Service for transcribing audio files.
    
    Supports multiple providers with automatic fallback:
    1. OpenAI Whisper (primary)
    2. AssemblyAI (fallback)
    
    Example:
        service = TranscriptionService()
        result = await service.transcribe_audio("/path/to/audio.mp3")
        print(f"Transcription: {result.text}")
    """
    
    # Supported audio formats
    SUPPORTED_FORMATS = {'.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'}
    
    # Maximum file size (from config)
    MAX_FILE_SIZE_MB = settings.AI_MAX_AUDIO_SIZE_MB
    
    def __init__(self):
        """Initialize transcription service with API clients."""
        self.openai_client: Optional[AsyncOpenAI] = None
        self.assemblyai_api_key: Optional[str] = None
        
        # Initialize OpenAI client if API key is available
        if settings.OPENAI_API_KEY:
            self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            logger.info("OpenAI Whisper client initialized")
        else:
            logger.warning("OpenAI API key not configured")
        
        # Store AssemblyAI key if available
        if settings.ASSEMBLYAI_API_KEY:
            self.assemblyai_api_key = settings.ASSEMBLYAI_API_KEY
            logger.info("AssemblyAI client configured")
        else:
            logger.warning("AssemblyAI API key not configured")
    
    def validate_audio_file(self, file_path: str) -> None:
        """
        Validate audio file exists, has correct format, and size.
        
        Args:
            file_path: Path to audio file
            
        Raises:
            AudioValidationError: If validation fails
        """
        path = Path(file_path)
        
        # Check file exists
        if not path.exists():
            raise AudioValidationError(f"Audio file not found: {file_path}")
        
        # Check file extension
        if path.suffix.lower() not in self.SUPPORTED_FORMATS:
            raise AudioValidationError(
                f"Unsupported format: {path.suffix}. "
                f"Supported: {', '.join(self.SUPPORTED_FORMATS)}"
            )
        
        # Check file size
        file_size_mb = path.stat().st_size / (1024 * 1024)
        if file_size_mb > self.MAX_FILE_SIZE_MB:
            raise AudioValidationError(
                f"File too large: {file_size_mb:.1f}MB. "
                f"Maximum: {self.MAX_FILE_SIZE_MB}MB"
            )
        
        logger.info(f"Audio file validated: {path.name} ({file_size_mb:.1f}MB)")
    
    def get_audio_duration(self, file_path: str) -> float:
        """
        Get audio duration in seconds.
        
        Args:
            file_path: Path to audio file
            
        Returns:
            Duration in seconds
        """
        try:
            audio = AudioSegment.from_file(file_path)
            duration = len(audio) / 1000.0  # Convert ms to seconds
            return duration
        except Exception as e:
            logger.error(f"Failed to get audio duration: {e}")
            return 0.0
    
    async def transcribe_with_openai(
        self,
        file_path: str,
        language: str = "auto"
    ) -> TranscriptionResult:
        """
        Transcribe audio using OpenAI Whisper API.
        
        Args:
            file_path: Path to audio file
            language: Language code or 'auto' for detection
            
        Returns:
            TranscriptionResult with text and metadata
            
        Raises:
            TranscriptionError: If transcription fails
        """
        if not self.openai_client:
            raise TranscriptionError("OpenAI client not initialized")
        
        try:
            logger.info(f"Starting OpenAI Whisper transcription: {file_path}")
            
            # Open audio file
            with open(file_path, "rb") as audio_file:
                # Call Whisper API
                response = await self.openai_client.audio.transcriptions.create(
                    model=settings.AI_TRANSCRIPTION_MODEL,
                    file=audio_file,
                    language=None if language == "auto" else language,
                    response_format="verbose_json"
                )
            
            # Get audio duration
            duration = self.get_audio_duration(file_path)
            
            # Calculate word count
            word_count = len(response.text.split())
            
            # Extract metadata
            detected_language = getattr(response, 'language', 'unknown')
            
            result = TranscriptionResult(
                text=response.text,
                language=detected_language,
                confidence=0.95,  # OpenAI doesn't provide confidence, use default
                duration=duration,
                provider=TranscriptionProvider.OPENAI,
                word_count=word_count,
                metadata={
                    "model": settings.AI_TRANSCRIPTION_MODEL,
                    "duration": duration
                }
            )
            
            logger.info(
                f"OpenAI transcription completed: {word_count} words, "
                f"{duration:.1f}s audio, language: {detected_language}"
            )
            
            return result
            
        except OpenAIError as e:
            error_msg = f"OpenAI transcription failed: {str(e)}"
            logger.error(error_msg)
            raise TranscriptionError(error_msg) from e
        except Exception as e:
            error_msg = f"Unexpected error in OpenAI transcription: {str(e)}"
            logger.error(error_msg)
            raise TranscriptionError(error_msg) from e
    
    async def transcribe_with_assemblyai(
        self,
        file_path: str,
        language: str = "auto"
    ) -> TranscriptionResult:
        """
        Transcribe audio using AssemblyAI API.
        
        Args:
            file_path: Path to audio file
            language: Language code or 'auto' for detection
            
        Returns:
            TranscriptionResult with text and metadata
            
        Raises:
            TranscriptionError: If transcription fails
        """
        if not self.assemblyai_api_key:
            raise TranscriptionError("AssemblyAI API key not configured")
        
        try:
            logger.info(f"Starting AssemblyAI transcription: {file_path}")
            
            headers = {"authorization": self.assemblyai_api_key}
            base_url = "https://api.assemblyai.com/v2"
            
            async with httpx.AsyncClient(timeout=settings.AI_TIMEOUT_SECONDS) as client:
                # Upload audio file
                with open(file_path, "rb") as audio_file:
                    upload_response = await client.post(
                        f"{base_url}/upload",
                        headers=headers,
                        files={"file": audio_file}
                    )
                    upload_response.raise_for_status()
                    audio_url = upload_response.json()["upload_url"]
                
                # Request transcription
                transcript_request = {
                    "audio_url": audio_url,
                    "language_code": None if language == "auto" else language
                }
                
                transcript_response = await client.post(
                    f"{base_url}/transcript",
                    headers=headers,
                    json=transcript_request
                )
                transcript_response.raise_for_status()
                transcript_id = transcript_response.json()["id"]
                
                # Poll for completion
                while True:
                    status_response = await client.get(
                        f"{base_url}/transcript/{transcript_id}",
                        headers=headers
                    )
                    status_response.raise_for_status()
                    status_data = status_response.json()
                    
                    status = status_data["status"]
                    
                    if status == "completed":
                        # Get audio duration
                        duration = self.get_audio_duration(file_path)
                        word_count = len(status_data["text"].split())
                        
                        result = TranscriptionResult(
                            text=status_data["text"],
                            language=status_data.get("language_code", "unknown"),
                            confidence=status_data.get("confidence", 0.0),
                            duration=duration,
                            provider=TranscriptionProvider.ASSEMBLYAI,
                            word_count=word_count,
                            metadata={
                                "transcript_id": transcript_id,
                                "audio_duration": status_data.get("audio_duration")
                            }
                        )
                        
                        logger.info(
                            f"AssemblyAI transcription completed: {word_count} words"
                        )
                        
                        return result
                    
                    elif status == "error":
                        error = status_data.get("error", "Unknown error")
                        raise TranscriptionError(f"AssemblyAI error: {error}")
                    
                    # Wait before polling again
                    await asyncio.sleep(3)
        
        except httpx.HTTPError as e:
            error_msg = f"AssemblyAI HTTP error: {str(e)}"
            logger.error(error_msg)
            raise TranscriptionError(error_msg) from e
        except Exception as e:
            error_msg = f"Unexpected error in AssemblyAI transcription: {str(e)}"
            logger.error(error_msg)
            raise TranscriptionError(error_msg) from e
    
    async def transcribe_audio(
        self,
        file_path: str,
        language: str = "auto",
        provider: Optional[TranscriptionProvider] = None
    ) -> TranscriptionResult:
        """
        Transcribe audio file with automatic fallback.
        
        Tries OpenAI first, falls back to AssemblyAI if it fails.
        
        Args:
            file_path: Path to audio file
            language: Language code or 'auto' for detection
            provider: Specific provider to use, or None for auto-selection
            
        Returns:
            TranscriptionResult
            
        Raises:
            AudioValidationError: If file validation fails
            TranscriptionError: If all transcription attempts fail
        """
        # Validate audio file first
        self.validate_audio_file(file_path)
        
        # If specific provider requested
        if provider == TranscriptionProvider.OPENAI:
            return await self.transcribe_with_openai(file_path, language)
        elif provider == TranscriptionProvider.ASSEMBLYAI:
            return await self.transcribe_with_assemblyai(file_path, language)
        
        # Try OpenAI first
        if self.openai_client:
            try:
                return await self.transcribe_with_openai(file_path, language)
            except TranscriptionError as e:
                logger.warning(f"OpenAI failed, trying AssemblyAI: {e}")
        
        # Fallback to AssemblyAI
        if self.assemblyai_api_key:
            try:
                return await self.transcribe_with_assemblyai(file_path, language)
            except TranscriptionError as e:
                logger.error(f"AssemblyAI also failed: {e}")
                raise
        
        # No providers available
        raise TranscriptionError(
            "No transcription providers configured. "
            "Set OPENAI_API_KEY or ASSEMBLYAI_API_KEY in .env"
        )


# Singleton instance
_transcription_service: Optional[TranscriptionService] = None


def get_transcription_service() -> TranscriptionService:
    """
    Get singleton transcription service instance.
    
    Returns:
        TranscriptionService instance
    """
    global _transcription_service
    if _transcription_service is None:
        _transcription_service = TranscriptionService()
    return _transcription_service
