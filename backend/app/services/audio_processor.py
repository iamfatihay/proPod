import os
import asyncio
import logging
import tempfile
from typing import Optional, Dict, Any, Tuple
from pathlib import Path
import numpy as np
import librosa
import scipy.signal
from pydub import AudioSegment
from pydub.effects import normalize, compress_dynamic_range
import ffmpeg

logger = logging.getLogger(__name__)

class AudioProcessor:
    """
    Audio processing service for quality enhancement.
    Handles noise reduction, normalization, and audio optimization.
    """
    
    def __init__(self):
        self.is_initialized = False
        self.temp_dir = None
        
    async def initialize(self) -> bool:
        """Initialize audio processor"""
        try:
            # Create temporary directory for processing
            self.temp_dir = tempfile.mkdtemp(prefix="volo_audio_")
            logger.info(f"Audio processor initialized with temp dir: {self.temp_dir}")
            self.is_initialized = True
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize audio processor: {e}")
            return False
    
    async def enhance_audio_quality(
        self, 
        input_file: str, 
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Enhance audio quality with multiple processing steps
        
        Args:
            input_file: Path to input audio file
            options: Processing options
            
        Returns:
            Dictionary with processing results
        """
        if not self.is_initialized:
            await self.initialize()
            
        # Default options
        default_options = {
            "noise_reduction": True,
            "normalize": True,
            "compress": True,
            "echo_reduction": False,
            "target_format": "mp3",
            "quality": "high",
            "sample_rate": 44100
        }
        
        if options:
            default_options.update(options)
        options = default_options
        
        results = {
            "success": False,
            "output_file": None,
            "stats": {},
            "processing_steps": [],
            "errors": []
        }
        
        try:
            input_path = Path(input_file)
            if not input_path.exists():
                raise FileNotFoundError(f"Input file not found: {input_file}")
            
            # Generate output filename
            output_filename = f"enhanced_{input_path.stem}.{options['target_format']}"
            output_file = os.path.join(self.temp_dir, output_filename)
            
            logger.info(f"Starting audio enhancement: {input_file} -> {output_file}")
            
            # Load audio
            audio_data, sample_rate = await self._load_audio(input_file, options["sample_rate"])
            results["stats"]["original_duration"] = len(audio_data) / sample_rate
            results["stats"]["original_sample_rate"] = sample_rate
            
            # Processing pipeline
            processed_audio = audio_data.copy()
            
            # Step 1: Noise Reduction
            if options["noise_reduction"]:
                logger.info("Applying noise reduction...")
                processed_audio = await self._reduce_noise(processed_audio, sample_rate)
                results["processing_steps"].append("noise_reduction")
            
            # Step 2: Echo Reduction
            if options["echo_reduction"]:
                logger.info("Applying echo reduction...")
                processed_audio = await self._reduce_echo(processed_audio, sample_rate)
                results["processing_steps"].append("echo_reduction")
            
            # Step 3: Dynamic Range Compression
            if options["compress"]:
                logger.info("Applying dynamic range compression...")
                processed_audio = await self._compress_dynamic_range(processed_audio)
                results["processing_steps"].append("compression")
            
            # Step 4: Normalization
            if options["normalize"]:
                logger.info("Applying normalization...")
                processed_audio = await self._normalize_audio(processed_audio)
                results["processing_steps"].append("normalization")
            
            # Save processed audio
            await self._save_audio(processed_audio, sample_rate, output_file, options)
            
            # Calculate final stats
            results["stats"]["processed_duration"] = len(processed_audio) / sample_rate
            results["stats"]["final_sample_rate"] = sample_rate
            results["stats"]["size_reduction"] = await self._calculate_size_reduction(input_file, output_file)
            results["stats"]["quality_score"] = await self._calculate_quality_score(processed_audio, sample_rate)
            
            results["output_file"] = output_file
            results["success"] = True
            
            logger.info(f"Audio enhancement completed successfully")
            
        except Exception as e:
            logger.error(f"Audio enhancement failed: {e}")
            results["errors"].append(str(e))
            
        return results
    
    async def _load_audio(self, file_path: str, target_sr: int) -> Tuple[np.ndarray, int]:
        """Load audio file using librosa"""
        try:
            audio, sr = librosa.load(file_path, sr=target_sr, mono=True)
            return audio, sr
        except Exception as e:
            logger.error(f"Failed to load audio: {e}")
            raise
    
    async def _reduce_noise(self, audio: np.ndarray, sample_rate: int) -> np.ndarray:
        """
        Simple noise reduction using spectral gating
        """
        try:
            # Compute power spectral density
            freqs, times, Sxx = scipy.signal.spectrogram(audio, sample_rate)
            
            # Estimate noise floor (bottom 10th percentile)
            noise_floor = np.percentile(Sxx, 10, axis=1, keepdims=True)
            
            # Create noise gate mask
            gate_threshold = noise_floor * 3  # 3x noise floor
            mask = Sxx > gate_threshold
            
            # Apply mask
            Sxx_cleaned = Sxx * mask
            
            # Reconstruct audio
            _, reconstructed = scipy.signal.istft(Sxx_cleaned, sample_rate)
            
            return reconstructed.real
            
        except Exception as e:
            logger.warning(f"Noise reduction failed, returning original: {e}")
            return audio
    
    async def _reduce_echo(self, audio: np.ndarray, sample_rate: int) -> np.ndarray:
        """
        Simple echo reduction using high-pass filtering
        """
        try:
            # Apply high-pass filter to reduce low-frequency echoes
            nyquist = sample_rate / 2
            high_cutoff = 80  # Hz
            high = high_cutoff / nyquist
            
            b, a = scipy.signal.butter(4, high, btype='high')
            filtered_audio = scipy.signal.filtfilt(b, a, audio)
            
            return filtered_audio
            
        except Exception as e:
            logger.warning(f"Echo reduction failed, returning original: {e}")
            return audio
    
    async def _compress_dynamic_range(self, audio: np.ndarray) -> np.ndarray:
        """
        Apply dynamic range compression
        """
        try:
            # Simple compression using tanh
            # Adjust gain to prevent clipping
            max_val = np.max(np.abs(audio))
            if max_val > 0:
                gain = 0.8 / max_val
                compressed = np.tanh(audio * gain * 2) * 0.8
                return compressed
            return audio
            
        except Exception as e:
            logger.warning(f"Dynamic range compression failed, returning original: {e}")
            return audio
    
    async def _normalize_audio(self, audio: np.ndarray) -> np.ndarray:
        """
        Normalize audio to optimal levels
        """
        try:
            # Peak normalization to -3dB
            target_peak = 0.7  # -3dB approximately
            current_peak = np.max(np.abs(audio))
            
            if current_peak > 0:
                gain = target_peak / current_peak
                normalized = audio * gain
                return normalized
            
            return audio
            
        except Exception as e:
            logger.warning(f"Normalization failed, returning original: {e}")
            return audio
    
    async def _save_audio(
        self, 
        audio: np.ndarray, 
        sample_rate: int, 
        output_file: str, 
        options: Dict[str, Any]
    ):
        """Save processed audio to file"""
        try:
            # Convert to 16-bit PCM
            audio_int16 = (audio * 32767).astype(np.int16)
            
            # Create AudioSegment
            audio_segment = AudioSegment(
                audio_int16.tobytes(),
                frame_rate=sample_rate,
                sample_width=2,  # 16-bit
                channels=1  # mono
            )
            
            # Export with format-specific settings
            export_params = {
                "format": options["target_format"],
                "parameters": []
            }
            
            if options["target_format"] == "mp3":
                # High quality MP3 settings
                if options["quality"] == "high":
                    export_params["parameters"] = ["-q:a", "2"]  # High quality
                else:
                    export_params["parameters"] = ["-q:a", "4"]  # Standard quality
            
            audio_segment.export(output_file, **export_params)
            
        except Exception as e:
            logger.error(f"Failed to save audio: {e}")
            raise
    
    async def _calculate_size_reduction(self, input_file: str, output_file: str) -> float:
        """Calculate file size reduction percentage"""
        try:
            input_size = os.path.getsize(input_file)
            output_size = os.path.getsize(output_file)
            reduction = (1 - output_size / input_size) * 100
            return round(reduction, 2)
        except:
            return 0.0
    
    async def _calculate_quality_score(self, audio: np.ndarray, sample_rate: int) -> float:
        """Calculate a simple quality score based on audio characteristics"""
        try:
            # Calculate RMS energy
            rms = np.sqrt(np.mean(audio**2))
            
            # Calculate signal-to-noise ratio (simplified)
            noise_floor = np.percentile(np.abs(audio), 10)
            signal_level = np.percentile(np.abs(audio), 90)
            snr = 20 * np.log10(signal_level / (noise_floor + 1e-10))
            
            # Calculate dynamic range
            dynamic_range = 20 * np.log10(np.max(np.abs(audio)) / (np.mean(np.abs(audio)) + 1e-10))
            
            # Combine metrics (0-100 scale)
            quality_score = min(100, max(0, (snr * 2 + dynamic_range + rms * 100) / 4))
            
            return round(quality_score, 2)
            
        except:
            return 50.0  # Default score
    
    def get_status(self) -> Dict[str, Any]:
        """Get audio processor status"""
        return {
            "is_initialized": self.is_initialized,
            "temp_dir": self.temp_dir,
            "available_formats": ["mp3", "wav", "m4a", "ogg"]
        }
    
    def cleanup(self):
        """Clean up temporary files"""
        try:
            if self.temp_dir and os.path.exists(self.temp_dir):
                import shutil
                shutil.rmtree(self.temp_dir)
                logger.info("Audio processor cleanup completed")
        except Exception as e:
            logger.warning(f"Cleanup failed: {e}") 