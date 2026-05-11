"""RTC integration endpoints (100ms) - Core functionality only."""
from typing import Any, Dict, List, Optional, Tuple
import json

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app import schemas
from app import schemas_live_session
from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app import models, crud
from app.services.hms_service import create_room, generate_auth_token
from app.services.live_session_service import end_session, generate_invite_code, get_active_participants, start_session
from app.models import User


router = APIRouter(prefix="/rtc", tags=["RTC"])
MAX_INVITE_CODE_RETRIES = 3


def _rtc_log(action: str, **context: Any) -> None:
    safe_context = {k: v for k, v in context.items() if v is not None}
    print(f"[RTC] {action}: {safe_context}")


def _normalize_recording_status(session: models.RTCSession) -> str:
    if session.recording_status:
        return session.recording_status

    if session.recording_url or session.podcast_id or session.status == "completed":
        return "completed"

    if session.is_live:
        return "live"

    if session.ended_at:
        if session.last_webhook_payload:
            return "failed"
        return "processing"

    return "waiting"


def _event_marks_recording_failed(event_name: Optional[str]) -> bool:
    normalized_event = (event_name or "").strip().lower()
    if not normalized_event:
        return False

    if (
        "fail" in normalized_event
        or "error" in normalized_event
        or "abort" in normalized_event
        or "terminat" in normalized_event
    ):
        return True

    return False


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
    owner_id = current_user.id

    _rtc_log(
        "room.request",
        owner_id=owner_id,
        title=request.title,
        media_mode=request.media_mode,
        category=request.category,
        template_id=template_id,
        has_webhook=bool(request.webhook_url or settings.HMS_WEBHOOK_URL),
    )

    if not template_id:
        _rtc_log("room.rejected", owner_id=owner_id, reason="missing_template_id")
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
                owner_id=owner_id,
                error_type="missing_room_id",
                error="100ms response missing room ID",
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="100ms API returned invalid response (missing room ID)",
            )
        
        session = None
        for _ in range(MAX_INVITE_CODE_RETRIES):
            session = models.RTCSession(
                room_id=room_id,
                room_name=room.get("name") or request.name,
                owner_id=owner_id,
                title=request.title or request.name,
                description=request.description,
                category=request.category or "General",
                is_public=bool(request.is_public) if request.is_public is not None else False,
                media_mode=request.media_mode or "video",
                status="created",
                recording_status="waiting",
                invite_code=generate_invite_code(),
            )
            db.add(session)
            try:
                db.commit()
                db.refresh(session)
                break
            except IntegrityError:
                db.rollback()
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not generate a unique invite code",
            )

        _rtc_log(
            "room.success",
            owner_id=owner_id,
            room_id=room.get("id"),
            room_name=room.get("name"),
            session_id=session.id,
            media_mode=session.media_mode,
        )
    except HTTPException:
        db.rollback()
        raise
    except ValueError as exc:
        db.rollback()
        _rtc_log(
            "room.error",
            owner_id=owner_id,
            error_type="value_error",
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        _rtc_log(
            "room.error",
            owner_id=owner_id,
            error_type="database_error",
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while creating RTC room",
        ) from exc
    except Exception as exc:
        db.rollback()
        _rtc_log(
            "room.error",
            owner_id=owner_id,
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
        invite_code=session.invite_code,
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
        or data.get("recording_presigned_url")
        or data.get("recording_url")
        or recording.get("recording_presigned_url")
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
    background_tasks: BackgroundTasks,
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
            media_type="video" if session.media_mode == "video" else "audio",
            duration=duration_seconds,
            audio_url=recording_url,
            video_url=recording_url if session.media_mode == "video" else None,
        )

        podcast = crud.create_podcast(db, podcast_data, session.owner_id)
        # Fan out new_episode notifications after response — same pattern as
        # the REST create endpoint; rtc.py is a webhook so BackgroundTasks
        # is the right dispatch mechanism here too.
        if podcast.is_public:
            background_tasks.add_task(
                crud.notify_followers_new_episode_background,
                podcast_id=podcast.id,
            )
        session.podcast_id = podcast.id
        session.recording_url = recording_url
        session.duration_seconds = duration_seconds
        session.status = "completed"
        session.recording_status = "completed"
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
    if _event_marks_recording_failed(event_name):
        session.recording_status = "failed"
    else:
        session.recording_status = _normalize_recording_status(session)
    db.commit()
    _rtc_log(
        "webhook.updated_without_recording",
        session_id=session.id,
        room_id=room_id,
        status=session.status,
        recording_status=session.recording_status,
    )
    return {"status": "ok"}


@router.get("/sessions", response_model=list[schemas.RTCSessionResponse])
def list_rtc_sessions(
    room_id: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
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
    safe_offset = max(offset, 0)
    sessions = (
        query
        .order_by(desc(models.RTCSession.created_at), desc(models.RTCSession.id))
        .offset(safe_offset)
        .limit(safe_limit)
        .all()
    )
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


@router.post("/sessions/{session_id}/start", response_model=schemas.RTCSessionResponse)
def start_rtc_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.RTCSessionResponse:
    """Mark a created RTC session as live when the host actually joins."""
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

    return start_session(db, session_id)


@router.post("/sessions/{session_id}/end", response_model=schemas.RTCSessionResponse)
def end_rtc_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.RTCSessionResponse:
    """Mark a live RTC session as ended after the host leaves."""
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

    return end_session(db, session_id)


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


@router.get("/invite/{invite_code}", response_model=schemas_live_session.LiveSessionPreview)
def get_rtc_invite_preview(
    invite_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas_live_session.LiveSessionPreview:
    """Return a lightweight preview for an invited live session."""
    session = (
        db.query(models.RTCSession)
        .filter(models.RTCSession.invite_code == invite_code)
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RTC invite not found",
        )

    owner = db.query(models.User).filter(models.User.id == session.owner_id).first()

    return schemas_live_session.LiveSessionPreview(
        session_id=session.id,
        room_id=session.room_id,
        title=session.title or session.room_name or "Live Session",
        description=session.description,
        owner_name=owner.name if owner else "Unknown host",
        category=session.category,
        media_mode=session.media_mode,
        invite_code=session.invite_code or invite_code,
        is_live=session.is_live,
        is_public=session.is_public,
        participant_count=session.participant_count,
        viewer_count=session.viewer_count,
        status=session.status or "created",
        recording_status=_normalize_recording_status(session),
        recording_state=_normalize_recording_status(session),
        duration_seconds=session.duration_seconds or 0,
        podcast_id=session.podcast_id,
        started_at=session.started_at,
        ended_at=session.ended_at,
    )


@router.post("/join-by-invite", response_model=schemas_live_session.JoinSessionTokenResponse)
async def join_rtc_by_invite(
    request: schemas_live_session.JoinSessionByInviteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas_live_session.JoinSessionTokenResponse:
    """Generate a guest/viewer token using a shareable invite code."""
    if request.role not in {"guest", "viewer"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="role must be 'guest' or 'viewer'",
        )

    session = (
        db.query(models.RTCSession)
        .filter(models.RTCSession.invite_code == request.invite_code)
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RTC invite not found",
        )

    recording_status = _normalize_recording_status(session)
    if session.ended_at or recording_status in {"processing", "completed", "failed"}:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This live session has already ended",
        )

    token = generate_auth_token(
        room_id=session.room_id,
        user_id=str(current_user.id),
        role=request.role,
        expires_in_seconds=86400,
    )

    return schemas_live_session.JoinSessionTokenResponse(
        token=token,
        room_id=session.room_id,
        room_name=session.room_name,
        session_id=session.id,
        media_mode=session.media_mode,
        title=session.title or session.room_name or "Live Session",
        invite_code=session.invite_code or request.invite_code,
        role=request.role,
    )


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
