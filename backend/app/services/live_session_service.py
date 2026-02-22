"""Service for managing live session discovery and participant tracking."""
import secrets
import string
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc

from app import models


def generate_invite_code(length: int = 8) -> str:
    """Generate a short, human-readable invite code."""
    # Use uppercase letters and digits, exclude ambiguous characters
    alphabet = string.ascii_uppercase + string.digits
    alphabet = alphabet.replace('O', '').replace('0', '').replace('I', '').replace('1', '')
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def get_live_sessions(
    db: Session,
    include_private: bool = False,
    category: Optional[str] = None,
    limit: int = 20,
) -> List[models.RTCSession]:
    """Get currently live sessions."""
    query = db.query(models.RTCSession).filter(
        models.RTCSession.is_live.is_(True),
    )
    
    if not include_private:
        query = query.filter(models.RTCSession.is_public == True)
    
    if category:
        query = query.filter(models.RTCSession.category == category)
    
    return query.order_by(desc(models.RTCSession.participant_count)).limit(limit).all()


def get_session_by_invite_code(db: Session, invite_code: str) -> Optional[models.RTCSession]:
    """Get session by invite code."""
    return db.query(models.RTCSession).filter(
        models.RTCSession.invite_code == invite_code
    ).first()


def start_session(db: Session, session_id: int) -> models.RTCSession:
    """Mark session as live (called when first peer joins)."""
    session = db.query(models.RTCSession).filter(models.RTCSession.id == session_id).first()
    if session:
        session.is_live = True
        session.started_at = models.datetime.datetime.now(models.datetime.timezone.utc)
        if not session.invite_code:
            session.invite_code = generate_invite_code()
        db.commit()
        db.refresh(session)
    return session


def end_session(db: Session, session_id: int) -> models.RTCSession:
    """Mark session as ended (called when last peer leaves)."""
    session = db.query(models.RTCSession).filter(models.RTCSession.id == session_id).first()
    if session:
        session.is_live = False
        session.ended_at = models.datetime.datetime.now(models.datetime.timezone.utc)
        db.commit()
        db.refresh(session)
    return session


def add_participant(
    db: Session,
    session_id: int,
    peer_id: str,
    display_name: str,
    role: str,
    user_id: Optional[int] = None,
) -> models.RTCParticipant:
    """Add participant to session."""
    participant = models.RTCParticipant(
        session_id=session_id,
        user_id=user_id,
        peer_id=peer_id,
        display_name=display_name,
        role=role,
        joined_at=models.datetime.datetime.now(models.datetime.timezone.utc),
        is_active=True,
    )
    db.add(participant)
    
    # Update participant count
    session = db.query(models.RTCSession).filter(models.RTCSession.id == session_id).first()
    if session:
        if role == "viewer":
            session.viewer_count += 1
        else:
            session.participant_count += 1
    
    db.commit()
    db.refresh(participant)
    return participant


def remove_participant(db: Session, peer_id: str) -> Optional[models.RTCParticipant]:
    """Mark participant as left."""
    participant = db.query(models.RTCParticipant).filter(
        and_(
            models.RTCParticipant.peer_id == peer_id,
            models.RTCParticipant.is_active == True,
        )
    ).first()
    
    if participant:
        participant.is_active = False
        participant.left_at = models.datetime.datetime.now(models.datetime.timezone.utc)
        
        # Update participant count
        session = db.query(models.RTCSession).filter(
            models.RTCSession.id == participant.session_id
        ).first()
        if session:
            if participant.role == "viewer":
                session.viewer_count = max(0, session.viewer_count - 1)
            else:
                session.participant_count = max(0, session.participant_count - 1)
        
        db.commit()
        db.refresh(participant)
    
    return participant


def get_active_participants(db: Session, session_id: int) -> List[models.RTCParticipant]:
    """Get all active participants in a session."""
    return db.query(models.RTCParticipant).filter(
        and_(
            models.RTCParticipant.session_id == session_id,
            models.RTCParticipant.is_active == True,
        )
    ).all()
