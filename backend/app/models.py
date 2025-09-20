import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, UniqueConstraint, Index, JSON
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    hashed_password = Column(String)
    provider = Column(String, default="local")
    photo_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))
    reset_token = Column(String, nullable=True)  # For password reset
    reset_token_expires = Column(DateTime, nullable=True)  # Token expiry
    
    # Relationships
    podcasts = relationship("Podcast", back_populates="owner")
    likes = relationship("PodcastLike", back_populates="user")
    bookmarks = relationship("PodcastBookmark", back_populates="user")
    listening_history = relationship("ListeningHistory", back_populates="user")
    comments = relationship("PodcastComment", back_populates="user")


class Podcast(Base):
    __tablename__ = "podcasts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    audio_url = Column(String, nullable=True)
    thumbnail_url = Column(String, nullable=True)
    duration = Column(Integer, default=0)  # Duration in seconds
    category = Column(String, default="General")
    is_public = Column(Boolean, default=True)
    ai_enhanced = Column(Boolean, default=False)
    play_count = Column(Integer, default=0)
    like_count = Column(Integer, default=0)
    bookmark_count = Column(Integer, default=0)
    
    # AI-related fields
    transcription_text = Column(Text, nullable=True)
    transcription_language = Column(String, nullable=True)
    transcription_confidence = Column(String, nullable=True)  # Store as JSON string
    ai_keywords = Column(Text, nullable=True)  # Store as JSON string
    ai_summary = Column(Text, nullable=True)
    ai_sentiment = Column(String, nullable=True)  # positive/negative/neutral
    ai_categories = Column(Text, nullable=True)  # Store as JSON string
    ai_processing_status = Column(String, default="pending")  # pending/processing/completed/failed
    ai_processing_date = Column(DateTime, nullable=True)
    ai_quality_score = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))
    owner_id = Column(Integer, ForeignKey("users.id"))
    
    # Relationships
    owner = relationship("User", back_populates="podcasts")
    likes = relationship("PodcastLike", back_populates="podcast", cascade="all, delete-orphan")
    bookmarks = relationship("PodcastBookmark", back_populates="podcast", cascade="all, delete-orphan")
    listening_history = relationship("ListeningHistory", back_populates="podcast", cascade="all, delete-orphan")
    comments = relationship("PodcastComment", back_populates="podcast", cascade="all, delete-orphan")

    # Indexes for performance
    __table_args__ = (
        Index('idx_podcast_category_public', 'category', 'is_public'),
        Index('idx_podcast_owner_created', 'owner_id', 'created_at'),
        Index('idx_podcast_play_count', 'play_count'),
    )


class PodcastLike(Base):
    __tablename__ = "podcast_likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    podcast_id = Column(Integer, ForeignKey("podcasts.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

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
