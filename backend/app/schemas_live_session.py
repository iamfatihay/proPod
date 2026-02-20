"""API schemas for live session discovery and sharing."""
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


class RTCParticipantBase(BaseModel):
    """Base participant schema."""
    display_name: str
    role: str  # host, guest, viewer


class RTCParticipant(RTCParticipantBase):
    """Participant response schema."""
    id: int
    session_id: int
    user_id: Optional[int]
    peer_id: str
    joined_at: datetime
    left_at: Optional[datetime]
    is_active: bool
    connection_quality: Optional[str]

    class Config:
        from_attributes = True


class LiveSessionSummary(BaseModel):
    """Summary of live session for discovery."""
    id: int
    title: str
    category: str
    owner_name: str
    participant_count: int
    viewer_count: int
    started_at: datetime
    media_mode: str
    invite_code: Optional[str]
    is_public: bool


class JoinSessionRequest(BaseModel):
    """Request to join a session."""
    invite_code: Optional[str] = Field(None, description="Invite code or session ID")
    session_id: Optional[int] = Field(None, description="Direct session ID")
    display_name: str = Field(..., description="Display name in session")
    role: str = Field("viewer", description="Requested role: viewer, guest")


class ShareLink(BaseModel):
    """Shareable link response."""
    invite_code: str
    short_url: str
    full_url: str
    qr_code_url: Optional[str] = None
