"""
Tests for the Web Sharing endpoints.

Covers:
- GET /share/podcast/{podcast_id} (web player for shared podcasts)
- GET /share/live/{invite_code} (web page for joining live sessions)
- Public podcast accessibility without authentication
- Private podcast access control (owner only)
- 404 for non-existent podcasts and sessions
- HTML response content validation (OG tags, titles, metadata)
- XSS prevention in user-generated content
- Audio URL construction (relative vs absolute)
- Bug fix verification: thumbnail_url used instead of non-existent cover_image_url
"""
import datetime
from datetime import timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app import models, auth
from app.auth import get_password_hash

# ---------------------------------------------------------------------------
# Test database setup — in-memory SQLite (no file artifacts, no conflicts)
# ---------------------------------------------------------------------------
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_user(db, email="test@example.com", name="Test User") -> models.User:
    """Create a user directly in the database.

    Uses the shared get_password_hash helper instead of instantiating a
    new CryptContext per call, which avoids redundant bcrypt work in tests
    where password validation is never exercised.
    """
    user = models.User(
        email=email,
        name=name,
        hashed_password=get_password_hash("testpass123"),
        provider="local",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_header(user: models.User) -> dict:
    """Generate a valid Bearer token header for the given user."""
    token = auth.create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


def _create_podcast(
    db,
    owner_id: int,
    title: str = "Test Podcast",
    description: str = "A test podcast description",
    category: str = "Technology",
    is_public: bool = True,
    is_deleted: bool = False,
    audio_url: str = "/media/audio/test.mp3",
    duration: int = 300,
    thumbnail_url: str = None,
) -> models.Podcast:
    """Create a podcast with its stats entry."""
    podcast = models.Podcast(
        title=title,
        description=description,
        category=category,
        is_public=is_public,
        owner_id=owner_id,
        audio_url=audio_url,
        duration=duration,
        thumbnail_url=thumbnail_url,
        is_deleted=is_deleted,
        deleted_at=datetime.datetime.now(timezone.utc) if is_deleted else None,
    )
    db.add(podcast)
    db.flush()

    stats = models.PodcastStats(
        podcast_id=podcast.id,
        play_count=0,
        like_count=0,
        bookmark_count=0,
        comment_count=0,
    )
    db.add(stats)
    db.commit()
    db.refresh(podcast)
    return podcast


def _create_rtc_session(
    db,
    owner_id: int,
    title: str = "Live Session",
    invite_code: str = "ABC123",
    is_live: bool = True,
    is_public: bool = True,
    participant_count: int = 3,
    viewer_count: int = 10,
    room_id: str = "room_001",
) -> models.RTCSession:
    """Create an RTC session directly in the database."""
    session = models.RTCSession(
        room_id=room_id,
        owner_id=owner_id,
        title=title,
        invite_code=invite_code,
        is_live=is_live,
        is_public=is_public,
        participant_count=participant_count,
        viewer_count=viewer_count,
        status="live" if is_live else "created",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    """Create tables once for this test module and override get_db.

    Using module scope ensures the dependency override is cleaned up after
    test_sharing.py finishes, preventing DB bleed into subsequent test files
    (test_update_profile, test_user_auth, test_user_photo_upload) which use
    the file-based test_app.db via the real get_db dependency.

    Data isolation between individual tests is handled by the function-scoped
    ``clean_tables`` fixture below.
    """
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def clean_tables():
    """Truncate all rows between tests for isolation without recreating schema."""
    yield
    session = TestSessionLocal()
    try:
        for table in reversed(Base.metadata.sorted_tables):
            session.execute(table.delete())
        session.commit()
    finally:
        session.close()


@pytest.fixture
def db():
    """Provide a fresh database session for helper calls inside tests."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Tests – share podcast: public access
# ---------------------------------------------------------------------------

class TestSharePodcastPublic:
    """Public podcasts should be accessible without authentication."""

    def test_public_podcast_returns_html(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, title="My Public Podcast")

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]

    def test_html_contains_podcast_title(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, title="Amazing Episode")

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert resp.status_code == 200
        assert "Amazing Episode" in resp.text

    def test_html_title_tag_includes_volo(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, title="My Show")

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert "<title>My Show - Volo</title>" in resp.text

    def test_html_contains_owner_name(self, db):
        user = _create_user(db, name="Jane Creator")
        podcast = _create_podcast(db, user.id)

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert "Jane Creator" in resp.text

    def test_html_contains_category(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, category="Science")

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert "Science" in resp.text

    def test_html_contains_duration_in_minutes(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, duration=600)  # 10 minutes

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert "10 min" in resp.text

    def test_html_contains_description(self, db):
        user = _create_user(db)
        podcast = _create_podcast(
            db, user.id, description="This is an awesome podcast about coding."
        )

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert "This is an awesome podcast about coding." in resp.text

    def test_html_contains_audio_element_with_controls(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, audio_url="/media/audio/episode1.mp3")

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert "<audio" in resp.text
        assert "controls" in resp.text

    def test_html_contains_og_tags(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, title="OG Test Podcast")

        resp = client.get(f"/share/podcast/{podcast.id}")
        html_text = resp.text
        assert 'og:title' in html_text
        assert 'og:description' in html_text
        assert 'og:type' in html_text
        assert 'og:audio' in html_text
        assert 'og:image' in html_text
        assert 'og:url' in html_text

    def test_og_type_is_music_song(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id)

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert 'content="music.song"' in resp.text

    def test_html_contains_twitter_tags(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, title="Twitter Card Test")

        resp = client.get(f"/share/podcast/{podcast.id}")
        html_text = resp.text
        assert 'twitter:card' in html_text
        assert 'twitter:title' in html_text
        assert 'twitter:description' in html_text
        assert 'twitter:image' in html_text
        assert 'twitter:player' in html_text

    def test_twitter_card_type_is_player(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id)

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert 'content="player"' in resp.text

    def test_relative_audio_url_gets_base_url_prefix(self, db):
        user = _create_user(db)
        podcast = _create_podcast(
            db, user.id, audio_url="/media/audio/test_relative.mp3"
        )

        resp = client.get(f"/share/podcast/{podcast.id}")
        # The relative URL should be prefixed with base URL in audio element
        assert "http://localhost:8000/media/audio/test_relative.mp3" in resp.text

    def test_absolute_audio_url_unchanged(self, db):
        user = _create_user(db)
        podcast = _create_podcast(
            db, user.id, audio_url="https://cdn.example.com/audio/ep1.mp3"
        )

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert "https://cdn.example.com/audio/ep1.mp3" in resp.text


# ---------------------------------------------------------------------------
# Tests – share podcast: thumbnail / og:image
# ---------------------------------------------------------------------------

class TestSharePodcastThumbnail:
    """Verify og:image uses thumbnail_url correctly (bug fix regression test)."""

    def test_thumbnail_url_used_in_og_image(self, db):
        user = _create_user(db)
        podcast = _create_podcast(
            db, user.id, thumbnail_url="https://cdn.example.com/thumb.jpg"
        )

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert "https://cdn.example.com/thumb.jpg" in resp.text

    def test_fallback_og_image_when_no_thumbnail(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, thumbnail_url=None)

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert "/static/og-image.png" in resp.text


# ---------------------------------------------------------------------------
# Tests – share podcast: 404 cases
# ---------------------------------------------------------------------------

class TestSharePodcastNotFound:
    """Non-existent or deleted podcasts should return 404."""

    def test_nonexistent_podcast_returns_404(self):
        resp = client.get("/share/podcast/99999")
        assert resp.status_code == 404

    def test_deleted_podcast_returns_404(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, is_deleted=True)

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Tests – share podcast: private access control
# ---------------------------------------------------------------------------

class TestSharePodcastPrivateAccess:
    """Private podcasts should only be accessible to their owner."""

    def test_private_podcast_without_auth_returns_403(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, is_public=False)

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert resp.status_code == 403

    def test_private_podcast_with_owner_auth_returns_200(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, is_public=False)

        resp = client.get(
            f"/share/podcast/{podcast.id}", headers=_auth_header(user)
        )
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]

    def test_private_podcast_with_other_user_auth_returns_403(self, db):
        owner = _create_user(db, email="owner@example.com", name="Owner")
        other = _create_user(db, email="other@example.com", name="Other")
        podcast = _create_podcast(db, owner.id, is_public=False)

        resp = client.get(
            f"/share/podcast/{podcast.id}", headers=_auth_header(other)
        )
        assert resp.status_code == 403

    def test_authenticated_access_to_public_podcast(self, db):
        """Authenticated users should also be able to access public podcasts."""
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, is_public=True)

        resp = client.get(
            f"/share/podcast/{podcast.id}", headers=_auth_header(user)
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Tests – share podcast: XSS prevention
# ---------------------------------------------------------------------------

class TestSharePodcastXSS:
    """User-generated content must be escaped to prevent XSS."""

    def test_title_is_html_escaped(self, db):
        user = _create_user(db)
        podcast = _create_podcast(
            db, user.id, title='<script>alert("xss")</script>'
        )

        resp = client.get(f"/share/podcast/{podcast.id}")
        html_text = resp.text
        # The raw script tag should NOT appear
        assert '<script>alert("xss")</script>' not in html_text
        # Escaped version should appear
        assert "&lt;script&gt;" in html_text

    def test_description_is_html_escaped(self, db):
        user = _create_user(db)
        podcast = _create_podcast(
            db, user.id, description='<img src=x onerror="alert(1)">'
        )

        resp = client.get(f"/share/podcast/{podcast.id}")
        html_text = resp.text
        # Raw img tag should be escaped
        assert "<img src=x" not in html_text
        assert "&lt;img" in html_text

    def test_owner_name_is_html_escaped(self, db):
        user = _create_user(db, name='<b>Hacker</b>')
        podcast = _create_podcast(db, user.id)

        resp = client.get(f"/share/podcast/{podcast.id}")
        html_text = resp.text
        assert "<b>Hacker</b>" not in html_text
        assert "&lt;b&gt;Hacker&lt;/b&gt;" in html_text

    def test_category_is_html_escaped(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, category='<div onclick="evil()">')

        resp = client.get(f"/share/podcast/{podcast.id}")
        html_text = resp.text
        assert '<div onclick="evil()">' not in html_text
        assert "&lt;div" in html_text


# ---------------------------------------------------------------------------
# Tests – share podcast: edge cases
# ---------------------------------------------------------------------------

class TestSharePodcastEdgeCases:
    """Edge cases for podcast sharing."""

    def test_podcast_without_description(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, description=None)

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert resp.status_code == 200
        # Default OG description should be used when no description
        assert "Listen to this podcast on Volo" in resp.text
        # Description paragraph should not be rendered
        assert 'class="description"' not in resp.text

    def test_podcast_with_empty_description(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, description="")

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert resp.status_code == 200
        # Empty string is falsy, so OG fallback should apply
        assert "Listen to this podcast on Volo" in resp.text

    def test_podcast_with_zero_duration(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, duration=0)

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert resp.status_code == 200
        assert "0 min" in resp.text

    def test_podcast_with_long_duration(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id, duration=7200)  # 2 hours

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert "120 min" in resp.text

    def test_cta_buttons_present(self, db):
        user = _create_user(db)
        podcast = _create_podcast(db, user.id)

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert "Open in Volo App" in resp.text
        assert "Download Volo" in resp.text


# ---------------------------------------------------------------------------
# Tests – share live session: basic access
# ---------------------------------------------------------------------------

class TestShareLiveSession:
    """Live session sharing page should return proper HTML."""

    def test_live_session_returns_html(self, db):
        user = _create_user(db)
        _create_rtc_session(db, user.id, invite_code="LIVE001")

        resp = client.get("/share/live/LIVE001")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]

    def test_html_contains_session_title(self, db):
        user = _create_user(db)
        _create_rtc_session(
            db, user.id, title="Friday Night Tech Talk", invite_code="FRI001"
        )

        resp = client.get("/share/live/FRI001")
        assert "Friday Night Tech Talk" in resp.text

    def test_html_title_includes_volo_live(self, db):
        user = _create_user(db)
        _create_rtc_session(db, user.id, title="My Show", invite_code="TITLE1")

        resp = client.get("/share/live/TITLE1")
        assert "My Show - Volo Live" in resp.text

    def test_html_contains_host_name(self, db):
        user = _create_user(db, name="DJ Master")
        _create_rtc_session(db, user.id, invite_code="HOST01")

        resp = client.get("/share/live/HOST01")
        assert "DJ Master" in resp.text

    def test_live_session_shows_live_status(self, db):
        user = _create_user(db)
        _create_rtc_session(db, user.id, is_live=True, invite_code="LIVNOW")

        resp = client.get("/share/live/LIVNOW")
        assert "LIVE NOW" in resp.text

    def test_scheduled_session_shows_scheduled_status(self, db):
        user = _create_user(db)
        _create_rtc_session(db, user.id, is_live=False, invite_code="SCHED1")

        resp = client.get("/share/live/SCHED1")
        assert "Scheduled" in resp.text

    def test_html_contains_participant_and_viewer_counts(self, db):
        user = _create_user(db)
        _create_rtc_session(
            db, user.id,
            participant_count=5,
            viewer_count=42,
            invite_code="CNTS01",
        )

        resp = client.get("/share/live/CNTS01")
        html_text = resp.text
        assert "5 speakers" in html_text
        assert "42 viewers" in html_text

    def test_html_contains_og_tags(self, db):
        user = _create_user(db)
        _create_rtc_session(db, user.id, invite_code="OGTAG1")

        resp = client.get("/share/live/OGTAG1")
        html_text = resp.text
        assert 'og:title' in html_text
        assert 'og:type' in html_text
        assert 'og:url' in html_text
        assert 'og:description' in html_text

    def test_og_type_is_website(self, db):
        user = _create_user(db)
        _create_rtc_session(db, user.id, invite_code="OGTYP1")

        resp = client.get("/share/live/OGTYP1")
        assert 'content="website"' in resp.text

    def test_join_cta_present(self, db):
        user = _create_user(db)
        _create_rtc_session(db, user.id, invite_code="CTA001")

        resp = client.get("/share/live/CTA001")
        assert "Join Live Session" in resp.text

    def test_download_prompt_present(self, db):
        user = _create_user(db)
        _create_rtc_session(db, user.id, invite_code="DWN001")

        resp = client.get("/share/live/DWN001")
        assert "Download now" in resp.text


# ---------------------------------------------------------------------------
# Tests – share live session: 404 cases
# ---------------------------------------------------------------------------

class TestShareLiveSessionNotFound:
    """Non-existent invite codes should return 404."""

    def test_nonexistent_invite_code_returns_404(self):
        resp = client.get("/share/live/NONEXIST")
        assert resp.status_code == 404

    def test_empty_invite_code_returns_404(self):
        # FastAPI will not match an empty path segment to {invite_code}
        resp = client.get("/share/live/")
        # This could be 404 or 307 redirect depending on router config
        assert resp.status_code in (404, 307)


# ---------------------------------------------------------------------------
# Tests – share live session: XSS prevention
# ---------------------------------------------------------------------------

class TestShareLiveSessionXSS:
    """User-generated content in live sessions must be escaped."""

    def test_session_title_is_html_escaped(self, db):
        user = _create_user(db)
        _create_rtc_session(
            db, user.id,
            title='<script>alert("live-xss")</script>',
            invite_code="XSS001",
        )

        resp = client.get("/share/live/XSS001")
        html_text = resp.text
        assert '<script>alert("live-xss")</script>' not in html_text
        assert "&lt;script&gt;" in html_text

    def test_host_name_is_html_escaped(self, db):
        user = _create_user(db, name='<script>alert(1)</script>')
        _create_rtc_session(db, user.id, invite_code="XSS002")

        resp = client.get("/share/live/XSS002")
        html_text = resp.text
        assert '<script>alert(1)</script>' not in html_text
        assert "&lt;script&gt;" in html_text
