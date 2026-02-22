# AI Optimization Implementation Roadmap

**Project**: ProPod AI Backend Optimization  
**Goal**: 4x faster transcription, better filler removal, $0 cost  
**Status**: Ready to Implement  
**Date**: February 22, 2026

---

## Overview

This roadmap outlines concrete implementation steps to optimize ProPod's AI backend from `openai-whisper` to `faster-whisper`, add word-level timestamp support, and rewrite audio editing with AI-first approach. All changes are **backward compatible** and can be implemented incrementally.

**Expected Benefits:**
- ⚡ 4x faster transcription (30min podcast: 15min → 3-5min)
- 🌍 Turkish + English filler word support (currently English-only)
- 🎯 Context-aware editing (transcript-based, not regex)
- 💰 $0 cost (Faster-Whisper is free, open-source)

---

## Phase 1: Faster-Whisper Integration (Priority: HIGH)

### ✅ Task 1.1: Update Dependencies

**File**: `backend/requirements.txt`

**Changes:**
```diff
- openai-whisper==20231117
+ faster-whisper==1.1.0
+ ctranslate2==4.5.0
```

**Why**: Faster-Whisper uses CTranslate2 for optimized inference (4x speed, same quality)

**Commands:**
```bash
cd backend
source venv/bin/activate
pip uninstall -y openai-whisper
pip install faster-whisper==1.1.0 ctranslate2==4.5.0
pip freeze > requirements.txt
```

**Estimated Time**: 5 minutes  
**Risk**: Low (API similar to openai-whisper)

---

### ✅ Task 1.2: Add Configuration for Filler Words

**File**: `backend/app/config.py`

**Add After Line ~80** (after `AI_TIMEOUT_SECONDS`):
```python
# Filler Words for Transcript Cleaning
FILLER_WORDS_TR: list[str] = [
    "şey", "yani", "işte", "hani", "falan", "filan", 
    "ee", "ıı", "aa", "hmm", "öyle"
]

FILLER_WORDS_EN: list[str] = [
    "um", "uh", "like", "you know", "actually", "basically",
    "I mean", "so", "well", "kind of", "sort of", "right"
]

FILLER_WORDS_ALL: list[str] = FILLER_WORDS_TR + FILLER_WORDS_EN
```

**Why**: Centralized filler word dictionary for Turkish + English support

**Estimated Time**: 2 minutes  
**Risk**: None

---

### ✅ Task 1.3: Create Faster-Whisper Service

**File**: `backend/app/services/faster_whisper_service.py` (NEW)

**Create New File** with content:
```python
"""Faster-Whisper service for optimized transcription."""
import asyncio
import os
from pathlib import Path
from typing import Optional, Dict, Any, List
from faster_whisper import WhisperModel
from app.config import settings


class FasterWhisperService:
    """Faster-Whisper transcription service (4x faster than openai-whisper)."""
    
    _model: Optional[WhisperModel] = None
    
    @classmethod
    def get_model(cls) -> WhisperModel:
        """Lazy-load Faster-Whisper model."""
        if cls._model is None:
            model_size = settings.WHISPER_MODEL_SIZE  # base, small, medium, large
            device = settings.WHISPER_DEVICE  # cpu, cuda, auto
            compute_type = "int8" if device == "cpu" else "float16"
            
            print(f"Loading Faster-Whisper model: {model_size} on {device}")
            cls._model = WhisperModel(
                model_size,
                device=device,
                compute_type=compute_type,
                download_root=str(Path.home() / ".cache" / "faster-whisper")
            )
            print("Faster-Whisper model loaded successfully")
        
        return cls._model
    
    async def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcribe audio file with word-level timestamps.
        
        Returns:
            {
                "text": "full transcript",
                "language": "en",
                "segments": [
                    {
                        "start": 0.0,
                        "end": 2.5,
                        "text": "Hello world",
                        "words": [
                            {"start": 0.0, "end": 0.5, "word": "Hello"},
                            {"start": 0.6, "end": 1.0, "word": "world"}
                        ]
                    }
                ]
            }
        """
        # Validate file
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        # Run in thread pool (CPU-bound operation)
        result = await asyncio.to_thread(
            self._transcribe_sync,
            audio_path,
            language
        )
        
        return result
    
    def _transcribe_sync(
        self,
        audio_path: str,
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """Synchronous transcription (called in thread pool)."""
        model = self.get_model()
        
        # Transcribe with word timestamps
        segments_iterator, info = model.transcribe(
            audio_path,
            language=language,
            word_timestamps=True,  # CRITICAL: Enable word-level timestamps
            vad_filter=True,       # Voice Activity Detection (remove silence)
            vad_parameters={
                "threshold": 0.5,
                "min_speech_duration_ms": 250,
                "min_silence_duration_ms": 100
            }
        )
        
        # Convert iterator to list and extract data
        segments_data = []
        full_text = []
        
        for segment in segments_iterator:
            # Extract words with timestamps
            words_data = []
            if hasattr(segment, 'words') and segment.words:
                for word in segment.words:
                    words_data.append({
                        "word": word.word.strip(),
                        "start": round(word.start, 2),
                        "end": round(word.end, 2)
                    })
            
            segments_data.append({
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip(),
                "words": words_data
            })
            
            full_text.append(segment.text.strip())
        
        return {
            "text": " ".join(full_text),
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
            "duration": round(info.duration, 2),
            "segments": segments_data
        }
    
    async def detect_filler_words(
        self,
        transcript_data: Dict[str, Any],
        filler_words: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Detect filler words in transcript using word timestamps.
        
        Args:
            transcript_data: Output from transcribe()
            filler_words: List of filler words to detect (e.g., ["um", "uh", "şey"])
        
        Returns:
            List of filler segments: [{"word": "um", "start": 5.2, "end": 5.4}, ...]
        """
        filler_segments = []
        
        # Normalize filler words (lowercase, strip)
        normalized_fillers = {word.lower().strip() for word in filler_words}
        
        # Search through all segments
        for segment in transcript_data.get("segments", []):
            for word_data in segment.get("words", []):
                word = word_data["word"].lower().strip()
                
                # Check if word is a filler
                if word in normalized_fillers:
                    filler_segments.append({
                        "word": word,
                        "start": word_data["start"],
                        "end": word_data["end"]
                    })
        
        return filler_segments


# Singleton instance
faster_whisper_service = FasterWhisperService()
```

**Why**: Clean service abstraction, word-level timestamps for filler detection

**Estimated Time**: 15 minutes (copy-paste + adapt)  
**Risk**: Low (straightforward API wrapper)

---

### ✅ Task 1.4: Update Transcription Service

**File**: `backend/app/services/transcription_service.py`

**Changes** (at top of file, around line 10):
```python
# Add import
from app.services.faster_whisper_service import faster_whisper_service

class TranscriptionService:
    # ... existing code ...
    
    async def transcribe_local(self, audio_path: str) -> Dict[str, Any]:
        """Transcribe audio using Faster-Whisper (4x faster)."""
        try:
            # Use Faster-Whisper instead of openai-whisper
            result = await faster_whisper_service.transcribe(audio_path)
            
            return {
                "text": result["text"],
                "language": result["language"],
                "confidence": 0.90,  # Faster-Whisper quality same as openai-whisper
                "provider": "faster-whisper",
                "segments": result.get("segments", [])  # Include segments for filler removal
            }
        except Exception as e:
            print(f"Faster-Whisper transcription error: {str(e)}")
            raise
```

**Why**: Drop-in replacement, maintains existing API

**Estimated Time**: 10 minutes  
**Risk**: Low (backward compatible)

---

### ✅ Task 1.5: Update Tests

**File**: `backend/tests/test_ai_service.py`

**Changes** (update test expectations):
```python
def test_transcription_faster_whisper():
    """Test Faster-Whisper transcription with word timestamps."""
    # ... existing test setup ...
    
    result = transcription_service.transcribe_local(test_audio_path)
    
    assert result["provider"] == "faster-whisper"
    assert "segments" in result
    assert len(result["segments"]) > 0
    
    # Check word-level timestamps exist
    first_segment = result["segments"][0]
    assert "words" in first_segment
    if first_segment["words"]:
        word = first_segment["words"][0]
        assert "word" in word
        assert "start" in word
        assert "end" in word
```

**Why**: Validate Faster-Whisper integration works correctly

**Estimated Time**: 10 minutes  
**Risk**: Low

---

## Phase 2: AI-First Audio Editing (Priority: HIGH)

### ✅ Task 2.1: Rewrite Audio Editing Service

**File**: `backend/app/services/audio_editing_service.py`

**Replace Entire File** with:
```python
"""AI-powered audio editing using transcript analysis."""
import subprocess
from typing import List, Dict, Any, Optional
from pathlib import Path
import re
from app.config import settings


class AudioEditingService:
    """AI-first audio editing with transcript-based operations."""
    
    async def remove_filler_words(
        self,
        audio_path: str,
        output_path: str,
        transcript_data: Dict[str, Any],
        filler_words: Optional[List[str]] = None
    ) -> str:
        """
        Remove filler words from audio using transcript timestamps.
        
        Args:
            audio_path: Input audio file
            output_path: Output audio file
            transcript_data: Whisper output with word timestamps
            filler_words: List of words to remove (default: Turkish + English)
        
        Returns:
            Path to edited audio file
        """
        if filler_words is None:
            filler_words = settings.FILLER_WORDS_ALL
        
        # Find filler word segments from transcript
        from app.services.faster_whisper_service import faster_whisper_service
        filler_segments = await faster_whisper_service.detect_filler_words(
            transcript_data,
            filler_words
        )
        
        if not filler_segments:
            # No fillers found, copy original
            subprocess.run(["cp", audio_path, output_path], check=True)
            return output_path
        
        # Create FFmpeg filter to remove segments
        filter_script = self._create_removal_filter(filler_segments)
        
        # Apply FFmpeg filter
        cmd = [
            "ffmpeg",
            "-i", audio_path,
            "-af", filter_script,
            "-y",  # Overwrite output
            output_path
        ]
        
        subprocess.run(cmd, check=True, capture_output=True)
        
        return output_path
    
    def _create_removal_filter(self, segments: List[Dict[str, Any]]) -> str:
        """Create FFmpeg atrim filter to remove segments."""
        if not segments:
            return "anull"  # No-op filter
        
        # Sort segments by start time
        sorted_segments = sorted(segments, key=lambda x: x["start"])
        
        # Build atrim filter (keep everything EXCEPT filler segments)
        # Example: atrim=0:5.2,atrim=5.5:10.3 (keeps 0-5.2s and 5.5-10.3s, removes 5.2-5.5s)
        keep_ranges = []
        current_time = 0.0
        
        for segment in sorted_segments:
            # Keep audio from current_time to segment start
            if segment["start"] > current_time:
                keep_ranges.append(f"{current_time}:{segment['start']}")
            
            # Skip segment (this is the filler)
            current_time = segment["end"]
        
        # Keep audio after last filler to end
        keep_ranges.append(f"{current_time}")  # No end = until file end
        
        # Build filter
        filter_parts = [f"atrim={r}" for r in keep_ranges]
        return ",".join(filter_parts) + ",concat=n={}:v=0:a=1".format(len(keep_ranges))
    
    async def trim_silence(
        self,
        audio_path: str,
        output_path: str,
        leading: bool = True,
        trailing: bool = True,
        threshold_db: int = -40
    ) -> str:
        """Remove leading/trailing silence using FFmpeg."""
        cmd = [
            "ffmpeg",
            "-i", audio_path,
            "-af", f"silenceremove=start_periods={'1' if leading else '0'}:stop_periods={'1' if trailing else '0'}:start_threshold={threshold_db}dB:stop_threshold={threshold_db}dB",
            "-y",
            output_path
        ]
        
        subprocess.run(cmd, check=True, capture_output=True)
        
        return output_path


# Singleton
audio_editing_service = AudioEditingService()
```

**Why**: Transcript-based (accurate), Turkish + English support, cleaner architecture

**Estimated Time**: 30 minutes  
**Risk**: Medium (FFmpeg filter complexity, needs testing)

---

### ✅ Task 2.2: Create AI Router Endpoint

**File**: `backend/app/routers/ai.py`

**Add New Endpoint** (around line 200):
```python
@router.post("/edit-podcast/{podcast_id}")
async def edit_podcast_ai(
    podcast_id: int,
    remove_fillers: bool = True,
    trim_silence: bool = True,
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    AI-powered podcast editing (remove fillers, trim silence).
    
    Requires podcast to already have AI transcript.
    """
    # Get podcast
    podcast = db.query(Podcast).filter(
        Podcast.id == podcast_id,
        Podcast.user_id == current_user.id
    ).first()
    
    if not podcast:
        raise HTTPException(status_code=404, detail="Podcast not found")
    
    # Check if transcription exists
    ai_data = db.query(PodcastAIData).filter(
        PodcastAIData.podcast_id == podcast_id
    ).first()
    
    if not ai_data or not ai_data.transcript_data:
        raise HTTPException(
            status_code=400,
            detail="Podcast must be transcribed first. Call /ai/process endpoint."
        )
    
    # Start editing in background
    if background_tasks:
        background_tasks.add_task(
            _edit_podcast_background,
            podcast_id,
            remove_fillers,
            trim_silence,
            db
        )
    
    return {
        "status": "processing",
        "message": "AI editing started in background",
        "podcast_id": podcast_id
    }


async def _edit_podcast_background(
    podcast_id: int,
    remove_fillers: bool,
    trim_silence: bool,
    db: Session
):
    """Background task for podcast editing."""
    from app.services.audio_editing_service import audio_editing_service
    import os
    
    try:
        podcast = db.query(Podcast).filter(Podcast.id == podcast_id).first()
        ai_data = db.query(PodcastAIData).filter(PodcastAIData.podcast_id == podcast_id).first()
        
        # Get audio file path
        audio_url = podcast.audio_url
        audio_path = audio_url.replace("/media/", "backend/media/")
        
        # Create output path
        output_path = audio_path.replace(".m4a", "_edited.m4a")
        
        # Step 1: Remove filler words
        if remove_fillers:
            output_path = await audio_editing_service.remove_filler_words(
                audio_path,
                output_path,
                ai_data.transcript_data
            )
        
        # Step 2: Trim silence
        if trim_silence:
            final_output = output_path.replace("_edited.m4a", "_edited_trimmed.m4a")
            output_path = await audio_editing_service.trim_silence(
                output_path,
                final_output
            )
        
        # Update podcast audio URL
        new_url = output_path.replace("backend/media/", "/media/")
        podcast.audio_url = new_url
        db.commit()
        
        print(f"Podcast {podcast_id} edited successfully: {new_url}")
        
    except Exception as e:
        print(f"Error editing podcast {podcast_id}: {str(e)}")
        db.rollback()
```

**Why**: Provides API for AI editing feature

**Estimated Time**: 20 minutes  
**Risk**: Low

---

## Phase 3: Migration & Testing (Priority: HIGH)

### ✅ Task 3.1: Create Migration Script

**File**: `backend/scripts/migrate_to_faster_whisper.py` (NEW)

**Purpose**: Test Faster-Whisper on existing podcasts

```python
"""Migration script to test Faster-Whisper vs openai-whisper."""
import asyncio
import time
from app.database import SessionLocal
from app.models import Podcast, PodcastAIData
from app.services.faster_whisper_service import faster_whisper_service


async def test_transcription_speed():
    """Compare openai-whisper vs faster-whisper speed."""
    db = SessionLocal()
    
    # Get a test podcast
    podcast = db.query(Podcast).first()
    if not podcast:
        print("No podcasts found")
        return
    
    audio_path = podcast.audio_url.replace("/media/", "backend/media/")
    
    print(f"Testing transcription on: {audio_path}")
    
    # Test Faster-Whisper
    start = time.time()
    result = await faster_whisper_service.transcribe(audio_path)
    duration = time.time() - start
    
    print(f"\n✅ Faster-Whisper Results:")
    print(f"  Duration: {duration:.2f}s")
    print(f"  Language: {result['language']}")
    print(f"  Segments: {len(result['segments'])}")
    print(f"  Words: {sum(len(s['words']) for s in result['segments'])}")
    print(f"  Text preview: {result['text'][:200]}...")
    
    db.close()


if __name__ == "__main__":
    asyncio.run(test_transcription_speed())
```

**Estimated Time**: 10 minutes

---

### ✅ Task 3.2: Update Documentation

**Files to Update**:
1. `docs/architecture/AI_PROVIDER_ARCHITECTURE.md` - Add Faster-Whisper section
2. `docs/features/AI_INTEGRATION_GUIDE.md` - Update transcription guide
3. `backend/README.md` - Update dependencies section

**Estimated Time**: 15 minutes

---

### ✅ Task 3.3: Run Tests

**Commands**:
```bash
# Backend tests
cd backend
pytest tests/test_ai_service.py -v
pytest tests/test_rtc.py -v

# Integration test with real audio
python scripts/migrate_to_faster_whisper.py

# Test filler removal
# (manual test with Turkish podcast)
```

**Estimated Time**: 30 minutes  
**Pass Criteria**: All tests green, 4x speed improvement confirmed

---

## Implementation Checklist

### Phase 1: Faster-Whisper (2-3 hours)
- [ ] Task 1.1: Update dependencies (pip install)
- [ ] Task 1.2: Add filler words config
- [ ] Task 1.3: Create FasterWhisperService
- [ ] Task 1.4: Update TranscriptionService
- [ ] Task 1.5: Update tests

### Phase 2: Audio Editing (1-2 hours)
- [ ] Task 2.1: Rewrite AudioEditingService
- [ ] Task 2.2: Add AI editing endpoint
- [ ] Test with sample podcast (Turkish + English)

### Phase 3: Validation (1 hour)
- [ ] Task 3.1: Run migration script
- [ ] Task 3.2: Update documentation
- [ ] Task 3.3: All tests passing
- [ ] Performance benchmark (confirm 4x speedup)

**Total Estimated Time**: 4-6 hours  
**Total Cost**: $0 (all free, open-source)

---

## Rollback Plan

If Faster-Whisper has issues:

1. **Quick Rollback**:
   ```bash
   pip uninstall -y faster-whisper ctranslate2
   pip install openai-whisper==20231117
   git revert <commit-hash>
   ```

2. **Hybrid Approach** (keep both):
   - Add config flag: `WHISPER_BACKEND: "openai" | "faster"`
   - Keep both services, switch via config
   - A/B test in production

3. **Validation Before Full Switch**:
   - Test on staging with 10-20 podcasts
   - Compare transcription quality (manual review)
   - Measure speed improvement
   - Check GPU vs CPU performance

---

## Future Enhancements (Phase 4+)

### Optional Advanced Features

**WhisperX Integration** (better alignment):
```bash
pip install whisperx
```
- Use for filler removal only (more accurate word timestamps)
- Keep Faster-Whisper for basic transcription (faster)

**GPT-3.5 Context-Aware Cleaning**:
- Send transcript to GPT-3.5: "Identify filler words to remove"
- Context-aware (knows "like" in "I like this" should stay)
- Cost: ~$0.002 per 30min podcast
- Premium tier only

**Celery Queue System**:
```bash
pip install celery redis
```
- Handle concurrent processing
- Rate limiting for free tier
- Background workers for scale

**GPU Server Upgrade**:
- Hetzner GPU instance (~40€/month)
- 10x+ speedup for high-volume
- When hitting 100+ concurrent users

---

## Monitoring & Metrics

**Track These Metrics**:
1. **Processing Time**: Before vs After (expect 4x improvement)
2. **Transcription Quality**: User feedback, manual spot-checks
3. **Filler Detection Accuracy**: Turkish vs English comparison
4. **Cost**: OpenAI API usage per tier (should stay ~$0 for local)
5. **User Satisfaction**: Survey after using AI editing

**Success Criteria**:
- ✅ <5min processing for 30min podcast
- ✅ >90% Turkish filler word detection
- ✅ $0 cost for free tier users
- ✅ All tests passing
- ✅ No user complaints about speed

---

## Questions & Decisions

### Decision Log

| Question | Decision | Reason |
|----------|----------|--------|
| Device-side vs Server-side? | Server-side | RTC webhooks, better UX, faster |
| Which Whisper library? | Faster-Whisper | 4x speed, same quality, free |
| Filler removal approach? | Transcript-based | More accurate, multi-language |
| When to use GPU? | When CPU bottleneck | Start with CPU, upgrade if needed |
| Paid APIs? | Premium tier only | Keep free tier at $0 cost |

---

## References

- [Faster-Whisper GitHub](https://github.com/SYSTRAN/faster-whisper)
- [CTranslate2 Docs](https://opennmt.net/CTranslate2/)
- [FFmpeg Audio Filters](https://ffmpeg.org/ffmpeg-filters.html#Audio-Filters)
- [AI Architecture Research](./AI_ARCHITECTURE_RESEARCH.md)
- [Current AI Provider Docs](./AI_PROVIDER_ARCHITECTURE.md)

---

**Last Updated**: February 22, 2026  
**Status**: Ready for Implementation  
**Next Action**: Start with Task 1.1 (Update dependencies)  
**Owner**: ProPod Backend Team
