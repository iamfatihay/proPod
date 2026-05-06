# proPod Feature Roadmap

This roadmap is intentionally pruned to focus on work that is still meaningfully open in the current repository.

## MVP Priority

The product's top priority is not generic feature breadth. The MVP must first make this core path feel dependable:

1. A creator can start a podcast/session without friction.
2. Multiple participants in different countries or network conditions can join and talk smoothly.
3. Audio/video quality and connection stability are good enough for a real podcast workflow.
4. The session recording completes reliably and becomes a usable podcast artifact.

Until this flow is strong, other work should usually be treated as secondary.

## Current Product Baseline

Already present in the repo and no longer roadmap-worthy as greenfield work:

- AI processing backend and provider architecture in `backend/app/services/` and `backend/app/routers/ai.py`
- Creator analytics endpoint and screen in `backend/app/routers/analytics.py` and `frontend/app/(main)/analytics.js`
- Listening history and Continue Listening flows in backend schemas/routes and frontend home/history surfaces
- Podcast, playlist, and live deep link handling in `frontend/app/_layout.js`
- Audio playback built on `expo-audio`, including playback speed and sleep timer UI

## Phase 1: Multi-Host Recording MVP Completion

**Priority:** Highest

This is the current product-critical phase. ProPod must become excellent at creation, collaboration, and recording reliability before expanding sideways.

### Remaining opportunities

1. Make podcast/session creation clearer and faster for hosts.
2. Improve RTC join reliability, reconnect behavior, and in-call resilience for geographically distributed participants.
3. Improve perceived and actual audio/video quality for multi-host sessions.
4. Tighten recording completion flow so multi-host sessions consistently end as usable podcast records.
5. Reduce operational gaps around invite flow, session monitoring, and failure recovery.

### Main surfaces

- `backend/app/routers/rtc.py`
- `backend/app/services/hms_service.py`
- `backend/app/services/live_session_service.py`
- `frontend/src/components/rtc/`
- create / live-session flows in `frontend/app/(main)/create.js`
- related RTC project docs in `docs/project/RTC_IMPLEMENTATION_SUMMARY.md` and `docs/project/VIDEO_PODCAST_RESEARCH.md`

---

## Phase 2: AI User Experience Completion

**Priority:** High

The backend AI foundation exists. The remaining work is making it feel complete and visible in the app.

### Remaining opportunities

1. Surface transcription, summary, and keywords more clearly in creator and listener screens.
2. Add reliable processing-state UI around AI actions started from the frontend.
3. Improve retry, status polling, and failure messaging for long-running AI processing.
4. Expand premium-aware UX around AI limits and provider selection.

### Main surfaces

- `backend/app/routers/ai.py`
- `backend/app/services/ai_service.py`
- `backend/app/services/transcription_service.py`
- `backend/app/services/content_analyzer.py`
- `frontend/src/services/api/apiService.js`
- podcast create/details flows in `frontend/app/(main)/`

---

## Phase 3: Studio And Editing Expansion

**Priority:** High

Draft recovery and core recording flows exist. What remains is richer creator editing.

### Remaining opportunities

1. Waveform-based editing UI for trimming and visual feedback.
2. Chapter markers with timestamps and skip navigation.
3. Better in-app editing controls for creator workflows before publish.
4. Optional audio cleanup tools only if they fit the mobile experience.

### Technical direction

- Keep playback and recording aligned with `expo-audio`.
- Reuse existing recording and draft-protection services.
- Add backend processing only when a frontend editing flow truly needs it.

---

## Phase 4: Analytics Expansion

**Priority:** Medium

The creator dashboard already exists. The roadmap item is now expansion, not initial delivery.

### Remaining opportunities

1. Plays-over-time charting and richer trend visualizations.
2. Audience insights such as active listening windows and retention patterns.
3. Export options for creators.
4. Stronger top-content and category comparisons.

### Existing baseline

- `backend/app/routers/analytics.py`
- `frontend/app/(main)/analytics.js`
- analytics backend tests in `backend/tests/test_analytics*.py`

---

## Phase 5: Recommendations And Discovery Quality

**Priority:** Medium

Recommendation-related services already exist, but the experience can become more product-visible and useful.

### Remaining opportunities

1. Improve user-facing recommendation placement and explanation.
2. Use AI metadata more effectively in discovery and semantic search flows.
3. Add creator-side suggestion surfaces only when they directly improve publishing decisions.

---

## Phase 6: Sharing, Offline, And Playback Polish

**Priority:** Medium

The repo already supports share routes and app deep links. The remaining work is polish and completion.

### Remaining opportunities

1. Replace placeholder web share CTAs and download-page links with production-ready destinations.
2. Add offline podcast downloads and playback from local files.
3. Improve background playback and lock-screen controls.
4. Continue targeted accessibility improvements on player and mini-player surfaces.

---

## Phase 7: Monetization And Premium UX

**Priority:** Low

### Remaining opportunities

1. Clarify premium user journeys around AI and creator value.
2. Add monetization surfaces only when they fit existing creator/listener flows.
3. Avoid backend-only subscription work without a user-visible path.

---

## Near-Term Bets

1. Multi-host recording MVP completion: session creation, stable joins, resilient RTC, and reliable recording output.
2. AI processing UX that improves created podcast value after the core recording flow is dependable.
3. Studio editing improvements that creators can use after successful recording.
4. Sharing/offline polish only after the primary creation and collaboration flow is strong.

---

_Last updated: 2026-05-06_
