"""RTC integration endpoints (100ms) - Core functionality only."""
from typing import Any, Dict, List, Optional, Tuple
import json

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app import schemas
from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app import models, crud
from app.services.hms_service import create_room, generate_auth_token
from app.services.live_session_service import get_active_participants
from app.models import User


router = APIRouter(prefix="/rtc", tags=["RTC"])


def _rtc_log(action: str, **context: Any) -> None:
    safe_context = {k: v for k, v in context.items() if v is not None}
    print(f"[RTC] {action}: {safe_context}")


@router.post("/token", response_model=schemas.RTCTokenResponse)
async def create_rtc_token(
    request: schemas.RTCTokenRequest,
    current_user: User = Depends(get_current_user),
) -> schemas.RTCTokenResponse:
    """Create a 100ms auth token for the current user."""
    # Always use authenticated user ID to prevent impersonation
    user_id = str(current_user.id)

    _rtc_log(
        "token.request",
        owner_id=current_user.id,
        room_id=request.room_id,
        role=request.role,
        expires_in_seconds=request.expires_in_seconds,
    )

    try:
        token = generate_auth_token(
            room_id=request.room_id,
            user_id=user_id,
            role=request.role,
            expires_in_seconds=request.expires_in_seconds,
        )
    except ValueError as exc:
        _rtc_log(
            "token.error",
            owner_id=current_user.id,
            room_id=request.room_id,
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    _rtc_log(
        "token.success",
        owner_id=current_user.id,
        room_id=request.room_id,
        role=request.role,
        token_length=len(token) if token else 0,
    )

    return schemas.RTCTokenResponse(
        token=token,
        room_id=request.room_id,
        role=request.role,
        user_id=user_id,
        expires_in_seconds=request.expires_in_seconds,
    )


@router.post("/rooms", response_model=schemas.RTCRoomCreateResponse)
async def create_rtc_room(
    request: schemas.RTCRoomCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.RTCRoomCreateResponse:
    """Create a 100ms room via REST API."""
    template_id = request.template_id or settings.HMS_TEMPLATE_ID

    _rtc_log(
        "room.request",
        owner_id=current_user.id,
        title=request.title,
        media_mode=request.media_mode,
        category=request.category,
        template_id=template_id,
        has_webhook=bool(request.webhook_url or settings.HMS_WEBHOOK_URL),
    )

    if not template_id:
        _rtc_log("room.rejected", owner_id=current_user.id, reason="missing_template_id")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="template_id is required",
        )

    webhook_url = request.webhook_url or settings.HMS_WEBHOOK_URL or None

    try:
        room = await create_room(
            name=request.name,
            description=request.description,
            template_id=template_id,
            region=request.region,
            size=request.size,
            max_duration_seconds=request.max_duration_seconds,
            webhook_url=webhook_url,
            webhook_headers=request.webhook_headers,
        )
        
        # Validate 100ms response contains required room ID
        room_id = room.get("id")
        if not room_id:
            _rtc_log(
                "room.error",
                owner_id=current_user.id,
                error_type="missing_room_id",
                error="100ms response missing room ID",
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="100ms API returned invalid response (missing room ID)",
            )
        
        session = models.RTCSession(
            room_id=room_id,
            room_name=room.get("name") or request.name,
            owner_id=current_user.id,
            title=request.title or request.name,
            description=request.description,
            category=request.category or "General",
            is_public=bool(request.is_public) if request.is_public is not None else False,
            media_mode=request.media_mode or "video",
            status="created",
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        _rtc_log(
            "room.success",
            owner_id=current_user.id,
            room_id=room.get("id"),
            room_name=room.get("name"),
            session_id=session.id,
            media_mode=session.media_mode,
        )
    except ValueError as exc:
        _rtc_log(
            "room.error",
            owner_id=current_user.id,
            error_type="value_error",
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        _rtc_log(
            "room.error",
            owner_id=current_user.id,
            error_type="upstream_error",
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"100ms API error: {exc}",
        ) from exc

    return schemas.RTCRoomCreateResponse(
        id=room_id,
        name=session.room_name or request.name or "",
        enabled=room.get("enabled", True),
        template_id=room.get("template_id"),
        region=room.get("region"),
        session_id=session.id,
    )


def _extract_recording_info(payload: Dict[str, Any]) -> Tuple[Optional[str], Optional[str], Optional[int]]:
    room_id = (
        payload.get("room_id")
        or payload.get("data", {}).get("room_id")
        or payload.get("room", {}).get("id")
        or payload.get("data", {}).get("room", {}).get("id")
    )

    data = payload.get("data", {})
    recording = data.get("recording", {}) if isinstance(data, dict) else {}
    files = data.get("files") or payload.get("files") or []

    recording_url = (
        payload.get("recording_url")
        or data.get("recording_url")
        or recording.get("recording_url")
        or recording.get("url")
        or recording.get("s3_url")
    )

    if not recording_url and isinstance(files, list) and files:
        recording_url = files[0].get("url") or files[0].get("file_url")

    duration_seconds = (
        payload.get("duration")
        or data.get("duration")
        or recording.get("duration")
        or 0
    )

    try:
        duration_seconds = int(duration_seconds) if duration_seconds else 0
    except (TypeError, ValueError):
        duration_seconds = 0

    return room_id, recording_url, duration_seconds


@router.post("/webhooks/100ms")
async def hms_webhook(
    request: Request,
    x_webhook_secret: Optional[str] = Header(default=None, alias="X-Webhook-Secret"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Receive 100ms webhook events (recording, RTMP/HLS, etc.)."""
    if settings.HMS_WEBHOOK_SECRET and x_webhook_secret != settings.HMS_WEBHOOK_SECRET:
        _rtc_log("webhook.rejected", reason="invalid_secret")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret",
        )

    try:
        payload = await request.json()
    except Exception:
        raw_body = await request.body()
        payload = {"raw": raw_body.decode("utf-8", errors="ignore")}

    room_id, recording_url, duration_seconds = _extract_recording_info(payload)
    event_name = payload.get("type") or payload.get("event") or payload.get("action")

    _rtc_log(
        "webhook.received",
        event=event_name,
        room_id=room_id,
        has_recording_url=bool(recording_url),
        duration_seconds=duration_seconds,
    )

    if not room_id:
        _rtc_log("webhook.ignored", reason="missing_room_id")
        return {"status": "ok"}

    session = (
        db.query(models.RTCSession)
        .filter(models.RTCSession.room_id == room_id)
        .first()
    )
    if not session:
        _rtc_log("webhook.ignored", reason="session_not_found", room_id=room_id)
        return {"status": "ok"}

    session.last_webhook_payload = json.dumps(payload)

    if recording_url:
        if session.podcast_id or session.recording_url:
            _rtc_log(
                "webhook.idempotent",
                session_id=session.id,
                room_id=room_id,
                podcast_id=session.podcast_id,
            )
            db.commit()
            return {"status": "ok"}

        podcast_data = schemas.PodcastCreate(
            title=session.title or session.room_name or "Live Session",
            description=session.description,
            category=session.category or "General",
            is_public=session.is_public,
            duration=duration_seconds,
            audio_url=recording_url,
        )

        podcast = crud.create_podcast(db, podcast_data, session.owner_id)
        session.podcast_id = podcast.id
        session.recording_url = recording_url
        session.duration_seconds = duration_seconds
        session.status = "completed"
        db.commit()
        _rtc_log(
            "webhook.podcast_created",
            session_id=session.id,
            room_id=room_id,
            podcast_id=podcast.id,
            duration_seconds=duration_seconds,
        )
        return {"status": "ok", "podcast_id": podcast.id}

    session.status = session.status or "created"
    db.commit()
    _rtc_log(
        "webhook.updated_without_recording",
        session_id=session.id,
        room_id=room_id,
        status=session.status,
    )
    return {"status": "ok"}


@router.get("/sessions", response_model=list[schemas.RTCSessionResponse])
def list_rtc_sessions(
    room_id: Optional[str] = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[schemas.RTCSessionResponse]:
    """List RTC sessions for the current user."""
    query = db.query(models.RTCSession).filter(
        models.RTCSession.owner_id == current_user.id
    )

    if room_id:
        query = query.filter(models.RTCSession.room_id == room_id)

    safe_limit = min(max(limit, 1), 50)
    sessions = query.order_by(desc(models.RTCSession.created_at)).limit(safe_limit).all()
    return sessions


@router.get("/sessions/{session_id}", response_model=schemas.RTCSessionResponse)
def get_rtc_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.RTCSessionResponse:
    """Get a single RTC session by ID for the current user."""
    session = (
        db.query(models.RTCSession)
        .filter(
            models.RTCSession.id == session_id,
            models.RTCSession.owner_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RTC session not found",
        )
    return session


@router.get("/sessions/{session_id}/participants", response_model=List[schemas.RTCParticipantResponse])
def list_session_participants(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[schemas.RTCParticipantResponse]:
    """List active participants for a session.

    Access is restricted to the session owner. Participant data includes
    peer_id and connection_quality; user_id is excluded from the response
    schema to avoid PII leakage.
    """
    # Explicit ownership check before returning any participant data
    session = (
        db.query(models.RTCSession)
        .filter(
            models.RTCSession.id == session_id,
            models.RTCSession.owner_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RTC session not found",
        )

    return get_active_participants(db, session_id)


# ==================== Template Management ====================

@router.get("/templates", response_model=schemas.RTCTemplatesResponse)
async def list_templates(
    current_user: User = Depends(get_current_user),
) -> schemas.RTCTemplatesResponse:
    """
    List available recording templates based on user tier.
    
    Returns different quality options (free, standard, premium) based on
    whether user has premium status.
    """
    from app.services.template_service import list_available_templates
    
    user_is_premium = current_user.is_premium
    templates = list_available_templates(user_is_premium)
    
    user_tier = "premium" if user_is_premium else "free"
    
    _rtc_log(
        "templates.list",
        owner_id=current_user.id,
        user_tier=user_tier,
        template_count=len(templates),
    )
    
    return schemas.RTCTemplatesResponse(
        templates=[
            schemas.RTCTemplateConfig(
                id=t.id,
                name=t.name,
                quality=t.quality,
                max_duration_minutes=t.max_duration_minutes,
                features=t.features,
                storage_estimate_mb_per_hour=t.storage_estimate_mb_per_hour,
                tier_required=t.tier_required,
            )
            for t in templates
        ],
        user_tier=user_tier,
    )


@router.post("/storage-estimate", response_model=schemas.RTCStorageEstimateResponse)
async def estimate_storage(
    request: schemas.RTCStorageEstimateRequest,
    current_user: User = Depends(get_current_user),
) -> schemas.RTCStorageEstimateResponse:
    """
    Estimate storage size for a recording based on quality and duration.
    
    Helps users plan storage usage before starting a recording.
    """
    from app.services.template_service import estimate_storage as calc_storage, TEMPLATES
    
    # Validate quality
    if request.quality not in TEMPLATES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid quality. Must be one of: {', '.join(TEMPLATES.keys())}",
        )
    
    # Check if user has access to requested quality
    user_is_premium = current_user.is_premium
    if request.quality == "premium" and not user_is_premium:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Premium quality requires premium tier subscription",
        )
    
    # Calculate storage
    estimated_mb = calc_storage(
        quality=request.quality,
        duration_minutes=request.duration_minutes,
        participant_count=request.participant_count,
    )
    
    template = TEMPLATES[request.quality]
    
    _rtc_log(
        "storage.estimate",
        owner_id=current_user.id,
        quality=request.quality,
        duration=request.duration_minutes,
        participants=request.participant_count,
        estimated_mb=estimated_mb,
    )
    
    return schemas.RTCStorageEstimateResponse(
        estimated_mb=estimated_mb,
        quality=request.quality,
        duration_minutes=request.duration_minutes,
        participant_count=request.participant_count,
        template=schemas.RTCTemplateConfig(
            id=template.id,
            name=template.name,
            quality=template.quality,
            max_duration_minutes=template.max_duration_minutes,
            features=template.features,
            storage_estimate_mb_per_hour=template.storage_estimate_mb_per_hour,
            tier_required=template.tier_required,
        ),
    )
