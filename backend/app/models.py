"""Database models using SQLAlchemy ORM."""
import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, UniqueConstraint, Index, Enum as SQLEnum, Float
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
    storage_used_mb = Column(Integer, default=0, nullable=False)  # Storage quota tracking (MB)
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
    playlists = relationship("Playlist", back_populates="owner", cascade="all, delete-orphan")
    # Following relationships — who this user follows and who follows them
    following = relationship("UserFollow", foreign_keys="UserFollow.follower_id", back_populates="follower", cascade="all, delete-orphan")
    followers = relationship("UserFollow", foreign_keys="UserFollow.followed_id", back_populates="followed", cascade="all, delete-orphan")
    # DM relationships — messages sent and received
    sent_messages = relationship("DirectMessage", foreign_keys="DirectMessage.sender_id", back_populates="sender", cascade="all, delete-orphan")
    received_messages = relationship("DirectMessage", foreign_keys="DirectMessage.recipient_id", back_populates="recipient", cascade="all, delete-orphan")


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


class RTCSession(Base):
    """
    RTC session metadata for multi-host live podcast sessions.

    Stores session details needed to map 100ms recording webhooks to
    podcast creation without client-side uploads.
    """
    __tablename__ = "rtc_sessions"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(String, unique=True, index=True, nullable=False)
    room_name = Column(String, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    title = Column(String, nullable=True)
    description = Column(String, nullable=True)
    category = Column(String, default="General")
    is_public = Column(Boolean, default=False)
    media_mode = Column(String, default="video")  # audio | video

    status = Column(String, default="created")
    recording_url = Column(String, nullable=True)
    duration_seconds = Column(Integer, default=0)
    podcast_id = Column(Integer, ForeignKey("podcasts.id"), nullable=True, index=True)
    last_webhook_payload = Column(Text, nullable=True)

    # Phase 2-4: Live session tracking
    is_live = Column(Boolean, default=False, nullable=False)  # Currently broadcasting
    started_at = Column(DateTime, nullable=True)  # When broadcast started
    ended_at = Column(DateTime, nullable=True)  # When broadcast ended
    participant_count = Column(Integer, default=0, nullable=False)  # Active participants
    viewer_count = Column(Integer, default=0, nullable=False)  # Active viewers
    invite_code = Column(String(12), unique=True, nullable=True, index=True)  # Shareable invite code

    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc),
                       onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))

    owner = relationship("User", foreign_keys=[owner_id])
    podcast = relationship("Podcast", foreign_keys=[podcast_id])

    __table_args__ = (
        Index('idx_rtc_sessions_owner_created', 'owner_id', 'created_at'),
        Index('idx_rtc_sessions_live', 'is_live', 'is_public', 'created_at'),  # Live session discovery
    )


class RTCParticipant(Base):
    """
    Tracks participants in RTC sessions for live podcast recordings.
    
    Supports both authenticated users and anonymous viewers.
    Used for participant lists, viewer counts, and connection quality monitoring.
    """
    __tablename__ = "rtc_participants"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("rtc_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)  # Null for anonymous
    peer_id = Column(String, nullable=False, index=True)  # 100ms peer ID
    display_name = Column(String, nullable=False)  # User's display name
    role = Column(String, nullable=False)  # host, guest, viewer
    
    joined_at = Column(DateTime, nullable=False, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    left_at = Column(DateTime, nullable=True)  # Null while active
    is_active = Column(Boolean, default=True, nullable=False)  # Currently in session
    connection_quality = Column(String, nullable=True)  # poor, fair, good, excellent
    
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    # Relationships
    session = relationship("RTCSession", foreign_keys=[session_id])
    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        Index('idx_rtc_participants_session_active', 'session_id', 'is_active'),
        Index('idx_rtc_participants_user', 'user_id'),
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


class Playlist(Base):
    """
    User-created playlist for organizing podcasts.

    Attributes:
        id: Primary key
        name: Playlist name
        description: Optional playlist description
        is_public: Whether the playlist is publicly visible
        owner_id: Foreign key to the user who created the playlist
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    __tablename__ = "playlists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_public = Column(Boolean, default=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc),
                       onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))

    # Relationships
    owner = relationship("User", back_populates="playlists")
    items = relationship("PlaylistItem", back_populates="playlist", cascade="all, delete-orphan",
                        order_by="PlaylistItem.position")

    __table_args__ = (
        Index('idx_playlist_owner', 'owner_id'),
        Index('idx_playlist_public', 'is_public'),
    )


class PlaylistItem(Base):
    """
    Association between a playlist and a podcast, with ordering.

    Attributes:
        id: Primary key
        playlist_id: Foreign key to playlist
        podcast_id: Foreign key to podcast
        position: Order of the podcast in the playlist (0-indexed)
        added_at: When the podcast was added to the playlist
    """
    __tablename__ = "playlist_items"

    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False)
    podcast_id = Column(Integer, ForeignKey("podcasts.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, nullable=False, default=0)
    added_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    # Relationships
    playlist = relationship("Playlist", back_populates="items")
    podcast = relationship("Podcast")

    __table_args__ = (
        UniqueConstraint('playlist_id', 'podcast_id', name='unique_playlist_podcast'),
        Index('idx_playlist_item_playlist', 'playlist_id'),
        Index('idx_playlist_item_podcast', 'podcast_id'),
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
    transcription_confidence = Column(Float, nullable=True)  # Fixed: Was String, should be Float
    
    # AI Analysis
    keywords = Column(Text, nullable=True)  # JSON string
    summary = Column(Text, nullable=True)
    sentiment = Column(String, nullable=True)
    categories = Column(Text, nullable=True)  # JSON string
    quality_score = Column(Float, nullable=True)  # Fixed: Was String, should be Float
    
    # Processing metadata
    processing_status = Column(String, default="pending")  # pending, processing, completed, failed
    processing_date = Column(DateTime, nullable=True)
    processing_time_seconds = Column(Float, nullable=True)  # Total processing time in seconds
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


class Notification(Base):
    """
    In-app notification for a user.

    Represents server-side events such as:
    - Someone liked a podcast you own
    - Someone commented on a podcast you own

    The recipient is always the podcast owner.  Device-side events
    (AI processing complete) are stored locally on-device only and are
    NOT persisted here.
    """
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    # Recipient of the notification
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Optional reference to the podcast that triggered this notification
    podcast_id = Column(Integer, ForeignKey("podcasts.id", ondelete="CASCADE"), nullable=True)

    # Optional reference to the actor (who liked / commented)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Notification type: 'like' | 'comment' | 'system'
    type = Column(String(32), nullable=False)

    # Human-readable content
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)

    # State
    read = Column(Boolean, default=False, nullable=False)

    created_at = Column(
        DateTime,
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    actor = relationship("User", foreign_keys=[actor_id])
    podcast = relationship("Podcast")

    __table_args__ = (
        Index("idx_notifications_user_read", "user_id", "read"),
        Index("idx_notifications_created", "created_at"),
    )


class UserFollow(Base):
    """
    Tracks which users follow which creators.

    follower: the user who pressed "Follow"
    followed: the creator being followed
    """
    __tablename__ = "user_follows"

    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    followed_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(
        DateTime,
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
    )

    # Relationships
    follower = relationship("User", foreign_keys=[follower_id], back_populates="following")
    followed = relationship("User", foreign_keys=[followed_id], back_populates="followers")

    __table_args__ = (
        # One follow per (follower, followed) pair
        UniqueConstraint("follower_id", "followed_id", name="unique_user_follow"),
        Index("idx_user_follows_follower", "follower_id"),
        Index("idx_user_follows_followed", "followed_id"),
    )


class DirectMessage(Base):
    """
    Direct message sent from one user to another.

    A conversation between two users is defined by the (sender_id, recipient_id)
    pair, regardless of direction.  All messages between user A and user B share
    the same logical thread; the client groups them by the *partner* user.
    """
    __tablename__ = "direct_messages"

    id = Column(Integer, primary_key=True, index=True)

    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Message content (max 2 000 chars enforced at API layer)
    body = Column(Text, nullable=False)

    # Has the recipient seen this message?
    is_read = Column(Boolean, default=False, nullable=False)

    created_at = Column(
        DateTime,
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        nullable=False,
    )

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    recipient = relationship("User", foreign_keys=[recipient_id], back_populates="received_messages")

    __table_args__ = (
        # Efficient lookup of the conversation thread for two users
        Index("idx_dm_sender_recipient", "sender_id", "recipient_id"),
        Index("idx_dm_recipient_read", "recipient_id", "is_read"),
        Index("idx_dm_created", "created_at"),
    )
