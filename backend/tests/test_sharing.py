"""
Tests for web sharing endpoints: /share/podcast/{id} and /share/live/{code}.

Covers:
- Public podcast sharing returns HTML with correct Open Graph meta tags
- Private podcast sharing returns 403 for unauthenticated/non-owner users
- Private podcast sharing returns HTML for the owner
- Non-existent podcast returns 404
- Live session sharing returns HTML for existing sessions
- Non-existent live session invite code returns 404
- XSS prevention: user-generated content is escaped in HTML output
- thumbnail_url is used for og:image when present
"""
from fastapi.testclient import TestClient

from app.main import app
from app import crud, schemas
import app.models as models

client = TestClient(app)


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestSharePodcast:
    """Tests for GET /share/podcast/{podcast_id}."""

    def test_share_public_podcast_returns_html(self, test_user, test_podcast):
        resp = client.get(f"/share/podcast/{test_podcast.id}")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]
        assert test_podcast.title in resp.text

    def test_share_public_podcast_contains_og_tags(self, test_user, test_podcast):
        resp = client.get(f"/share/podcast/{test_podcast.id}")
        html = resp.text
        assert 'og:title' in html
        assert 'og:description' in html
        assert 'og:audio' in html
        assert 'twitter:card' in html

    def test_share_public_podcast_contains_owner_name(self, test_user, test_podcast):
        resp = client.get(f"/share/podcast/{test_podcast.id}")
        user, _ = test_user
        assert user.name in resp.text

    def test_share_public_podcast_contains_audio_url(self, test_user, test_podcast):
        resp = client.get(f"/share/podcast/{test_podcast.id}")
        # Audio URL should appear in the HTML player
        assert "audio" in resp.text.lower()
        assert test_podcast.audio_url in resp.text or "media/audio" in resp.text

    def test_share_nonexistent_podcast_returns_404(self):
        resp = client.get("/share/podcast/99999")
        assert resp.status_code == 404

    def test_share_private_podcast_unauthenticated_returns_403(self, db_session, test_user):
        user, _ = test_user
        # Create a private podcast
        podcast_data = schemas.PodcastCreate(
            title="Private Podcast",
            description="Secret content",
            category="Technology",
            is_public=False,
            duration=120,
            audio_url="http://localhost:8000/media/audio/private.mp3",
        )
        private_podcast = crud.create_podcast(db_session, podcast_data, owner_id=user.id)

        resp = client.get(f"/share/podcast/{private_podcast.id}")
        assert resp.status_code == 403

    def test_share_private_podcast_owner_returns_html(self, db_session, test_user):
        user, token = test_user
        # Create a private podcast
        podcast_data = schemas.PodcastCreate(
            title="My Private Podcast",
            description="Owner should see this",
            category="Technology",
            is_public=False,
            duration=120,
            audio_url="http://localhost:8000/media/audio/private2.mp3",
        )
        private_podcast = crud.create_podcast(db_session, podcast_data, owner_id=user.id)

        resp = client.get(
            f"/share/podcast/{private_podcast.id}",
            headers=auth_header(token),
        )
        assert resp.status_code == 200
        assert "My Private Podcast" in resp.text

    def test_share_podcast_escapes_xss(self, db_session, test_user):
        user, _ = test_user
        xss_title = '<script>alert("xss")</script>'
        podcast_data = schemas.PodcastCreate(
            title=xss_title,
            description='<img onerror="alert(1)" src=x>',
            category="Technology",
            is_public=True,
            duration=60,
            audio_url="http://localhost:8000/media/audio/xss.mp3",
        )
        podcast = crud.create_podcast(db_session, podcast_data, owner_id=user.id)

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert resp.status_code == 200
        # Raw script tag should NOT appear — it should be escaped
        assert "<script>" not in resp.text
        assert "&lt;script&gt;" in resp.text

    def test_share_podcast_uses_thumbnail_url(self, db_session, test_user):
        user, _ = test_user
        podcast_data = schemas.PodcastCreate(
            title="Podcast With Thumbnail",
            description="Has a thumbnail",
            category="Music",
            is_public=True,
            duration=180,
            audio_url="http://localhost:8000/media/audio/thumb.mp3",
        )
        podcast = crud.create_podcast(db_session, podcast_data, owner_id=user.id)
        # Manually set thumbnail_url
        podcast.thumbnail_url = "http://localhost:8000/media/images/thumb.png"
        db_session.commit()

        resp = client.get(f"/share/podcast/{podcast.id}")
        assert resp.status_code == 200
        assert "http://localhost:8000/media/images/thumb.png" in resp.text


class TestShareLiveSession:
    """Tests for GET /share/live/{invite_code}."""

    def test_share_live_session_returns_html(self, db_session, test_user):
        user, _ = test_user
        session = models.RTCSession(
            room_id="room-share-test-1",
            owner_id=user.id,
            title="Test Live Session",
            is_live=True,
            invite_code="SHARECODE01",
            participant_count=2,
            viewer_count=10,
        )
        db_session.add(session)
        db_session.commit()

        resp = client.get("/share/live/SHARECODE01")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]
        assert "Test Live Session" in resp.text

    def test_share_live_session_shows_live_status(self, db_session, test_user):
        user, _ = test_user
        session = models.RTCSession(
            room_id="room-share-test-2",
            owner_id=user.id,
            title="Live Now Session",
            is_live=True,
            invite_code="SHARECODE02",
            participant_count=1,
            viewer_count=5,
        )
        db_session.add(session)
        db_session.commit()

        resp = client.get("/share/live/SHARECODE02")
        assert "LIVE NOW" in resp.text

    def test_share_live_session_shows_scheduled_status(self, db_session, test_user):
        user, _ = test_user
        session = models.RTCSession(
            room_id="room-share-test-3",
            owner_id=user.id,
            title="Scheduled Session",
            is_live=False,
            invite_code="SHARECODE03",
            participant_count=0,
            viewer_count=0,
        )
        db_session.add(session)
        db_session.commit()

        resp = client.get("/share/live/SHARECODE03")
        assert "Scheduled" in resp.text

    def test_share_live_session_contains_owner_name(self, db_session, test_user):
        user, _ = test_user
        session = models.RTCSession(
            room_id="room-share-test-4",
            owner_id=user.id,
            title="Owner Name Session",
            is_live=True,
            invite_code="SHARECODE04",
            participant_count=1,
            viewer_count=0,
        )
        db_session.add(session)
        db_session.commit()

        resp = client.get("/share/live/SHARECODE04")
        assert user.name in resp.text

    def test_share_live_session_escapes_xss(self, db_session, test_user):
        user, _ = test_user
        session = models.RTCSession(
            room_id="room-share-test-5",
            owner_id=user.id,
            title='<script>alert("xss")</script>',
            is_live=True,
            invite_code="SHARECODE05",
            participant_count=0,
            viewer_count=0,
        )
        db_session.add(session)
        db_session.commit()

        resp = client.get("/share/live/SHARECODE05")
        assert resp.status_code == 200
        assert "<script>" not in resp.text
        assert "&lt;script&gt;" in resp.text

    def test_share_nonexistent_invite_code_returns_404(self):
        resp = client.get("/share/live/NONEXISTENT")
        assert resp.status_code == 404

    def test_share_live_session_contains_og_tags(self, db_session, test_user):
        user, _ = test_user
        session = models.RTCSession(
            room_id="room-share-test-6",
            owner_id=user.id,
            title="OG Tags Session",
            is_live=True,
            invite_code="SHARECODE06",
            participant_count=3,
            viewer_count=15,
        )
        db_session.add(session)
        db_session.commit()

        resp = client.get("/share/live/SHARECODE06")
        html = resp.text
        assert 'og:title' in html
        assert 'og:description' in html

    def test_share_live_session_shows_participant_counts(self, db_session, test_user):
        user, _ = test_user
        session = models.RTCSession(
            room_id="room-share-test-7",
            owner_id=user.id,
            title="Counts Session",
            is_live=True,
            invite_code="SHARECODE07",
            participant_count=3,
            viewer_count=25,
        )
        db_session.add(session)
        db_session.commit()

        resp = client.get("/share/live/SHARECODE07")
        assert "3 speakers" in resp.text
        assert "25 viewers" in resp.text
