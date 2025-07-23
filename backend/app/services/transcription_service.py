import os
import asyncio
import logging
import tempfile
import json
from typing import Optional, Dict, Any, List
from pathlib import Path
import whisper
import torch
from datetime import timedelta

logger = logging.getLogger(__name__)

class TranscriptionService:
    """
    Transcription service using OpenAI Whisper for speech-to-text.
    Supports multiple languages and provides timestamps.
    """
    
    def __init__(self):
        self.model = None
        self.model_name = "base"  # Default model
        self.is_initialized = False
        self.supported_languages = [
            "tr", "en", "de", "fr", "es", "it", "pt", "ru", "ja", "ko", "zh", "ar"
        ]
        
    async def initialize(self, model_name: str = "base") -> bool:
        """
        Initialize Whisper model
        
        Args:
            model_name: Whisper model size (tiny, base, small, medium, large)
        """
        try:
            logger.info(f"Loading Whisper model: {model_name}")
            
            # Check if CUDA is available
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"Using device: {device}")
            
            # Load model
            self.model = whisper.load_model(model_name, device=device)
            self.model_name = model_name
            self.is_initialized = True
            
            logger.info(f"Whisper model {model_name} loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize transcription service: {e}")
            return False
    
    async def transcribe_audio(
        self, 
        audio_file: str, 
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Transcribe audio file to text
        
        Args:
            audio_file: Path to audio file
            options: Transcription options
            
        Returns:
            Dictionary with transcription results
        """
        if not self.is_initialized:
            await self.initialize()
            
        # Default options
        default_options = {
            "language": "auto",  # Auto-detect or specify language code
            "include_timestamps": True,
            "include_word_timestamps": False,
            "temperature": 0.0,
            "best_of": 5,
            "beam_size": 5,
            "patience": 1.0,
            "length_penalty": 1.0,
            "suppress_tokens": "-1",
            "initial_prompt": None,
            "condition_on_previous_text": True,
            "fp16": torch.cuda.is_available(),
            "compression_ratio_threshold": 2.4,
            "logprob_threshold": -1.0,
            "no_speech_threshold": 0.6
        }
        
        if options:
            default_options.update(options)
        options = default_options
        
        results = {
            "success": False,
            "text": "",
            "language": "",
            "language_probability": 0.0,
            "segments": [],
            "words": [],
            "duration": 0.0,
            "processing_time": 0,
            "model_used": self.model_name,
            "errors": []
        }
        
        try:
            input_path = Path(audio_file)
            if not input_path.exists():
                raise FileNotFoundError(f"Audio file not found: {audio_file}")
            
            logger.info(f"Starting transcription: {audio_file}")
            start_time = asyncio.get_event_loop().time()
            
            # Prepare Whisper options
            whisper_options = {
                "language": None if options["language"] == "auto" else options["language"],
                "temperature": options["temperature"],
                "best_of": options["best_of"],
                "beam_size": options["beam_size"],
                "patience": options["patience"],
                "length_penalty": options["length_penalty"],
                "suppress_tokens": options["suppress_tokens"],
                "initial_prompt": options["initial_prompt"],
                "condition_on_previous_text": options["condition_on_previous_text"],
                "fp16": options["fp16"],
                "compression_ratio_threshold": options["compression_ratio_threshold"],
                "logprob_threshold": options["logprob_threshold"],
                "no_speech_threshold": options["no_speech_threshold"],
                "word_timestamps": options["include_word_timestamps"]
            }
            
            # Remove None values
            whisper_options = {k: v for k, v in whisper_options.items() if v is not None}
            
            # Perform transcription
            result = self.model.transcribe(str(audio_file), **whisper_options)
            
            # Process results
            results["text"] = result["text"].strip()
            results["language"] = result["language"]
            results["language_probability"] = float(result.get("language_probability", 0.0))
            
            # Process segments
            if options["include_timestamps"] and "segments" in result:
                results["segments"] = await self._process_segments(result["segments"])
            
            # Process word-level timestamps
            if options["include_word_timestamps"]:
                results["words"] = await self._process_word_timestamps(result)
            
            # Calculate duration
            if result.get("segments"):
                last_segment = result["segments"][-1]
                results["duration"] = float(last_segment.get("end", 0.0))
            
            # Processing time
            end_time = asyncio.get_event_loop().time()
            results["processing_time"] = round(end_time - start_time, 2)
            
            results["success"] = True
            
            logger.info(f"Transcription completed in {results['processing_time']}s")
            logger.info(f"Detected language: {results['language']} (confidence: {results['language_probability']:.2f})")
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            results["errors"].append(str(e))
            
        return results
    
    async def _process_segments(self, segments: List[Dict]) -> List[Dict[str, Any]]:
        """Process segment data for better formatting"""
        processed_segments = []
        
        for segment in segments:
            processed_segment = {
                "id": segment.get("id", 0),
                "start": float(segment.get("start", 0.0)),
                "end": float(segment.get("end", 0.0)),
                "text": segment.get("text", "").strip(),
                "temperature": float(segment.get("temperature", 0.0)),
                "avg_logprob": float(segment.get("avg_logprob", 0.0)),
                "compression_ratio": float(segment.get("compression_ratio", 0.0)),
                "no_speech_prob": float(segment.get("no_speech_prob", 0.0)),
                "confidence": 1.0 - float(segment.get("no_speech_prob", 0.0))  # Simple confidence score
            }
            
            # Add human-readable timestamps
            processed_segment["start_time"] = self._format_timestamp(processed_segment["start"])
            processed_segment["end_time"] = self._format_timestamp(processed_segment["end"])
            processed_segment["duration"] = processed_segment["end"] - processed_segment["start"]
            
            processed_segments.append(processed_segment)
        
        return processed_segments
    
    async def _process_word_timestamps(self, result: Dict) -> List[Dict[str, Any]]:
        """Extract word-level timestamps"""
        words = []
        
        if "segments" in result:
            for segment in result["segments"]:
                if "words" in segment:
                    for word_data in segment["words"]:
                        word = {
                            "word": word_data.get("word", "").strip(),
                            "start": float(word_data.get("start", 0.0)),
                            "end": float(word_data.get("end", 0.0)),
                            "probability": float(word_data.get("probability", 0.0))
                        }
                        word["start_time"] = self._format_timestamp(word["start"])
                        word["end_time"] = self._format_timestamp(word["end"])
                        words.append(word)
        
        return words
    
    def _format_timestamp(self, seconds: float) -> str:
        """Format seconds to HH:MM:SS.mmm"""
        td = timedelta(seconds=seconds)
        hours, remainder = divmod(td.total_seconds(), 3600)
        minutes, seconds = divmod(remainder, 60)
        milliseconds = int((seconds % 1) * 1000)
        return f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}.{milliseconds:03d}"
    
    async def get_supported_languages(self) -> List[Dict[str, str]]:
        """Get list of supported languages"""
        language_names = {
            "tr": "Turkish",
            "en": "English", 
            "de": "German",
            "fr": "French",
            "es": "Spanish",
            "it": "Italian",
            "pt": "Portuguese",
            "ru": "Russian",
            "ja": "Japanese",
            "ko": "Korean",
            "zh": "Chinese",
            "ar": "Arabic"
        }
        
        return [
            {"code": code, "name": language_names.get(code, code.upper())}
            for code in self.supported_languages
        ]
    
    async def detect_language(self, audio_file: str) -> Dict[str, Any]:
        """Detect language of audio file without full transcription"""
        if not self.is_initialized:
            await self.initialize()
            
        try:
            # Load audio and pad/trim it to fit 30 seconds for detection
            audio = whisper.load_audio(audio_file)
            audio = whisper.pad_or_trim(audio)
            
            # Make log-Mel spectrogram and move to the same device as the model
            mel = whisper.log_mel_spectrogram(audio).to(self.model.device)
            
            # Detect the spoken language
            _, probs = self.model.detect_language(mel)
            detected_language = max(probs, key=probs.get)
            
            return {
                "language": detected_language,
                "probability": float(probs[detected_language]),
                "all_probabilities": {lang: float(prob) for lang, prob in probs.items()},
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Language detection failed: {e}")
            return {
                "language": "unknown",
                "probability": 0.0,
                "all_probabilities": {},
                "success": False,
                "error": str(e)
            }
    
    async def generate_subtitles(
        self, 
        transcription_result: Dict[str, Any], 
        format_type: str = "srt"
    ) -> str:
        """
        Generate subtitle file from transcription
        
        Args:
            transcription_result: Result from transcribe_audio
            format_type: Subtitle format (srt, vtt, txt)
            
        Returns:
            Subtitle content as string
        """
        if not transcription_result.get("segments"):
            raise ValueError("No segments found in transcription result")
        
        if format_type.lower() == "srt":
            return await self._generate_srt(transcription_result["segments"])
        elif format_type.lower() == "vtt":
            return await self._generate_vtt(transcription_result["segments"])
        elif format_type.lower() == "txt":
            return await self._generate_txt(transcription_result["segments"])
        else:
            raise ValueError(f"Unsupported subtitle format: {format_type}")
    
    async def _generate_srt(self, segments: List[Dict]) -> str:
        """Generate SRT format subtitles"""
        srt_content = []
        
        for i, segment in enumerate(segments, 1):
            start_time = self._format_timestamp_srt(segment["start"])
            end_time = self._format_timestamp_srt(segment["end"])
            text = segment["text"].strip()
            
            srt_content.append(f"{i}")
            srt_content.append(f"{start_time} --> {end_time}")
            srt_content.append(text)
            srt_content.append("")  # Empty line
        
        return "\n".join(srt_content)
    
    async def _generate_vtt(self, segments: List[Dict]) -> str:
        """Generate WebVTT format subtitles"""
        vtt_content = ["WEBVTT", ""]
        
        for segment in segments:
            start_time = self._format_timestamp_vtt(segment["start"])
            end_time = self._format_timestamp_vtt(segment["end"])
            text = segment["text"].strip()
            
            vtt_content.append(f"{start_time} --> {end_time}")
            vtt_content.append(text)
            vtt_content.append("")
        
        return "\n".join(vtt_content)
    
    async def _generate_txt(self, segments: List[Dict]) -> str:
        """Generate plain text with timestamps"""
        txt_content = []
        
        for segment in segments:
            start_time = self._format_timestamp(segment["start"])
            text = segment["text"].strip()
            txt_content.append(f"[{start_time}] {text}")
        
        return "\n".join(txt_content)
    
    def _format_timestamp_srt(self, seconds: float) -> str:
        """Format timestamp for SRT (HH:MM:SS,mmm)"""
        td = timedelta(seconds=seconds)
        hours, remainder = divmod(td.total_seconds(), 3600)
        minutes, seconds = divmod(remainder, 60)
        milliseconds = int((seconds % 1) * 1000)
        return f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d},{milliseconds:03d}"
    
    def _format_timestamp_vtt(self, seconds: float) -> str:
        """Format timestamp for VTT (HH:MM:SS.mmm)"""
        td = timedelta(seconds=seconds)
        hours, remainder = divmod(td.total_seconds(), 3600)
        minutes, seconds = divmod(remainder, 60)
        milliseconds = int((seconds % 1) * 1000)
        return f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}.{milliseconds:03d}"
    
    def get_status(self) -> Dict[str, Any]:
        """Get transcription service status"""
        return {
            "is_initialized": self.is_initialized,
            "model_name": self.model_name,
            "device": str(next(self.model.parameters()).device) if self.model else "none",
            "supported_languages": len(self.supported_languages),
            "cuda_available": torch.cuda.is_available()
        } 