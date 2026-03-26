"""
Regression tests for podcast audio upload endpoints.

Tests cover:
- Single audio file upload validation and filename generation
- Unsupported file type rejection
- File size limit enforcement
- Authentication requirement
- Filename uses time.time_ns() (not asyncio) for unique naming
"""

import os
import pytest
from io import BytesIO
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models import User
from app import crud, schemas
from app.auth import create_access_token

client = TestClient(app)


def _create_test_audio_bytes():
    """Create minimal bytes that simulate an audio file for testing."""
    return BytesIO(b'\x00' * 1024)


def _cleanup_uploaded_file(response_json):
    """Remove an uploaded file from disk to prevent test pollution."""
    if "audio_url" in response_json:
        backend_dir = os.path.dirname(os.path.dirname(__file__))
        rel_path = response_json["audio_url"].lstrip("/")
        full_path = os.path.join(backend_dir, rel_path)
        if os.path.exists(full_path):
            os.remove(full_path)


@pytest.fixture
def test_user():
    """Create a test user and return access token."""
    db = SessionLocal()
    try:
        existing_user = db.query(User).filter(
            User.email == "uploadtest@test.com"
        ).first()
        if existing_user:
            db.delete(existing_user)
            db.commit()

        user_create = schemas.UserCreate(
            email="uploadtest@test.com",
            name="Upload Test User",
            password="testpassword123"
        )
        user = crud.create_user(db, user_create)
        token = create_access_token(data={"sub": user.email})

        yield {"user": user, "token": token}

        db.delete(user)
        db.commit()
    finally:
        db.close()


class TestPodcastAudioUpload:
    """Test suite for /podcasts/upload endpoint."""

    def test_upload_valid_audio(self, test_user):
        """Test uploading a valid audio file succeeds."""
        token = test_user["token"]
        audio_bytes = _create_test_audio_bytes()

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
        _cleanup_uploaded_file(data)

    def test_upload_generates_unique_filenames(self, test_user):
        """
        Regression test: filename generation must not crash.
        Previously used asyncio.get_event_loop().time() without importing asyncio,
        causing NameError. Now uses time.time_ns() for consistency.

        Uses monkeypatched time.time_ns to guarantee deterministic, distinct values.
        """
        token = test_user["token"]
        timestamps = iter([1000000000, 2000000000])

        with patch("app.routers.podcasts.time") as mock_time:
            mock_time.time_ns = lambda: next(timestamps)

            response1 = client.post(
                "/podcasts/upload",
                headers={"Authorization": f"Bearer {token}"},
                files={"file": ("test1.mp3", _create_test_audio_bytes(), "audio/mpeg")}
            )
            assert response1.status_code == 200

            response2 = client.post(
                "/podcasts/upload",
                headers={"Authorization": f"Bearer {token}"},
                files={"file": ("test2.mp3", _create_test_audio_bytes(), "audio/mpeg")}
            )
            assert response2.status_code == 200

        data1, data2 = response1.json(), response2.json()
        assert "1000000000" in data1["filename"]
        assert "2000000000" in data2["filename"]
        assert data1["filename"] != data2["filename"]
        _cleanup_uploaded_file(data1)
        _cleanup_uploaded_file(data2)

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
        """Test uploading a file larger than the size limit is rejected.

        Monkeypatches MAX_UPLOAD_SIZE to a tiny value to avoid allocating
        100+ MB in memory during testing.
        """
        token = test_user["token"]
        # 2KB file, but we set the limit to 1KB
        file_content = BytesIO(b'\x00' * 2048)

        with patch("app.routers.podcasts.MAX_UPLOAD_SIZE", 1024):
            response = client.post(
                "/podcasts/upload",
                headers={"Authorization": f"Bearer {token}"},
                files={"file": ("large.mp3", file_content, "audio/mpeg")}
            )

        assert response.status_code == 413

    def test_upload_without_authentication(self):
        """Test uploading without authentication token is rejected."""
        audio_bytes = _create_test_audio_bytes()

        response = client.post(
            "/podcasts/upload",
            files={"file": ("test.mp3", audio_bytes, "audio/mpeg")}
        )

        assert response.status_code == 401

    def test_upload_wav_format(self, test_user):
        """Test uploading WAV format is accepted."""
        token = test_user["token"]
        audio_bytes = _create_test_audio_bytes()

        response = client.post(
            "/podcasts/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test.wav", audio_bytes, "audio/wav")}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["filename"].endswith(".wav")
        assert data["content_type"] == "audio/wav"
        _cleanup_uploaded_file(data)

    def test_upload_m4a_format(self, test_user):
        """Test uploading M4A format is accepted."""
        token = test_user["token"]
        audio_bytes = _create_test_audio_bytes()

        response = client.post(
            "/podcasts/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test.m4a", audio_bytes, "audio/m4a")}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["filename"].endswith(".m4a")
        _cleanup_uploaded_file(data)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
