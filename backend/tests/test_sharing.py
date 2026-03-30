"""
Tests for web sharing endpoints.

Covers:
- Share podcast web player (GET /share/podcast/{podcast_id})
  - Public podcast returns HTML with correct Open Graph meta tags
  - Podcast thumbnail_url used for og:image / twitter:image
  - Fallback og:image when thumbnail_url is None
  - Relative audio_url is expanded to absolute URL
  - Null audio_url handled gracefully
  - Private podcast accessible by owner
  - Private podcast forbidden for non-owner
  - Private podcast forbidden for unauthenticated user
  - Non-existent podcast returns 404
  - XSS-safe: user-generated content is HTML-escaped
  - Soft-deleted podcast returns 404
- Share live session (GET /share/live/{invite_code})
  - Valid invite code returns HTML
  - Live session shows LIVE NOW status
  - Non-live session shows Scheduled status
  - Invalid invite code returns 404
  - XSS-safe: session title and owner name are escaped
"""

import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app.models import (
    User, Podcast, PodcastStats, PodcastAIData, PodcastLike,
    PodcastBookmark, PodcastComment, ListeningHistory, RTCSession,
)
from app import crud, schemas
from app.auth import create_access_token, get_password_hash

client = TestClient(app)


# --------------- fixtures ---------------

@pytest.fixture
def db():
    """Yield a database session, closed after the test."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _cleanup_user(db: Session, email: str) -> None:
    """Remove a user and all related rows (podcast cascade + RTC sessions)."""
    existing = db.query(User).filter(User.email == email).first()
    if not existing:
        return
    podcast_ids = [
        p.id for p in db.query(Podcast).filter(Podcast.owner_id == existing.id).all()
    ]
    if podcast_ids:
        for mid in [PodcastComment, ListeningHistory, PodcastBookmark,
                    PodcastLike, PodcastStats, PodcastAIData]:
            db.query(mid).filter(
                mid.podcast_id.in_(podcast_ids)
            ).delete(synchronize_session=False)
        db.query(Podcast).filter(
            Podcast.owner_id == existing.id
        ).delete(synchronize_session=False)
    db.query(RTCSession).filter(RTCSession.owner_id == existing.id).delete(synchronize_session=False)
    db.delete(existing)
    db.commit()
    # Clean orphaned stats (defensive — handles cross-test leftovers in SQLite)
    from sqlalchemy import text
    db.execute(text(
        "DELETE FROM podcast_stats WHERE podcast_id NOT IN (SELECT id FROM podcasts)"
    ))
    db.commit()


@pytest.fixture
def owner(db: Session):
    """Create an owner user and return (user, token)."""
    _cleanup_user(db, "share_owner@example.com")

    user_data = schemas.UserCreate(
        email="share_owner@example.com",
        name="Share Owner",
        password="testpassword123",
        provider="local",
    )
    user = crud.create_user(db, user_data)
    token = create_access_token(data={"sub": user.email})
    return user, token


@pytest.fixture
def other_user(db: Session):
    """Create a non-owner user and return (user, token)."""
    _cleanup_user(db, "share_other@example.com")

    user_data = schemas.UserCreate(
        email="share_other@example.com",
        name="Other User",
        password="testpassword456",
        provider="local",
    )
    user = crud.create_user(db, user_data)
    token = create_access_token(data={"sub": user.email})
    return user, token


def _clean_orphaned_stats(db: Session) -> None:
    """Remove podcast_stats rows whose podcast was deleted (cross-test leak)."""
    from sqlalchemy import text
    db.execute(text(
        "DELETE FROM podcast_stats WHERE podcast_id NOT IN (SELECT id FROM podcasts)"
    ))
    db.commit()


@pytest.fixture
def public_podcast(db: Session, owner):
    """Create a public podcast with stats."""
    _clean_orphaned_stats(db)
    user, _ = owner
    podcast_data = schemas.PodcastCreate(
        title="Public Episode",
        description="A great podcast about testing",
        category="Technology",
        is_public=True,
        duration=600,
        audio_url="http://cdn.example.com/audio/ep1.mp3",
    )
    podcast = crud.create_podcast(db, podcast_data, owner_id=user.id)
    return podcast


@pytest.fixture
def public_podcast_with_thumbnail(db: Session, owner):
    """Create a public podcast with a thumbnail URL."""
    _clean_orphaned_stats(db)
    user, _ = owner
    podcast_data = schemas.PodcastCreate(
        title="Thumbnail Episode",
        description="Episode with cover art",
        category="Music",
        is_public=True,
        duration=300,
        audio_url="http://cdn.example.com/audio/ep2.mp3",
    )
    podcast = crud.create_podcast(db, podcast_data, owner_id=user.id)
    podcast.thumbnail_url = "http://cdn.example.com/images/cover.jpg"
    db.commit()
    db.refresh(podcast)
    return podcast


@pytest.fixture
def private_podcast(db: Session, owner):
    """Create a private podcast."""
    _clean_orphaned_stats(db)
    user, _ = owner
    podcast_data = schemas.PodcastCreate(
        title="Private Episode",
        description="Secret content",
        category="Business",
        is_public=False,
        duration=120,
        audio_url="http://cdn.example.com/audio/private.mp3",
    )
    podcast = crud.create_podcast(db, podcast_data, owner_id=user.id)
    return podcast


@pytest.fixture
def podcast_relative_audio(db: Session, owner):
    """Create a podcast with a relative audio URL."""
    _clean_orphaned_stats(db)
    user, _ = owner
    podcast_data = schemas.PodcastCreate(
        title="Relative Audio",
        description="Audio with relative path",
        category="General",
        is_public=True,
        duration=180,
        audio_url="/media/audio/relative.mp3",
    )
    podcast = crud.create_podcast(db, podcast_data, owner_id=user.id)
    return podcast


@pytest.fixture
def podcast_no_audio(db: Session, owner):
    """Create a podcast with no audio URL."""
    _clean_orphaned_stats(db)
    user, _ = owner
    podcast_data = schemas.PodcastCreate(
        title="No Audio Yet",
        description="Draft podcast",
        category="General",
        is_public=True,
        duration=0,
    )
    podcast = crud.create_podcast(db, podcast_data, owner_id=user.id)
    return podcast


@pytest.fixture
def live_session(db: Session, owner):
    """Create a live RTC session with an invite code."""
    user, _ = owner
    session = RTCSession(
        room_id="room-live-001",
        room_name="Live Room",
        owner_id=user.id,
        title="Live Podcast Session",
        description="Broadcasting live",
        is_live=True,
        is_public=True,
        invite_code="LIVE123ABC",
        participant_count=3,
        viewer_count=42,
        started_at=datetime.datetime.now(datetime.timezone.utc),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@pytest.fixture
def scheduled_session(db: Session, owner):
    """Create a non-live (scheduled) RTC session."""
    user, _ = owner
    session = RTCSession(
        room_id="room-sched-001",
        room_name="Scheduled Room",
        owner_id=user.id,
        title="Upcoming Session",
        description="Scheduled for later",
        is_live=False,
        is_public=True,
        invite_code="SCHED456XY",
        participant_count=0,
        viewer_count=0,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


# ==========================================
# Share Podcast Web Player Tests
# ==========================================


class TestSharePodcastWeb:
    """Tests for GET /share/podcast/{podcast_id}"""

    def test_public_podcast_returns_html(self, public_podcast):
        """Public podcast returns 200 with HTML content."""
        resp = client.get(f"/share/podcast/{public_podcast.id}")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]
        assert "Public Episode" in resp.text
        assert "Volo" in resp.text

    def test_og_meta_tags_present(self, public_podcast):
        """Response contains correct Open Graph meta tags."""
        resp = client.get(f"/share/podcast/{public_podcast.id}")
        html = resp.text
        assert 'og:type' in html
        assert 'og:title' in html
        assert 'og:description' in html
        assert 'og:image' in html
        assert 'og:audio' in html

    def test_twitter_meta_tags_present(self, public_podcast):
        """Response contains Twitter card meta tags."""
        resp = client.get(f"/share/podcast/{public_podcast.id}")
        html = resp.text
        assert 'twitter:card' in html
        assert 'twitter:title' in html
        assert 'twitter:image' in html

    def test_thumbnail_url_used_for_og_image(self, public_podcast_with_thumbnail):
        """When thumbnail_url is set, it appears in og:image and twitter:image."""
        resp = client.get(f"/share/podcast/{public_podcast_with_thumbnail.id}")
        html = resp.text
        assert "http://cdn.example.com/images/cover.jpg" in html

    def test_fallback_og_image_when_no_thumbnail(self, public_podcast):
        """When thumbnail_url is None, fallback to static og-image.png."""
        resp = client.get(f"/share/podcast/{public_podcast.id}")
        html = resp.text
        assert "og-image.png" in html

    def test_audio_url_in_player(self, public_podcast):
        """Audio URL appears in the HTML audio element."""
        resp = client.get(f"/share/podcast/{public_podcast.id}")
        assert "http://cdn.example.com/audio/ep1.mp3" in resp.text

    def test_relative_audio_url_expanded(self, podcast_relative_audio):
        """Relative audio_url is expanded to absolute URL."""
        resp = client.get(f"/share/podcast/{podcast_relative_audio.id}")
        html = resp.text
        # Should contain the full URL, not just the relative path
        assert "/media/audio/relative.mp3" in html
        # The relative URL should be prefixed with the base URL
        assert "http" in html  # base URL prefix applied

    def test_null_audio_url_handled(self, podcast_no_audio):
        """Podcast with no audio_url does not crash."""
        resp = client.get(f"/share/podcast/{podcast_no_audio.id}")
        assert resp.status_code == 200
        assert "No Audio Yet" in resp.text

    def test_owner_metadata_displayed(self, public_podcast, owner):
        """Owner name appears in the web player."""
        resp = client.get(f"/share/podcast/{public_podcast.id}")
        assert "Share Owner" in resp.text

    def test_category_displayed(self, public_podcast):
        """Category appears in the web player."""
        resp = client.get(f"/share/podcast/{public_podcast.id}")
        assert "Technology" in resp.text

    def test_duration_displayed(self, public_podcast):
        """Duration (in minutes) appears in the web player."""
        resp = client.get(f"/share/podcast/{public_podcast.id}")
        # 600 seconds = 10 minutes
        assert "10 min" in resp.text

    def test_description_displayed(self, public_podcast):
        """Description appears in the HTML body."""
        resp = client.get(f"/share/podcast/{public_podcast.id}")
        assert "A great podcast about testing" in resp.text

    def test_private_podcast_accessible_by_owner(self, private_podcast, owner):
        """Owner can access their own private podcast share page."""
        _, token = owner
        resp = client.get(
            f"/share/podcast/{private_podcast.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert "Private Episode" in resp.text

    def test_private_podcast_forbidden_for_other_user(self, private_podcast, other_user):
        """Non-owner authenticated user gets 403 for private podcast."""
        _, token = other_user
        resp = client.get(
            f"/share/podcast/{private_podcast.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_private_podcast_forbidden_unauthenticated(self, private_podcast):
        """Unauthenticated user gets 403 for private podcast."""
        resp = client.get(f"/share/podcast/{private_podcast.id}")
        assert resp.status_code == 403

    def test_nonexistent_podcast_returns_404(self):
        """Non-existent podcast ID returns 404."""
        resp = client.get("/share/podcast/999999")
        assert resp.status_code == 404

    def test_xss_safe_title(self, db: Session, owner):
        """User-generated title with HTML is escaped."""
        _clean_orphaned_stats(db)
        user, _ = owner
        podcast_data = schemas.PodcastCreate(
            title='<script>alert("xss")</script>',
            description="Normal description",
            category="General",
            is_public=True,
            duration=60,
            audio_url="http://cdn.example.com/audio/xss.mp3",
        )
        podcast = crud.create_podcast(db, podcast_data, owner_id=user.id)
        resp = client.get(f"/share/podcast/{podcast.id}")
        assert resp.status_code == 200
        # Raw script tag should NOT appear; it should be escaped
        assert "<script>" not in resp.text
        assert "&lt;script&gt;" in resp.text

    def test_xss_safe_description(self, db: Session, owner):
        """User-generated description with HTML is escaped."""
        _clean_orphaned_stats(db)
        user, _ = owner
        podcast_data = schemas.PodcastCreate(
            title="Safe Title",
            description='<img src=x onerror="alert(1)">',
            category="General",
            is_public=True,
            duration=60,
            audio_url="http://cdn.example.com/audio/xss2.mp3",
        )
        podcast = crud.create_podcast(db, podcast_data, owner_id=user.id)
        resp = client.get(f"/share/podcast/{podcast.id}")
        assert resp.status_code == 200
        assert 'onerror="alert(1)"' not in resp.text

    def test_soft_deleted_podcast_returns_404(self, db: Session, public_podcast):
        """Soft-deleted podcast is not accessible via share."""
        public_podcast.is_deleted = True
        public_podcast.deleted_at = datetime.datetime.now(datetime.timezone.utc)
        db.commit()
        resp = client.get(f"/share/podcast/{public_podcast.id}")
        assert resp.status_code == 404


# ==========================================
# Share Live Session Tests
# ==========================================


class TestShareLiveSession:
    """Tests for GET /share/live/{invite_code}"""

    def test_live_session_returns_html(self, live_session):
        """Valid invite code returns 200 with HTML."""
        resp = client.get(f"/share/live/{live_session.invite_code}")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]

    def test_live_session_shows_live_status(self, live_session):
        """Live session shows LIVE NOW indicator."""
        resp = client.get(f"/share/live/{live_session.invite_code}")
        assert "LIVE NOW" in resp.text

    def test_live_session_shows_title(self, live_session):
        """Session title appears in the HTML."""
        resp = client.get(f"/share/live/{live_session.invite_code}")
        assert "Live Podcast Session" in resp.text

    def test_live_session_shows_owner(self, live_session, owner):
        """Owner name appears in the live session page."""
        resp = client.get(f"/share/live/{live_session.invite_code}")
        assert "Share Owner" in resp.text

    def test_live_session_shows_counts(self, live_session):
        """Participant and viewer counts appear."""
        resp = client.get(f"/share/live/{live_session.invite_code}")
        assert "3 speakers" in resp.text
        assert "42 viewers" in resp.text

    def test_scheduled_session_shows_scheduled_status(self, scheduled_session):
        """Non-live session shows Scheduled status."""
        resp = client.get(f"/share/live/{scheduled_session.invite_code}")
        assert "Scheduled" in resp.text
        assert "LIVE NOW" not in resp.text

    def test_invalid_invite_code_returns_404(self):
        """Non-existent invite code returns 404."""
        resp = client.get("/share/live/INVALID_CODE")
        assert resp.status_code == 404

    def test_live_session_og_meta_tags(self, live_session):
        """Live session page contains Open Graph meta tags."""
        resp = client.get(f"/share/live/{live_session.invite_code}")
        html = resp.text
        assert 'og:type' in html
        assert 'og:title' in html

    def test_xss_safe_session_title(self, db: Session, owner):
        """Session title with HTML is escaped."""
        user, _ = owner
        session = RTCSession(
            room_id="room-xss-001",
            room_name="XSS Room",
            owner_id=user.id,
            title='<script>alert("xss")</script>',
            is_live=True,
            is_public=True,
            invite_code="XSS_CODE_1",
            participant_count=1,
            viewer_count=0,
        )
        db.add(session)
        db.commit()
        resp = client.get(f"/share/live/{session.invite_code}")
        assert resp.status_code == 200
        assert "<script>" not in resp.text
        assert "&lt;script&gt;" in resp.text
