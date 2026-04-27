"""API schemas for live session discovery and sharing."""
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
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

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, value: str) -> str:
        stripped_value = value.strip()
        if not stripped_value:
            raise ValueError("display_name cannot be blank")
        return stripped_value


class JoinSessionByInviteRequest(BaseModel):
    """Request to join a session using a shareable invite code."""
    invite_code: str = Field(..., description="Shareable invite code")
    display_name: str = Field(..., description="Display name in session")
    role: str = Field("viewer", description="Requested role: viewer, guest")

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, value: str) -> str:
        stripped_value = value.strip()
        if not stripped_value:
            raise ValueError("display_name cannot be blank")
        return stripped_value


class ShareLink(BaseModel):
    """Shareable link response."""
    invite_code: str
    short_url: str
    full_url: str
    qr_code_url: Optional[str] = None


class LiveSessionPreview(BaseModel):
    """Preview data for an invited live session before joining."""
    session_id: int
    room_id: str
    title: str
    description: Optional[str] = None
    owner_name: str
    category: Optional[str] = None
    media_mode: str
    invite_code: str
    is_live: bool
    is_public: bool
    participant_count: int = 0
    viewer_count: int = 0


class JoinSessionTokenResponse(BaseModel):
    """Join response containing the 100ms token and room metadata."""
    token: str
    room_id: str
    room_name: Optional[str] = None
    session_id: int
    media_mode: str
    title: str
    invite_code: str
    role: str
