# Video Podcast Multi-Host Research (Feb 2026)

## Scope and goals
- Enable multi-host remote podcast sessions with audio-only or video mode.
- iOS and Android first (Expo / React Native app).
- Reliability and low-latency are critical; must tolerate international participants.
- Recordings should be high quality, and upload/processing should be robust.

## Market scan (solution categories)
### 1) Turnkey RTC platforms (managed media + SDKs)
These provide SDKs for mobile, signaling, SFU, and optional recording.
- Agora
- Twilio Video
- Daily
- 100ms
- Dolby.io
Pros
- Fastest to integrate, strong global infra, good mobile SDKs.
- Recording, transcription, and moderation features often included.
Cons
- Per-minute cost can scale quickly at volume.
- Less control of media pipeline and QoS tuning.

### 2) Managed SFU you can also self-host
Examples: LiveKit (Cloud or self-host), Jitsi (self-host only).
Pros
- More control over pipeline; lower long-term costs when self-hosted.
- Strong WebRTC standards compliance.
Cons
- Requires DevOps, monitoring, and SRE investment for reliability.

### 3) Streaming-only platforms (not real-time RTC)
Examples: Mux, AWS IVS, Wowza.
Pros
- Best for large one-to-many live audiences.
Cons
- Not suitable for low-latency multi-host conversation by itself.
- Would still need RTC for hosts, then optionally restream to audience.

## Technology baseline
- Real-time co-hosting requires WebRTC.
- For multi-party (2-10) with low latency, SFU is the standard architecture.
- Mobile apps should use native WebRTC stacks (AEC/NS/AGC) for audio quality.

## Recommended architecture (high level)
1) Client apps (iOS/Android) use an RTC SDK to join a room.
2) Backend issues short-lived access tokens and manages room metadata.
3) SFU routes audio/video streams between participants.
4) Recording service captures:
   - Per-participant audio tracks (best for editing and AI processing)
   - Optional mixed composite video
5) Storage layer (S3 or equivalent) stores final assets.
6) App backend updates podcast episode with `audio_url` and `video_url`.

## Recording strategy
- Primary: server-side recording via the media server (most reliable).
- Optional: local device backup recording (for fail-safe and offline upload).
- Export separate audio tracks for post-production and AI processing.
- If video exists, provide both video and audio-only playback options.

## Integration notes for current codebase
Current system is audio-only with `audio_url` in podcast records.
To support video + RTC sessions, plan for:
- New fields on Podcast model: `video_url`, `has_video`, `recording_provider`, `room_id`.
- New backend endpoints:
  - Create/join room (token issuance)
  - Webhook receiver for recording completion
- Frontend changes:
  - Add audio/video toggle during recording
  - New call/record screen using RTC SDK
  - Player supports audio-only and video playback

## Option comparison (summary)
### Agora
- Strengths: mature global network, strong RN SDK, cloud recording.
- Tradeoff: cost at scale, vendor lock-in.

### Twilio Video
- Strengths: reliable, widely known.
- Tradeoff: cost can be higher; fewer media features than some rivals.

### Daily
- Strengths: simple APIs, good recording and transcripts.
- Tradeoff: less control if you want custom SFU behavior.

### 100ms
- Strengths: good RN SDK, room templates, recording and RTMP out.
- Tradeoff: pricing and feature limits depend on plan.

### LiveKit Cloud / self-host
- Strengths: open source core, strong WebRTC SFU, egress recording.
- Tradeoff: if self-hosted, needs ops and reliability engineering.

## Cost model (drivers)
Total cost is driven by:
- Participant minutes (audio/video)
- Recording minutes (per-track vs mixed)
- Egress bandwidth
- Storage and processing

A simple formula to estimate monthly cost:
- Participant minutes * price per minute
+ Recording minutes * recording price
+ Egress GB * bandwidth price
+ Storage GB * storage price

## Recommendation (balanced approach)
Given the requirement for high reliability and fast integration:
1) Start with a managed RTC provider that has proven mobile SDKs and recording.
2) Keep architecture provider-agnostic (token + room + webhook abstraction).
3) If scale or cost becomes dominant, evaluate moving to LiveKit self-host.

Most practical MVP path:
- Managed RTC (Daily, 100ms, or Agora)
- Server-side recording + cloud storage
- Optional live audience later via RTMP/HLS restream

## Roadmap proposal
Phase 0 (Research + spike)
- Select provider and validate iOS/Android SDK in Expo dev-client.
- Prototype join/leave, mute, video toggle, and network fallback.

Phase 1 (Audio-only RTC rooms)
- Replace local-only recording with RTC audio rooms.
- Server-side recording for audio track per participant.

Phase 2 (Add video)
- Video capture, bandwidth adaptation, simulcast.
- Video recording and playback option.

Phase 3 (Production hardening)
- QoS monitoring, reconnection, latency metrics, crash analytics.
- Regional SFU selection and failover strategy.

Phase 4 (Scale + audience)
- Optional live audience via RTMP/HLS restream.
- CDN optimized playback for large audiences.

## Key risks and mitigations
- Mobile background behavior: use native audio session configuration and handle interruptions.
- Network variance: enable simulcast, adaptive bitrate, and jitter buffers.
- Echo and noise: rely on native AEC/NS/AGC, provide mic test.
- Recording integrity: server-side + optional local backup.

## Open questions
- Do we need live audience streaming now, or only multi-host recording?
- Expected max number of co-hosts per session?
- Required recording layout for video (gallery vs active speaker)?
- Budget constraints for managed provider?
