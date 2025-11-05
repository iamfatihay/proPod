from __future__ import annotations
from pydantic import BaseModel, EmailStr
import datetime
from typing import Optional, List, TYPE_CHECKING

if TYPE_CHECKING:
    from .models import User


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    name: str


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None


class User(UserBase):
    id: int
    provider: str = "local"
    photo_url: Optional[str] = None
    is_active: bool = True
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = {'from_attributes': True}


# Podcast Schemas
class PodcastBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "General"
    is_public: bool = True


class PodcastCreate(PodcastBase):
    duration: int = 0  # seconds


class PodcastUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_public: Optional[bool] = None


# AI Processing Schemas
class AIProcessingRequest(BaseModel):
    enhance_audio: bool = True
    transcribe: bool = True
    analyze_content: bool = True
    language: Optional[str] = "auto"


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
    play_count: int
    like_count: int
    bookmark_count: int

    # AI-related fields
    transcription_text: Optional[str] = None
    transcription_language: Optional[str] = None
    transcription_confidence: Optional[str] = None
    ai_keywords: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_sentiment: Optional[str] = None
    ai_categories: Optional[str] = None
    ai_processing_status: str = "pending"
    ai_processing_date: Optional[datetime.datetime] = None
    ai_quality_score: Optional[str] = None

    created_at: datetime.datetime
    updated_at: datetime.datetime
    owner_id: int
    owner: Optional[User] = None

    model_config = {'from_attributes': True}


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

# Success Message Schema


class SuccessMessage(BaseModel):
    message: str
    status: str = "success"

# Error Response Schema


class ErrorResponse(BaseModel):
    detail: str
    status_code: int
    timestamp: datetime.datetime
