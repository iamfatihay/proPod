"""Pydantic schemas for request/response validation."""
from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field, ConfigDict
import datetime
from typing import Optional, List, TYPE_CHECKING
from enum import Enum

if TYPE_CHECKING:
    from .models import User


# ==================== Enums ====================

class UserRoleSchema(str, Enum):
    """User role schema for API responses."""
    USER = "user"
    MODERATOR = "moderator"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


# ==================== User Schemas ====================

class UserBase(BaseModel):
    """Base user schema with common fields."""
    email: EmailStr
    name: str


class UserCreate(UserBase):
    """
    Schema for user registration.

    Note: Password is optional for OAuth users (e.g., Google login)
    For local users, password validation is enforced at the endpoint level.
    """
    password: Optional[str] = None
    provider: str = "local"


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """Schema for updating user profile."""
    name: Optional[str] = None


class User(UserBase):
    """User response schema."""
    id: int
    provider: str = "local"
    photo_url: Optional[str] = None
    role: UserRoleSchema = UserRoleSchema.USER
    is_active: bool = True
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = {'from_attributes': True}


# ==================== Podcast Schemas ====================

class PodcastBase(BaseModel):
    """Base podcast schema with common fields."""
    title: str = Field(..., min_length=1, max_length=200,
                       description="Podcast title")
    description: Optional[str] = Field(
        None, max_length=2000, description="Podcast description")
    category: str = Field(default="General", description="Podcast category")
    is_public: bool = Field(
        default=True, description="Whether podcast is publicly visible")


class PodcastCreate(PodcastBase):
    """Schema for creating a new podcast."""
    duration: int = Field(default=0, ge=0, description="Duration in seconds")
    audio_url: Optional[str] = Field(None, description="URL to the audio file")
    thumbnail_url: Optional[str] = Field(
        None, description="URL to the thumbnail image")


class PodcastUpdate(BaseModel):
    """Schema for updating podcast information."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    category: Optional[str] = None
    is_public: Optional[bool] = None


# ==================== AI Processing Schemas ====================

class AIProcessingRequest(BaseModel):
    """Schema for requesting AI processing on a podcast."""
    enhance_audio: bool = Field(
        default=True, description="Apply audio enhancement")
    transcribe: bool = Field(
        default=True, description="Generate transcription")
    analyze_content: bool = Field(default=True, description="Analyze content")
    language: Optional[str] = Field(
        default="auto", description="Language code or 'auto' for detection")


class TranscriptionResult(BaseModel):
    success: bool
    text: str
    language: str
    language_probability: float
    segments: List[dict] = []
    words: List[dict] = []
    duration: float
    processing_time: float
    model_used: str


class ContentAnalysisResult(BaseModel):
    success: bool
    text_stats: dict
    keywords: List[dict] = []
    categories: List[dict] = []
    summary: str
    sentiment: dict
    topics: List[dict] = []
    readability: dict


class AudioEnhancementResult(BaseModel):
    success: bool
    stats: dict
    processing_steps: List[str] = []


class AIProcessingResult(BaseModel):
    success: bool
    processing_time: float
    transcription: Optional[TranscriptionResult] = None
    analysis: Optional[ContentAnalysisResult] = None
    audio_enhancement: Optional[AudioEnhancementResult] = None
    errors: List[str] = []


class Podcast(PodcastBase):
    id: int
    audio_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration: int
    ai_enhanced: bool
    play_count: int = 0  # From stats relationship
    like_count: int = 0  # From stats relationship
    bookmark_count: int = 0  # From stats relationship

    # AI-related fields (from ai_data relationship)
    transcription_text: Optional[str] = None
    transcription_language: Optional[str] = None
    transcription_confidence: Optional[float] = None
    ai_keywords: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_sentiment: Optional[str] = None
    ai_categories: Optional[str] = None
    ai_processing_status: str = "pending"
    ai_processing_date: Optional[datetime.datetime] = None
    ai_quality_score: Optional[float] = None

    created_at: datetime.datetime
    updated_at: datetime.datetime
    owner_id: int
    owner: Optional[User] = None

    model_config = {'from_attributes': True}


# ==================== RTC Schemas ====================

class RTCTokenRequest(BaseModel):
    """Request schema for generating a 100ms auth token."""
    room_id: str = Field(..., description="100ms room ID")
    role: str = Field(default="host", description="100ms role to join as")
    # user_id removed: always use authenticated user to prevent impersonation
    expires_in_seconds: int = Field(
        default=86400,
        ge=300,
        le=604800,
        description="Token validity in seconds"
    )


class RTCTokenResponse(BaseModel):
    """Response schema for generated 100ms auth token."""
    token: str
    room_id: str
    role: str
    user_id: str
    expires_in_seconds: int


class RTCRoomCreateRequest(BaseModel):
    """Request schema for creating a 100ms room via REST API."""
    name: Optional[str] = Field(None, description="Room name")
    description: Optional[str] = Field(None, description="Room description")
    title: Optional[str] = Field(None, description="Podcast title")
    category: Optional[str] = Field(None, description="Podcast category")
    is_public: Optional[bool] = Field(None, description="Whether podcast is public")
    media_mode: Optional[str] = Field(None, description="audio or video")
    template_id: Optional[str] = Field(None, description="100ms template ID")
    region: Optional[str] = Field(None, description="Room region (us, eu, in, auto)")
    size: Optional[int] = Field(None, ge=0, le=2500, description="Max peers")
    max_duration_seconds: Optional[int] = Field(
        None,
        ge=120,
        le=43200,
        description="Max room duration in seconds"
    )
    webhook_url: Optional[str] = Field(None, description="Room-level webhook URL")
    webhook_headers: Optional[dict] = Field(
        None,
        description="Custom headers for room-level webhook"
    )


class RTCRoomCreateResponse(BaseModel):
    """Response schema for room creation."""
    id: str
    name: str
    enabled: bool
    template_id: Optional[str] = None
    region: Optional[str] = None
    session_id: Optional[int] = None


class RTCSessionResponse(BaseModel):
    """Response schema for RTC session status."""
    id: int
    room_id: str
    room_name: Optional[str] = None
    owner_id: int
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_public: bool
    media_mode: str
    status: str
    recording_url: Optional[str] = None
    duration_seconds: int
    podcast_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# Google Login Schema
class GoogleLoginRequest(BaseModel):
    email: EmailStr
    name: str
    provider: str
    photo_url: Optional[str] = None


# Token Schemas
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# Podcast Interaction Schemas
class PodcastLikeCreate(BaseModel):
    podcast_id: int


class PodcastLike(BaseModel):
    id: int
    user_id: int
    podcast_id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    user: Optional[User] = None
    podcast: Optional[Podcast] = None

    model_config = {'from_attributes': True}


class PodcastBookmarkCreate(BaseModel):
    podcast_id: int


class PodcastBookmark(BaseModel):
    id: int
    user_id: int
    podcast_id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    user: Optional[User] = None
    podcast: Optional[Podcast] = None

    model_config = {'from_attributes': True}


# Listening History Schemas
class ListeningHistoryUpdate(BaseModel):
    position: int
    listen_time: Optional[int] = None
    completed: Optional[bool] = None


class ListeningHistory(BaseModel):
    id: int
    user_id: int
    podcast_id: int
    position: int
    completed: bool
    listen_time: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    user: Optional[User] = None
    podcast: Optional[Podcast] = None

    model_config = {'from_attributes': True}


# Comment Schemas
class PodcastCommentCreate(BaseModel):
    podcast_id: int
    content: str
    timestamp: int = 0  # Timestamp in podcast (seconds)


class PodcastCommentUpdate(BaseModel):
    content: Optional[str] = None
    timestamp: Optional[int] = None


class PodcastComment(BaseModel):
    id: int
    user_id: int
    podcast_id: int
    content: str
    timestamp: int
    is_active: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    user: Optional[User] = None
    podcast: Optional[Podcast] = None

    model_config = {'from_attributes': True}


# Analytics Schemas
class PodcastAnalytics(BaseModel):
    total_plays: int
    total_likes: int
    total_bookmarks: int
    total_comments: int
    average_listen_time: float
    completion_rate: float
    top_listeners: List[User]


class UserInteractions(BaseModel):
    is_liked: bool
    is_bookmarked: bool
    listening_history: Optional[ListeningHistory] = None


# Search and Filter Schemas
class PodcastSearchRequest(BaseModel):
    query: Optional[str] = None
    category: Optional[str] = None
    owner_id: Optional[int] = None
    is_public: Optional[bool] = True
    limit: int = 20
    offset: int = 0


class PodcastListResponse(BaseModel):
    podcasts: List[Podcast]
    total: int
    limit: int
    offset: int
    has_more: bool


# Upload Response Schema
class AudioUploadResponse(BaseModel):
    audio_url: str
    file_size: int
    content_type: str
    filename: str


# AI Data Response Schema
class PodcastAIDataResponse(BaseModel):
    id: int
    podcast_id: int
    transcription_text: Optional[str] = None
    transcription_language: Optional[str] = None
    transcription_confidence: Optional[float] = None
    keywords: List[str] = []
    summary: Optional[str] = None
    sentiment: Optional[str] = None
    categories: List[str] = []
    quality_score: Optional[float] = None
    processing_time_seconds: Optional[float] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# Success Message Schema


class SuccessMessage(BaseModel):
    message: str
    status: str = "success"

# Error Response Schema


class ErrorResponse(BaseModel):
    detail: str
    status_code: int
    timestamp: datetime.datetime
