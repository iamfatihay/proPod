"""Audio editing service for post-recording processing."""
import os
import subprocess
from typing import List, Tuple, Optional
from pathlib import Path
import re


class AudioEditingService:
    """AI-powered audio editing operations."""
    
    FILLER_WORDS_EN = [
        r'\buh\b', r'\bum\b', r'\blike\b', r'\byou know\b',
        r'\bactually\b', r'\bbasically\b', r'\bI mean\b',
    ]
    
    def detect_silence(self, audio_path: str, threshold_db: int = -40, min_duration: float = 0.5) -> List[Tuple[float, float]]:
        """Detect silence segments in audio using ffmpeg."""
        cmd = [
            'ffmpeg',
            '-i', audio_path,
            '-af', f'silencedetect=noise={threshold_db}dB:d={min_duration}',
            '-f', 'null',
            '-'
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, stderr=subprocess.STDOUT)
        
        # Parse silence periods from ffmpeg output
        silence_starts = re.findall(r'silence_start: ([\d.]+)', result.stdout)
        silence_ends = re.findall(r'silence_end: ([\d.]+)', result.stdout)
        
        silences = list(zip(
            [float(s) for s in silence_starts],
            [float(e) for e in silence_ends]
        ))
        
        return silences
    
    def trim_silence(self, audio_path: str, output_path: str, leading: bool = True, trailing: bool = True) -> str:
        """Remove leading and/or trailing silence."""
        silences = self.detect_silence(audio_path)
        
        if not silences:
            # No silence detected, copy file
            subprocess.run(['cp', audio_path, output_path], check=True)
            return output_path
        
        trim_start = 0.0
        trim_end = None  # None = until end
        
        if leading and silences:
            # Find first non-silence
            trim_start = silences[0][1] if silences[0][0] < 1.0 else 0.0
        
        if trailing and silences:
            # Find last silence
            last_silence = silences[-1]
            # Get audio duration
            duration = self._get_audio_duration(audio_path)
            if duration - last_silence[0] < 2.0:  # Last 2 seconds
                trim_end = last_silence[0]
        
        # Build ffmpeg trim command
        cmd = ['ffmpeg', '-i', audio_path]
        
        if trim_start > 0:
            cmd.extend(['-ss', str(trim_start)])
        
        if trim_end:
            cmd.extend(['-to', str(trim_end)])
        
        cmd.extend([
            '-c', 'copy',  # Copy codec (no re-encoding)
            output_path
        ])
        
        subprocess.run(cmd, check=True)
        return output_path
    
    def remove_filler_words_from_transcript(self, transcript: str) -> str:
        """Remove common filler words from transcript."""
        cleaned = transcript
        
        for pattern in self.FILLER_WORDS_EN:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
        
        # Clean up extra spaces
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        
        return cleaned
    
    def generate_chapters(self, transcript: str, segment_duration: int = 300) -> List[dict]:
        """Auto-generate chapters from transcript using AI."""
        # TODO: Use AI to detect topic changes
        # For now, simple time-based segmentation
        
        words = transcript.split()
        words_per_segment = len(words) // (len(transcript) // (segment_duration * 5))  # ~5 chars/sec
        
        chapters = []
        for i in range(0, len(words), words_per_segment):
            segment_words = words[i:i + words_per_segment]
            first_sentence = ' '.join(segment_words[:15])  # First ~15 words
            
            chapters.append({
                'start_time': i * segment_duration // len(words),
                'title': first_sentence[:50] + '...',
                'duration': segment_duration,
            })
        
        return chapters
    
    def _get_audio_duration(self, audio_path: str) -> float:
        """Get audio duration in seconds."""
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            audio_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return float(result.stdout.strip())
    
    def apply_smart_edit(self, audio_path: str, output_path: str) -> dict:
        """Apply AI-powered smart editing (trim + enhance)."""
        # 1. Trim silence
        self.trim_silence(audio_path, output_path, leading=True, trailing=True)
        
        # 2. Optional: Normalize audio levels
        # 3. Optional: Remove background noise
        # 4. Optional: Enhance speech clarity
        
        original_duration = self._get_audio_duration(audio_path)
        edited_duration = self._get_audio_duration(output_path)
        
        return {
            'original_duration': original_duration,
            'edited_duration': edited_duration,
            'time_saved': original_duration - edited_duration,
            'output_path': output_path,
        }


# Singleton
audio_editing_service = AudioEditingService()
