"""Database models using SQLAlchemy ORM."""
import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, UniqueConstraint, Index, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from enum import Enum
from .database import Base


class UserRole(str, Enum):
    """User role enumeration for RBAC (Role-Based Access Control)."""
    USER = "user"  # Normal user - can manage own content
    MODERATOR = "moderator"  # Can moderate content, handle reports
    ADMIN = "admin"  # Can manage users and most platform features
    SUPER_ADMIN = "super_admin"  # Full access - application owner


class User(Base):
    """
    User model representing registered users.
    
    Attributes:
        id: Primary key
        email: Unique email address
        name: User's display name
        hashed_password: Bcrypt hashed password
        provider: Authentication provider (local/google)
        photo_url: URL to user's profile photo
        role: User role (user/moderator/admin/super_admin)
        is_active: Whether the user account is active
        is_premium: Whether user has premium subscription (for AI features)
        created_at: Account creation timestamp
        updated_at: Last update timestamp
        reset_token: Password reset token
        reset_token_expires: Reset token expiration time
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=True)  # Nullable for OAuth users
    provider = Column(String, default="local")
    photo_url = Column(String, nullable=True)
    role = Column(SQLEnum(UserRole), default=UserRole.USER, nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    is_premium = Column(Boolean, default=False)  # Premium subscription for AI features
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), 
                       onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    
    # Relationships
    podcasts = relationship("Podcast", back_populates="owner", cascade="all, delete-orphan")
    likes = relationship("PodcastLike", back_populates="user", cascade="all, delete-orphan")
    bookmarks = relationship("PodcastBookmark", back_populates="user", cascade="all, delete-orphan")
    listening_history = relationship("ListeningHistory", back_populates="user", cascade="all, delete-orphan")
    comments = relationship("PodcastComment", back_populates="user", cascade="all, delete-orphan")


class Podcast(Base):
    """
    Podcast model representing podcast episodes.
    
    Attributes:
        id: Primary key
        title: Podcast title
        description: Podcast description
        audio_url: URL to audio file
        thumbnail_url: URL to thumbnail image
        duration: Duration in seconds
        category: Podcast category
        is_public: Whether podcast is publicly visible
        ai_enhanced: Whether AI processing has been applied
        play_count: Total number of plays
        like_count: Total number of likes
        bookmark_count: Total number of bookmarks
        transcription_text: AI-generated transcription
        transcription_language: Detected language
        transcription_confidence: Confidence scores (JSON)
        ai_keywords: Extracted keywords (JSON)
        ai_summary: AI-generated summary
        ai_sentiment: Sentiment analysis result
        ai_categories: AI-detected categories (JSON)
        ai_processing_status: AI processing status
        ai_processing_date: When AI processing completed
        ai_quality_score: Quality assessment score
        created_at: Creation timestamp
        updated_at: Last update timestamp
        owner_id: Foreign key to user
    """
    __tablename__ = "podcasts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    audio_url = Column(String, nullable=True)
    thumbnail_url = Column(String, nullable=True)
    duration = Column(Integer, default=0)
    category = Column(String, default="General")
    is_public = Column(Boolean, default=True)
    ai_enhanced = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), 
                       onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    # Soft delete fields
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime, nullable=True)
    
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    owner = relationship("User", back_populates="podcasts")
    likes = relationship("PodcastLike", back_populates="podcast", cascade="all, delete-orphan")
    bookmarks = relationship("PodcastBookmark", back_populates="podcast", cascade="all, delete-orphan")
    listening_history = relationship("ListeningHistory", back_populates="podcast", cascade="all, delete-orphan")
    comments = relationship("PodcastComment", back_populates="podcast", cascade="all, delete-orphan")
    ai_data = relationship("PodcastAIData", back_populates="podcast", uselist=False, cascade="all, delete-orphan")
    stats = relationship("PodcastStats", back_populates="podcast", uselist=False, cascade="all, delete-orphan")

    # Indexes for performance
    __table_args__ = (
        Index('idx_podcast_category_public', 'category', 'is_public'),
        Index('idx_podcast_owner_created', 'owner_id', 'created_at'),
    )


class PodcastLike(Base):
    __tablename__ = "podcast_likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    podcast_id = Column(Integer, ForeignKey("podcasts.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))

    # Relationships
    user = relationship("User", back_populates="likes")
    podcast = relationship("Podcast", back_populates="likes")

    # Ensure one like per user per podcast
    __table_args__ = (
        UniqueConstraint('user_id', 'podcast_id', name='unique_user_podcast_like'),
        Index('idx_podcast_likes_user', 'user_id'),
        Index('idx_podcast_likes_podcast', 'podcast_id'),
    )


class PodcastBookmark(Base):
    __tablename__ = "podcast_bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    podcast_id = Column(Integer, ForeignKey("podcasts.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))

    # Relationships
    user = relationship("User", back_populates="bookmarks")
    podcast = relationship("Podcast", back_populates="bookmarks")

    # Ensure one bookmark per user per podcast
    __table_args__ = (
        UniqueConstraint('user_id', 'podcast_id', name='unique_user_podcast_bookmark'),
        Index('idx_podcast_bookmarks_user', 'user_id'),
        Index('idx_podcast_bookmarks_podcast', 'podcast_id'),
    )


class ListeningHistory(Base):
    __tablename__ = "listening_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    podcast_id = Column(Integer, ForeignKey("podcasts.id"), nullable=False)
    position = Column(Integer, default=0)  # Last position in seconds
    completed = Column(Boolean, default=False)  # Whether fully listened
    listen_time = Column(Integer, default=0)  # Total listen time in seconds
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))

    # Relationships
    user = relationship("User", back_populates="listening_history")
    podcast = relationship("Podcast", back_populates="listening_history")

    # Ensure one history entry per user per podcast
    __table_args__ = (
        UniqueConstraint('user_id', 'podcast_id', name='unique_user_podcast_history'),
        Index('idx_listening_history_user', 'user_id'),
        Index('idx_listening_history_podcast', 'podcast_id'),
        Index('idx_listening_history_updated', 'updated_at'),
    )


class PodcastComment(Base):
    __tablename__ = "podcast_comments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    podcast_id = Column(Integer, ForeignKey("podcasts.id"), nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(Integer, default=0)  # Comment timestamp in podcast (seconds)
    is_active = Column(Boolean, default=True)  # For soft delete
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))

    # Relationships
    user = relationship("User", back_populates="comments")
    podcast = relationship("Podcast", back_populates="comments")

    # Indexes for performance
    __table_args__ = (
        Index('idx_podcast_comments_podcast_active', 'podcast_id', 'is_active'),
        Index('idx_podcast_comments_user', 'user_id'),
        Index('idx_podcast_comments_timestamp', 'timestamp'),
    )


class PodcastAIData(Base):
    """
    AI-generated data for podcasts (ONE-TO-ONE relationship).
    
    Separated for performance - most podcasts don't have AI processing,
    and when fetching podcast lists, this heavy data is not needed.
    Only loaded when specifically requested via JOIN or separate query.
    """
    __tablename__ = "podcast_ai_data"

    id = Column(Integer, primary_key=True, index=True)
    podcast_id = Column(Integer, ForeignKey("podcasts.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    # Transcription
    transcription_text = Column(Text, nullable=True)
    transcription_language = Column(String, nullable=True)
    transcription_confidence = Column(String, nullable=True)
    
    # AI Analysis
    keywords = Column(Text, nullable=True)  # JSON string
    summary = Column(Text, nullable=True)
    sentiment = Column(String, nullable=True)
    categories = Column(Text, nullable=True)  # JSON string
    quality_score = Column(String, nullable=True)
    
    # Processing metadata
    processing_status = Column(String, default="pending")  # pending, processing, completed, failed
    processing_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), 
                       onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    # Relationship
    podcast = relationship("Podcast", back_populates="ai_data")

    __table_args__ = (
        Index('idx_ai_data_status', 'processing_status'),
    )


class PodcastStats(Base):
    """
    Denormalized statistics cache for podcasts (ONE-TO-ONE relationship).
    
    These are calculated values that would otherwise require expensive
    COUNT queries. Updated via triggers or scheduled jobs.
    Dramatically speeds up home feed and search results.
    """
    __tablename__ = "podcast_stats"

    id = Column(Integer, primary_key=True, index=True)
    podcast_id = Column(Integer, ForeignKey("podcasts.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    # Cached counts
    play_count = Column(Integer, default=0, index=True)
    like_count = Column(Integer, default=0, index=True)
    bookmark_count = Column(Integer, default=0, index=True)
    comment_count = Column(Integer, default=0)
    
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), 
                       onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    # Relationship
    podcast = relationship("Podcast", back_populates="stats")

    __table_args__ = (
        Index('idx_stats_play_count', 'play_count'),
        Index('idx_stats_like_count', 'like_count'),
    )
