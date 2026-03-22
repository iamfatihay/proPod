"""
Regression tests for podcast audio upload endpoints.

Tests cover:
- Single audio file upload validation and filename generation
- Unsupported file type rejection
- File size limit enforcement
- Authentication requirement
- Filename uses time.time_ns() (not asyncio) for unique naming
"""

import pytest
from io import BytesIO
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal, engine, Base
from app.models import User
from app import crud, schemas
from app.auth import create_access_token

# Create all tables before tests run
Base.metadata.create_all(bind=engine)

client = TestClient(app)


def create_test_audio_bytes():
    """Create minimal bytes that simulate an audio file for testing."""
    # Minimal data to pass content reading (not a real audio file,
    # but sufficient for upload validation tests)
    return BytesIO(b'\x00' * 1024)


@pytest.fixture
def test_user():
    """Create a test user and return access token."""
    db = SessionLocal()
    try:
        # Clean up existing test user
        existing_user = db.query(User).filter(
            User.email == "uploadtest@test.com"
        ).first()
        if existing_user:
            db.delete(existing_user)
            db.commit()

        # Create test user
        user_create = schemas.UserCreate(
            email="uploadtest@test.com",
            name="Upload Test User",
            password="testpassword123"
        )
        user = crud.create_user(db, user_create)
        token = create_access_token(data={"sub": user.email})

        yield {"user": user, "token": token}

        # Cleanup
        db.delete(user)
        db.commit()
    finally:
        db.close()


class TestPodcastAudioUpload:
    """Test suite for /podcasts/upload endpoint."""

    def test_upload_valid_audio(self, test_user):
        """Test uploading a valid audio file succeeds."""
        token = test_user["token"]
        audio_bytes = create_test_audio_bytes()

        response = client.post(
            "/podcasts/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test.mp3", audio_bytes, "audio/mpeg")}
        )

        assert response.status_code == 200
        data = response.json()
        assert "audio_url" in data
        assert "file_size" in data
        assert data["content_type"] == "audio/mpeg"
        assert data["filename"].startswith(f"podcast_{test_user['user'].id}_")
        assert data["filename"].endswith(".mp3")

    def test_upload_generates_unique_filenames(self, test_user):
        """
        Regression test: filename generation must not crash.
        Previously used asyncio.get_event_loop().time() without importing asyncio,
        causing NameError. Now uses time.time_ns() for consistency.
        """
        token = test_user["token"]

        # Upload twice and verify both succeed with different filenames
        audio_bytes1 = create_test_audio_bytes()
        response1 = client.post(
            "/podcasts/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test1.mp3", audio_bytes1, "audio/mpeg")}
        )
        assert response1.status_code == 200

        audio_bytes2 = create_test_audio_bytes()
        response2 = client.post(
            "/podcasts/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test2.mp3", audio_bytes2, "audio/mpeg")}
        )
        assert response2.status_code == 200

        # Filenames should be different (unique timestamps)
        assert response1.json()["filename"] != response2.json()["filename"]

    def test_upload_invalid_file_type(self, test_user):
        """Test uploading an unsupported file type is rejected."""
        token = test_user["token"]
        file_content = BytesIO(b"This is not audio")

        response = client.post(
            "/podcasts/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test.txt", file_content, "text/plain")}
        )

        assert response.status_code == 422
        assert "Unsupported file type" in response.json()["detail"]

    def test_upload_oversized_file(self, test_user):
        """Test uploading a file larger than 100MB is rejected."""
        token = test_user["token"]
        # Create a file slightly over 100MB
        large_data = b'\x00' * (101 * 1024 * 1024)
        file_content = BytesIO(large_data)

        response = client.post(
            "/podcasts/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("large.mp3", file_content, "audio/mpeg")}
        )

        assert response.status_code == 413

    def test_upload_without_authentication(self):
        """Test uploading without authentication token is rejected."""
        audio_bytes = create_test_audio_bytes()

        response = client.post(
            "/podcasts/upload",
            files={"file": ("test.mp3", audio_bytes, "audio/mpeg")}
        )

        assert response.status_code == 401

    def test_upload_wav_format(self, test_user):
        """Test uploading WAV format is accepted."""
        token = test_user["token"]
        audio_bytes = create_test_audio_bytes()

        response = client.post(
            "/podcasts/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test.wav", audio_bytes, "audio/wav")}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["filename"].endswith(".wav")
        assert data["content_type"] == "audio/wav"

    def test_upload_m4a_format(self, test_user):
        """Test uploading M4A format is accepted."""
        token = test_user["token"]
        audio_bytes = create_test_audio_bytes()

        response = client.post(
            "/podcasts/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test.m4a", audio_bytes, "audio/m4a")}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["filename"].endswith(".m4a")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
