# AI Processing Architecture Research & Strategic Decision

**Date**: February 22, 2026  
**Status**: Research Complete - Implementation Planned  
**Decision**: Server-Side Optimization (Backend Processing)

---

## Executive Summary

After comprehensive research comparing **device-side (on-device AI)** vs **server-side processing**, we decided to **keep and optimize the current server-side architecture**. While device-side processing is cost-effective for solo podcast apps, ProPod's unique **multi-host RTC recording** (via 100ms webhooks) fundamentally requires server processing. Strategic path: Upgrade to **Faster-Whisper** (4x speed, FREE), add **WhisperX** for word timestamps, maintain hybrid model (local free / OpenAI premium).

**Key Finding**: Both external recommendations and internal analysis agree that device-side Whisper processing provides poor mobile UX (15-60min processing time, battery drain, 40-250MB model download).

---

## Research Context

### External Recommendations Analyzed

**Recommendation 1: Device-First Approach**
- **Proposal**: Use `whisper.cpp` on device (React Native), FFmpeg for editing
- **Benefits**: $0 cost, maximum privacy, no server dependency
- **Challenges**: 
  - 100-200MB app size increase
  - Device heating/battery drain
  - Requires native bridge development
  - Slow processing (30min audio = 15-60min processing on device)

**Recommendation 2: Hybrid Backend Approach**
- **Proposal**: Backend with Faster-Whisper + pyannote + silero-vad
- **Benefits**: Fast, scalable, high quality, ~$0-300₺/month for 1000 users
- **Challenges**: Server GPU recommended for scale
- **Phase Strategy**:
  - Phase 0: Basic trimming (client-side)
  - Phase 1: Backend AI (Faster-Whisper, free)
  - Phase 2: Paid APIs when scaling (Auphonic, Cleanvoice)

### ProPod's Current Architecture (Researched)

**Recording Flows:**
1. **Solo Podcasts**:
   - Device records with `expo-audio` → M4A file (128kbps, 44.1kHz)
   - Upload to backend via `apiService.uploadAudio()`
   - File saved to `backend/media/audio/`
   - AI processing triggered (backend)

2. **RTC Multi-Host Sessions**:
   - Recording happens on **100ms servers** (not device)
   - 100ms delivers recording URL via **webhook**
   - Backend receives webhook → creates Podcast record
   - Same AI pipeline processes recording
   - **CRITICAL**: Device never has the RTC recording file

**Current AI Stack:**
- **Library**: `openai-whisper` v20231117 + `torch` v2.2.0
- **Model**: `base` (74MB, balanced speed/quality)
- **Device**: CPU (configurable: CPU/CUDA/MPS)
- **Location**: 100% backend (FastAPI server)
- **Modes**: 
  - `local`: Free Whisper on backend CPU
  - `openai`: Paid OpenAI API (~$0.08 per 10min)
  - `hybrid`: Free users → local, Premium → OpenAI

**Frontend Capabilities:**
- ✅ Recording: `expo-audio` (mic → local file)
- ✅ Playback: `expo-audio` (local + remote URLs)
- ✅ File I/O: `expo-file-system`
- ❌ NO FFmpeg on device
- ❌ NO Whisper models
- ❌ NO ML inference libraries (ONNX Runtime, TensorFlow Lite)
- ❌ NO audio processing (waveform, trim, effects)

**File Limits:**
- Frontend: 50MB max (client validation)
- Backend: 100MB per upload
- AI processing: 200MB max
- Typical podcasts: 10-60min (10-60MB at 128kbps)

---

## Critical Decision Factors

### Why Device-Side Processing Doesn't Work for ProPod

**1. RTC Multi-Host Recording = Server-Side Only**
- ProPod's **core feature** is multi-host live podcasts via 100ms
- 100ms does server-side recording (not device recording)
- Recording delivered via **webhook** (backend receives URL)
- Device never has access to RTC recording file
- **Device-side AI would only work for solo podcasts** (breaks core feature)

**2. Performance Reality on Mobile**
- **Device Whisper Processing Times** (30min podcast):
  - Flagship phone (iPhone 15, Galaxy S24): 15-30min
  - Mid-range (iPhone 12, Galaxy A54): 30-60min
  - Budget devices: 60min+
- **Server Processing Times** (same 30min podcast):
  - Backend CPU: 15min (current `openai-whisper`)
  - Backend with Faster-Whisper: 3-5min (4x speedup)
  - Backend with GPU: <1min (10x+ speedup)
  - OpenAI API: ~3min (cloud processing)

**3. Mobile UX Challenges**
- User must keep app open during processing (15-60min)
- Battery drain (intensive CPU usage)
- Device heating (especially on Android)
- App size increase (40-250MB for Whisper model)
- No benefits for RTC recordings (still need server)

**4. Development Complexity**
- No production-ready React Native Whisper library
- Would need custom native modules (iOS + Android)
- ONNX Runtime integration (experimental)
- Model download/management logic
- Background task permissions (Android service, iOS background)
- Estimated: 3-4 weeks development + testing

**5. Cost Reality**
- **Device processing doesn't reduce costs** (files still uploaded for storage)
- Current backend processing: $0 for local Whisper
- Server costs same whether processing on device or server
- Storage costs dominate (audio files), not CPU time

### Why Server-Side Optimization Is Optimal

**1. Works for ALL Recording Types**
- ✅ Solo podcasts (device upload → backend AI)
- ✅ RTC multi-host (webhook → backend AI)
- ✅ Future: Multiple participants, screen sharing, video

**2. Better Performance & UX**
- Upload instant (seconds)
- Processing non-blocking (background task)
- User can close app immediately
- No battery/heating concerns
- GPU acceleration available

**3. Already Implemented & Battle-Tested**
- Current architecture proven (32 backend tests, 144 frontend tests pass)
- Hybrid system (local/OpenAI/hybrid) already working
- Easy to optimize (upgrade Whisper library, add GPU)

**4. Industry Standard Pattern**
- **Spotify**: Server-side transcription
- **Anchor**: Server processing
- **Descript**: Cloud-based editing
- **Riverside.fm**: Server recording + processing
- Only exception: Apps requiring offline-first (not ProPod's use case)

**5. Cost-Effective Scaling**
- Phase 1 (0-100 users): Local Whisper on CPU (~$0)
- Phase 2 (100-1000 users): GPU server (~40€/month Hetzner)
- Phase 3 (1000+ users): Hybrid (free tier local, premium OpenAI)
- Cost per podcast at scale: ~$0.001-0.01 (pennies)

---

## Strategic Roadmap

### Phase 1: Backend Optimization (Immediate - 2-4 hours)

**Objective**: 4x faster transcription, better filler removal, $0 cost

**Tasks:**
1. **Upgrade to Faster-Whisper**
   - Replace `openai-whisper` with `faster-whisper` + `ctranslate2`
   - Benefit: 4x speed, same quality, same API
   - Migration: Drop-in replacement (minimal code changes)

2. **Add Word-Level Timestamps**
   - Faster-Whisper provides word timestamps by default
   - Use for precise filler word removal
   - Enables advanced editing features

3. **Turkish + English Filler Words**
   - Turkish: "şey", "yani", "işte", "hani", "ee", "ıı"
   - English: "um", "uh", "like", "you know", "actually"
   - Context-aware detection (transcript-based, not audio waveform)

4. **Rewrite Audio Editing Service**
   - Current: Manual FFmpeg regex (English-only)
   - New: Transcript-based with word timestamps
   - AI-first: Use GPT-3.5 for context-aware detection (optional)

**Expected Results:**
- Transcription: 30min podcast in 3-5min (down from 15min)
- Filler removal: Turkish + English support, context-aware
- Cost: $0 for local tier (Faster-Whisper is free)

### Phase 2: Optional Enhancements (Future - 4-8 hours)

**Objective**: Production-grade quality, premium features

**Tasks:**
1. **Add WhisperX Integration**
   - Better word alignment (more accurate timestamps)
   - Speaker diarization (multi-host identification)
   - Use only for filler removal (not basic transcription)

2. **GPT-3.5 Turbo Transcript Cleaning**
   - Context-aware filler detection
   - Premium tier feature
   - Cost: ~$0.002 per 30min podcast (85% cheaper than GPT-4)

3. **Queue System (Celery + Redis)**
   - Handle concurrent processing
   - Rate limiting (2-3 podcasts/month free tier)
   - Background workers for scaling

4. **GPU Server Upgrade**
   - When CPU becomes bottleneck (100+ users)
   - Hetzner GPU instance (~40€/month)
   - 10x+ speedup for high-volume processing

### Phase 3: Future Optimizations (Long-term)

**Objective**: Scale to 10,000+ users, minimize costs

**Tasks:**
1. **Storage Optimization**
   - Auto-delete temp files after processing
   - User storage quotas (500MB free tier)
   - Compression for archived podcasts

2. **Monitoring & Analytics**
   - Track processing times (local vs OpenAI)
   - Cost per user tier
   - Model performance metrics

3. **Optional: Paid API Fallback**
   - Auphonic API for premium users (filler removal + leveling)
   - Resound.fm for advanced editing
   - Cleanvoice.ai for multilingual filler removal
   - User-funded (premium tier pays for itself)

---

## Cost Projections

### Current Architecture (Optimized)

| Tier | Users | Podcasts/Month | Backend Cost | OpenAI Cost | Total/Month |
|------|-------|----------------|--------------|-------------|-------------|
| Initial | 0-100 | 100 | $0 (CPU) | $0 (local) | **$0** |
| Growing | 100-500 | 1000 | $40 (GPU) | $0 (local) | **$40** |
| Scaling | 500-1000 | 5000 | $40 (GPU) | $50 (premium) | **$90** |
| Mature | 1000+ | 10000+ | $80 (larger GPU) | $200 (premium) | **$280** |

**Per-User Cost at 1000 users**: ~$0.09/month  
**Per-Podcast Cost**: ~$0.001-0.01 (essentially free)

### Alternative: Device-Side Processing

| Factor | Cost/Impact |
|--------|-------------|
| Development | 3-4 weeks engineering time (~$4,000-8,000) |
| Maintenance | Ongoing native module updates (iOS/Android) |
| User Experience | Poor (15-60min processing, battery drain) |
| RTC Support | Doesn't work (breaks multi-host feature) |
| App Size | +100-200MB (user acquisition impact) |

**Verdict**: High cost, poor UX, doesn't support core features.

---

## Technical Specifications

### Recommended Backend Stack

```python
# requirements.txt additions/changes
faster-whisper==1.1.0       # CTranslate2-optimized Whisper
ctranslate2==4.5.0          # Fast inference engine
# whisperx (optional for Phase 2)
# pyannote.audio (optional for speaker diarization)
# silero-vad (optional for advanced silence detection)
```

### Configuration Updates

```python
# backend/app/config.py
AI_PROVIDER: "local" | "openai" | "hybrid"  # Keep existing
WHISPER_BACKEND: "faster-whisper"           # New: specify backend
WHISPER_MODEL_SIZE: "base"                  # Keep existing
WHISPER_DEVICE: "cpu"                       # cpu/cuda/mps
FILLER_WORDS_TR = ["şey", "yani", "işte", ...]
FILLER_WORDS_EN = ["um", "uh", "like", ...]
```

### Migration Path (Backward Compatible)

1. Install Faster-Whisper alongside openai-whisper
2. Add config flag to choose backend
3. Test Faster-Whisper on staging
4. Switch default to Faster-Whisper
5. Remove openai-whisper dependency after validation

---

## Comparative Analysis

### Device-Side vs Server-Side

| Factor | Device-Side | Server-Side (Current) |
|--------|-------------|----------------------|
| **Solo Podcasts** | ⚠️ Works (slow) | ✅ Works (fast) |
| **RTC Multi-Host** | ❌ Doesn't work | ✅ Works perfectly |
| **Processing Speed** | 15-60min (30min audio) | 3-5min (optimized) |
| **Battery Impact** | ⚠️ High drain | ✅ None |
| **App Size** | ⚠️ +100-200MB | ✅ No change |
| **Development** | ⚠️ 3-4 weeks | ✅ 2-4 hours |
| **Maintenance** | ⚠️ Native modules | ✅ Python only |
| **GPU Acceleration** | ❌ Not available | ✅ Easy to add |
| **Cost (1000 users)** | ~$0 | ~$90/month |
| **Offline Support** | ✅ Works offline | ⚠️ Requires internet |

**Winner: Server-Side** (7 advantages vs 1 for device-side)

### Whisper Library Comparison

| Library | Speed | Quality | Size | GPU | React Native |
|---------|-------|---------|------|-----|--------------|
| openai-whisper | 1x | 100% | 74MB | ✅ | ❌ |
| faster-whisper | 4x | 100% | 74MB | ✅ | ❌ |
| whisper.cpp | 2-3x | 100% | 40MB | ⚠️ | ⚠️ Experimental |
| WhisperX | 3-4x | 105% | 80MB | ✅ | ❌ |
| OpenAI API | 5-10x | 100% | 0 | ☁️ | ✅ |

**Winner: faster-whisper** (best speed/quality for backend)

---

## Conclusion

**Decision: Optimize Server-Side Architecture**

**Rationale:**
1. ProPod's multi-host RTC recording requires server processing (100ms webhooks)
2. Device-side Whisper provides poor UX (15-60min processing, battery drain)
3. Current architecture already optimal for mobile (instant upload, background processing)
4. Faster-Whisper upgrade = 4x speedup, $0 cost, 2-4 hours implementation
5. Scales cost-effectively to 1000+ users (~$0.09/user/month)

**Next Steps:**
1. Implement Faster-Whisper backend (Phase 1)
2. Test with Turkish + English podcasts
3. Monitor performance and cost metrics
4. Add GPU server when scaling (Phase 2)
5. Consider paid APIs only for premium tier (user-funded)

**Device-Side Processing**: Rejected for ProPod's use case. May revisit if offline-first becomes critical requirement and we:
- Separate solo podcasts from RTC features
- Find production-ready React Native Whisper library
- Accept 15-60min processing time as acceptable UX

---

## References

- [AI Provider Architecture](../architecture/AI_PROVIDER_ARCHITECTURE.md)
- [Current Transcription Service](../../backend/app/services/transcription_service.py)
- [Local Whisper Service](../../backend/app/services/local_whisper_service.py)
- [Audio Editing Service](../../backend/app/services/audio_editing_service.py) (to be rewritten)
- [Faster-Whisper GitHub](https://github.com/SYSTRAN/faster-whisper)
- [WhisperX GitHub](https://github.com/m-bain/whisperX)

**Last Updated**: February 22, 2026  
**Status**: Ready for Implementation  
**Owner**: ProPod AI Team
