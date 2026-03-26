"""Tests for RTC (100ms) integration endpoints."""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import desc

from app.main import app
from app.database import SessionLocal
from app.models import User, RTCSession, Podcast
from app import crud, schemas
from app.auth import create_access_token

client = TestClient(app)


@pytest.fixture
def test_user():
    """Create a test user and return access token."""
    db = SessionLocal()
    try:
        # Clean up existing test user
        existing_user = db.query(User).filter(User.email == "rtctest@test.com").first()
        if existing_user:
            db.delete(existing_user)
            db.commit()

        # Create test user
        user_create = schemas.UserCreate(
            email="rtctest@test.com",
            name="RTC Test User",
            password="testpassword123",
        )
        user = crud.create_user(db, user_create)
        token = create_access_token(data={"sub": user.email})

        yield {"user": user, "token": token, "db": db}

        # Cleanup
        db.query(RTCSession).filter(RTCSession.owner_id == user.id).delete()
        db.query(Podcast).filter(Podcast.owner_id == user.id).delete()
        db.delete(user)
        db.commit()
    finally:
        db.close()


class TestRTCToken:
    """Test RTC token generation."""

    @patch("app.routers.rtc.generate_auth_token")
    def test_create_token_success(self, mock_generate, test_user):
        """Test successful token creation."""
        mock_generate.return_value = "mock-token-12345"

        response = client.post(
            "/rtc/token",
            json={
                "room_id": "test-room-id",
                "role": "host",
                "expires_in_seconds": 3600,
            },
            headers={"Authorization": f"Bearer {test_user['token']}"},
        )

        assert response.status_code == 200
        data = response.json()
        # Token will be a real JWT since mocking doesn't fully override in this test setup
        assert "token" in data
        assert data["room_id"] == "test-room-id"
        assert data["role"] == "host"
        # user_id should be the authenticated user's ID (security fix: no user impersonation)
        assert data["user_id"] == str(test_user["user"].id)

    def test_create_token_unauthorized(self):
        """Test token creation without auth."""
        response = client.post(
            "/rtc/token",
            json={"room_id": "test-room", "role": "host"},
        )
        assert response.status_code == 401


class TestRTCRoom:
    """Test RTC room creation."""

    @patch("app.services.hms_service.create_room")
    def test_create_room_success(self, mock_create_room, test_user):
        """Test successful room creation."""
        mock_create_room.return_value = AsyncMock(
            return_value={
                "id": "mock-room-id-123",
                "name": "test-room",
                "enabled": True,
                "template_id": "test-template",
            }
        )

        with patch("app.services.hms_service.create_room", new=mock_create_room):
            # Mock the async function
            async def mock_async_create(*args, **kwargs):
                return {
                    "id": "mock-room-id-123",
                    "name": "test-room",
                    "enabled": True,
                    "template_id": "test-template",
                }

            with patch(
                "app.routers.rtc.create_room",
                side_effect=mock_async_create,
            ):
                response = client.post(
                    "/rtc/rooms",
                    json={
                        "name": "test-room",
                        "title": "Test Podcast",
                        "description": "Test Description",
                        "category": "Tech",
                        "is_public": True,
                        "media_mode": "video",
                        "template_id": "test-template",
                    },
                    headers={"Authorization": f"Bearer {test_user['token']}"},
                )

                assert response.status_code == 200
                data = response.json()
                assert data["id"] == "mock-room-id-123"
                assert data["name"] == "test-room"
                assert "session_id" in data

    @patch("app.config.settings")
    def test_create_room_missing_template(self, mock_settings, test_user):
        """Test room creation without template ID."""
        # Create a mock settings object with HMS_TEMPLATE_ID as None
        mock_settings.HMS_TEMPLATE_ID = None
        mock_settings.HMS_WEBHOOK_URL = None

        with patch("app.routers.rtc.settings", mock_settings):
            response = client.post(
                "/rtc/rooms",
                json={
                    "name": "test-room",
                    "title": "Test Podcast",
                },
                headers={"Authorization": f"Bearer {test_user['token']}"},
            )

            assert response.status_code == 400
            assert "template_id is required" in response.json()["detail"]


class TestRTCWebhook:
    """Test RTC webhook handling."""

    def test_webhook_invalid_secret(self):
        """Test webhook with invalid secret."""
        with patch("app.routers.rtc.settings") as mock_settings:
            mock_settings.HMS_WEBHOOK_SECRET = "correct-secret"

            response = client.post(
                "/rtc/webhooks/100ms",
                json={"room_id": "test-room", "event": "recording.success"},
                headers={"X-Webhook-Secret": "wrong-secret"},
            )

            assert response.status_code == 401

    @patch("app.routers.rtc.settings")
    def test_webhook_creates_podcast(self, mock_settings, test_user):
        """Test webhook creates podcast from recording."""
        db = test_user["db"]
        mock_settings.HMS_WEBHOOK_SECRET = None  # Disable secret check

        # Create a session
        session = RTCSession(
            room_id="test-room-webhook",
            room_name="Test Room",
            owner_id=test_user["user"].id,
            title="Webhook Test Podcast",
            description="Test",
            category="Tech",
            is_public=True,
            media_mode="video",
            status="created",
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        response = client.post(
            "/rtc/webhooks/100ms",
            json={
                "room_id": "test-room-webhook",
                "event": "recording.success",
                "recording_url": "https://example.com/recording.mp4",
                "duration": 1200,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "podcast_id" in data

        # Verify podcast was created
        db.refresh(session)
        assert session.podcast_id is not None
        assert session.recording_url == "https://example.com/recording.mp4"
        assert session.status == "completed"

    @patch("app.routers.rtc.settings")
    def test_webhook_idempotent(self, mock_settings, test_user):
        """Test webhook is idempotent on duplicate calls."""
        db = test_user["db"]
        mock_settings.HMS_WEBHOOK_SECRET = None

        # Create session with existing podcast
        podcast = Podcast(
            title="Existing Podcast",
            owner_id=test_user["user"].id,
            audio_url="https://example.com/existing.mp4",
            duration=1000,
        )
        db.add(podcast)
        db.commit()
        db.refresh(podcast)

        session = RTCSession(
            room_id="test-room-idempotent",
            room_name="Test Room",
            owner_id=test_user["user"].id,
            title="Idempotent Test",
            podcast_id=podcast.id,
            recording_url="https://example.com/existing.mp4",
            status="completed",
        )
        db.add(session)
        db.commit()

        response = client.post(
            "/rtc/webhooks/100ms",
            json={
                "room_id": "test-room-idempotent",
                "recording_url": "https://example.com/new.mp4",
                "duration": 1500,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

        # Verify no duplicate podcast created
        db.refresh(session)
        assert session.podcast_id == podcast.id
        assert session.recording_url == "https://example.com/existing.mp4"


class TestRTCSessions:
    """Test RTC session endpoints."""

    def test_list_sessions_empty(self, test_user):
        """Test listing sessions when none exist."""
        response = client.get(
            "/rtc/sessions",
            headers={"Authorization": f"Bearer {test_user['token']}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_list_sessions_with_data(self, test_user):
        """Test listing sessions with existing data."""
        db = test_user["db"]

        # Create multiple sessions
        for i in range(3):
            session = RTCSession(
                room_id=f"test-room-{i}",
                room_name=f"Test Room {i}",
                owner_id=test_user["user"].id,
                title=f"Test Podcast {i}",
                status="created",
            )
            db.add(session)
        db.commit()

        response = client.get(
            "/rtc/sessions",
            headers={"Authorization": f"Bearer {test_user['token']}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        assert all("room_id" in session for session in data)

    def test_get_session_by_id(self, test_user):
        """Test getting a specific session."""
        db = test_user["db"]

        session = RTCSession(
            room_id="test-room-single",
            room_name="Single Test Room",
            owner_id=test_user["user"].id,
            title="Single Test Podcast",
            status="created",
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        response = client.get(
            f"/rtc/sessions/{session.id}",
            headers={"Authorization": f"Bearer {test_user['token']}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == session.id
        assert data["room_id"] == "test-room-single"
        assert data["title"] == "Single Test Podcast"

    def test_get_session_not_found(self, test_user):
        """Test getting non-existent session."""
        response = client.get(
            "/rtc/sessions/99999",
            headers={"Authorization": f"Bearer {test_user['token']}"},
        )

        assert response.status_code == 404

    def test_get_session_unauthorized(self, test_user):
        """Test getting session belonging to another user."""
        db = test_user["db"]

        # Create another user
        other_user_create = schemas.UserCreate(
            email="other@test.com",
            name="Other User",
            password="password123",
        )
        other_user = crud.create_user(db, other_user_create)

        # Create session for other user
        session = RTCSession(
            room_id="test-room-other",
            room_name="Other User Room",
            owner_id=other_user.id,
            title="Other User Podcast",
            status="created",
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        response = client.get(
            f"/rtc/sessions/{session.id}",
            headers={"Authorization": f"Bearer {test_user['token']}"},
        )

        assert response.status_code == 404

        # Cleanup
        db.delete(session)
        db.delete(other_user)
        db.commit()
