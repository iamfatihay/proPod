import os
import asyncio
from typing import Optional, Dict, Any, Tuple
from pathlib import Path
import logging
from .audio_processor import AudioProcessor
from .transcription_service import TranscriptionService
from .content_analyzer import ContentAnalyzer

logger = logging.getLogger(__name__)

class AIService:
    """
    Main AI service coordinator for Volo podcast app.
    Handles audio processing, transcription, and content analysis.
    """
    
    def __init__(self):
        self.audio_processor = AudioProcessor()
        self.transcription_service = TranscriptionService()
        self.content_analyzer = ContentAnalyzer()
        self.is_initialized = False
        
    async def initialize(self) -> bool:
        """Initialize all AI services"""
        try:
            # Initialize sub-services
            await self.audio_processor.initialize()
            await self.transcription_service.initialize()
            await self.content_analyzer.initialize()
            
            self.is_initialized = True
            logger.info("AI Service initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize AI Service: {e}")
            return False
    
    async def process_podcast_audio(
        self, 
        audio_file_path: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Complete AI processing pipeline for podcast audio
        
        Args:
            audio_file_path: Path to the audio file
            options: Processing options
            
        Returns:
            Dictionary with processing results
        """
        if not self.is_initialized:
            await self.initialize()
            
        results = {
            "original_file": audio_file_path,
            "processed_file": None,
            "transcription": None,
            "analysis": None,
            "processing_time": 0,
            "success": False,
            "errors": []
        }
        
        try:
            logger.info(f"Starting AI processing for: {audio_file_path}")
            start_time = asyncio.get_event_loop().time()
            
            # Step 1: Audio Quality Enhancement
            if options and options.get("enhance_audio", True):
                logger.info("Processing audio quality enhancement...")
                enhanced_audio = await self.audio_processor.enhance_audio_quality(
                    audio_file_path, 
                    options.get("audio_options", {})
                )
                results["processed_file"] = enhanced_audio["output_file"]
                results["audio_stats"] = enhanced_audio["stats"]
            
            # Step 2: Transcription
            if options and options.get("transcribe", True):
                logger.info("Processing transcription...")
                audio_for_transcription = results["processed_file"] or audio_file_path
                transcription = await self.transcription_service.transcribe_audio(
                    audio_for_transcription,
                    options.get("transcription_options", {})
                )
                results["transcription"] = transcription
            
            # Step 3: Content Analysis
            if options and options.get("analyze_content", True) and results["transcription"]:
                logger.info("Processing content analysis...")
                analysis = await self.content_analyzer.analyze_content(
                    results["transcription"]["text"],
                    options.get("analysis_options", {})
                )
                results["analysis"] = analysis
            
            # Calculate processing time
            end_time = asyncio.get_event_loop().time()
            results["processing_time"] = round(end_time - start_time, 2)
            results["success"] = True
            
            logger.info(f"AI processing completed in {results['processing_time']}s")
            
        except Exception as e:
            logger.error(f"AI processing failed: {e}")
            results["errors"].append(str(e))
            results["success"] = False
            
        return results
    
    async def enhance_audio_only(
        self, 
        audio_file_path: str, 
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Enhanced audio quality only"""
        if not self.is_initialized:
            await self.initialize()
            
        return await self.audio_processor.enhance_audio_quality(
            audio_file_path, 
            options or {}
        )
    
    async def transcribe_only(
        self, 
        audio_file_path: str, 
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Transcription only"""
        if not self.is_initialized:
            await self.initialize()
            
        return await self.transcription_service.transcribe_audio(
            audio_file_path, 
            options or {}
        )
    
    async def analyze_text_only(
        self, 
        text: str, 
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Content analysis only"""
        if not self.is_initialized:
            await self.initialize()
            
        return await self.content_analyzer.analyze_content(
            text, 
            options or {}
        )
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get status of all AI services"""
        return {
            "is_initialized": self.is_initialized,
            "audio_processor": self.audio_processor.get_status(),
            "transcription_service": self.transcription_service.get_status(),
            "content_analyzer": self.content_analyzer.get_status()
        }

# Global AI service instance
ai_service = AIService() 