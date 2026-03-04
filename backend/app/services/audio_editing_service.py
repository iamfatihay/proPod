"""Audio editing service for post-recording processing.

Provides FFmpeg-based audio operations: silence detection/trimming,
filler-word removal from transcripts, and time-based chapter generation.

Current limitations (FFmpeg-based approach):
- English-only filler words
- Regex-based detection (not context-aware)
- No Whisper word-timestamp integration

Future: transcript-based filler removal with Faster-Whisper word timestamps,
Turkish + English support, and AI-powered context-aware detection.
"""
import os
import subprocess
from typing import List, Tuple, Optional
from pathlib import Path
import re


class AudioEditingService:
    """FFmpeg-based audio editing operations."""

    FILLER_WORDS_EN = [
        r'\buh\b', r'\bum\b', r'\blike\b', r'\byou know\b',
        r'\bactually\b', r'\bbasically\b', r'\bI mean\b',
    ]

    def detect_silence(self, audio_path: str, threshold_db: int = -40, min_duration: float = 0.5) -> List[Tuple[float, float]]:
        """Detect silence segments in audio using ffmpeg.

        Returns list of (start, end) tuples in seconds.
        Falls back to empty list on parse errors to avoid crashing callers.
        """
        cmd = [
            'ffmpeg',
            '-i', audio_path,
            '-af', f'silencedetect=noise={threshold_db}dB:d={min_duration}',
            '-f', 'null',
            '-'
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        # FFmpeg writes silencedetect output to stderr
        output = result.stderr + result.stdout

        silence_starts = re.findall(r'silence_start:\s*([\d.]+)', output)
        silence_ends = re.findall(r'silence_end:\s*([\d.]+)', output)

        # Guard against mismatched counts (truncated output, version differences)
        pairs = min(len(silence_starts), len(silence_ends))
        silences = [
            (float(silence_starts[i]), float(silence_ends[i]))
            for i in range(pairs)
        ]

        return silences

    def trim_silence(self, audio_path: str, output_path: str, leading: bool = True, trailing: bool = True) -> str:
        """Remove leading and/or trailing silence."""
        silences = self.detect_silence(audio_path)

        if not silences:
            subprocess.run(['cp', audio_path, output_path], check=True)
            return output_path

        trim_start = 0.0
        trim_end = None

        if leading and silences:
            trim_start = silences[0][1] if silences[0][0] < 1.0 else 0.0

        if trailing and silences:
            last_silence = silences[-1]
            duration = self._get_audio_duration(audio_path)
            if duration - last_silence[0] < 2.0:
                trim_end = last_silence[0]

        cmd = ['ffmpeg', '-i', audio_path]

        if trim_start > 0:
            cmd.extend(['-ss', str(trim_start)])

        if trim_end:
            cmd.extend(['-to', str(trim_end)])

        cmd.extend(['-c', 'copy', output_path])

        subprocess.run(cmd, check=True)
        return output_path

    def remove_filler_words_from_transcript(self, transcript: str) -> str:
        """Remove common filler words from transcript."""
        cleaned = transcript

        for pattern in self.FILLER_WORDS_EN:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)

        cleaned = re.sub(r'\s+', ' ', cleaned).strip()

        return cleaned

    def generate_chapters(self, transcript: str, segment_duration: int = 300) -> List[dict]:
        """Auto-generate time-based chapters from transcript.

        Splits the word list into equal-duration segments and uses the
        first 15 words of each segment as the chapter title.
        """
        words = transcript.split()
        if not words:
            return []

        # Estimate total duration from character count (~5 chars/sec average speech rate)
        estimated_total_seconds = len(transcript) / 5
        num_segments = max(1, int(estimated_total_seconds / segment_duration))
        words_per_segment = max(1, len(words) // num_segments)

        chapters = []
        for chapter_idx, i in enumerate(range(0, len(words), words_per_segment)):
            segment_words = words[i:i + words_per_segment]
            first_sentence = ' '.join(segment_words[:15])

            chapters.append({
                'start_time': chapter_idx * segment_duration,
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
        """Apply smart editing: trim silence from leading and trailing edges."""
        self.trim_silence(audio_path, output_path, leading=True, trailing=True)

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
