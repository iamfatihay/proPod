"""
Local Whisper Transcription Service.

This module provides FREE audio transcription using local Whisper models.
No API keys or costs required - runs entirely on your machine.
"""

import os
import logging
import time
from pathlib import Path
from typing import Optional, Dict, Any

from app.config import settings

logger = logging.getLogger(__name__)


class LocalWhisperService:
    """
    Local Whisper transcription service using whisper library.
    
    Advantages:
    - 100% FREE - no API costs
    - Works offline
    - Privacy - audio stays local
    
    Requirements:
    - pip install openai-whisper
    - ffmpeg installed
    - Optional: GPU for faster processing
    """
    
    def __init__(self):
        """Initialize local Whisper service."""
        self.model = None
        self.model_size = settings.WHISPER_MODEL_SIZE
        self.device = settings.WHISPER_DEVICE
        
        logger.info(
            f"🎙️ Local Whisper initialized with model='{self.model_size}', device='{self.device}'"
        )
    
    def _load_model(self):
        """Lazy load Whisper model on first use."""
        if self.model is not None:
            return
        
        try:
            import whisper
            
            logger.info(f"📥 Loading Whisper model '{self.model_size}'...")
            start_time = time.time()
            
            self.model = whisper.load_model(
                self.model_size,
                device=self.device
            )
            
            load_time = time.time() - start_time
            logger.info(f"✅ Model loaded in {load_time:.2f}s")
            
        except ImportError:
            raise ImportError(
                "openai-whisper not installed. Run: pip install openai-whisper"
            )
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise
    
    async def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcribe audio file using local Whisper model.
        
        Args:
            audio_path: Path to audio file
            language: Language code (e.g., 'en', 'tr') or None for auto-detect
        
        Returns:
            Dict with transcription results:
            {
                "text": "transcribed text",
                "language": "en",
                "duration": 125.5,
                "segments": [...],
                "word_count": 250
            }
        
        Raises:
            FileNotFoundError: If audio file doesn't exist
            Exception: If transcription fails
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        # Load model on first use
        self._load_model()
        
        logger.info(f"🎵 Transcribing: {Path(audio_path).name}")
        start_time = time.time()
        
        try:
            # Run transcription (CPU-bound, so use asyncio to prevent blocking)
            import asyncio
            result = await asyncio.to_thread(
                self.model.transcribe,
                audio_path,
                language=language,
                task="transcribe",
                verbose=False
            )
            
            duration = time.time() - start_time
            text = result["text"].strip()
            word_count = len(text.split())
            
            logger.info(
                f"✅ Transcription complete in {duration:.2f}s "
                f"({word_count} words, language: {result['language']})"
            )
            
            return {
                "text": text,
                "language": result["language"],
                "duration": result.get("duration", 0),
                "segments": result.get("segments", []),
                "word_count": word_count,
                "processing_time": duration
            }
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise Exception(f"Whisper transcription error: {str(e)}")
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about loaded model.
        
        Returns:
            Dict with model details
        """
        return {
            "provider": "local_whisper",
            "model_size": self.model_size,
            "device": self.device,
            "loaded": self.model is not None,
            "cost": "FREE",
            "privacy": "100% local - audio never leaves your machine"
        }


# Singleton instance
_local_whisper_service: Optional[LocalWhisperService] = None


def get_local_whisper_service() -> LocalWhisperService:
    """Get or create singleton LocalWhisperService instance."""
    global _local_whisper_service
    
    if _local_whisper_service is None:
        _local_whisper_service = LocalWhisperService()
    
    return _local_whisper_service
