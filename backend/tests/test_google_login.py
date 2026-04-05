"""
Tests for the Google OAuth login endpoint (POST /users/google-login).

Covers:
- New Google user creation with photo_url preserved
- Existing Google user login returns existing account
- Missing photo_url defaults gracefully
- Invalid Google token is rejected
- Response contains valid tokens and correct user data
"""
import json

import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException

from app.main import app
import app.models as models
from app.services import google_auth_service

client = TestClient(app)


def _mock_google_profile(email, name, photo_url=None):
    return {
        "email": email,
        "name": name,
        "provider": "google",
        "photo_url": photo_url,
    }


class TestGoogleLogin:
    """Tests for POST /users/google-login."""

    def test_new_google_user_created_with_photo(self, db_session, monkeypatch):
        """New Google user should be created with photo_url preserved."""
        # Ensure user does not already exist
        existing = db_session.query(models.User).filter(
            models.User.email == "googleuser@gmail.com"
        ).first()
        if existing:
            db_session.delete(existing)
            db_session.commit()

        monkeypatch.setattr(
            google_auth_service,
            "fetch_google_user_profile",
            lambda access_token: _mock_google_profile(
                "googleuser@gmail.com",
                "Google User",
                "https://lh3.googleusercontent.com/photo.jpg",
            ),
        )

        resp = client.post(
            "/users/google-login",
            json={
                "google_access_token": "valid-google-token",
                "provider": "google",
            },
        )
        assert resp.status_code == 200
        data = resp.json()

        # Tokens present
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

        # User data correct
        user_data = data["user"]
        assert user_data["email"] == "googleuser@gmail.com"
        assert user_data["name"] == "Google User"
        assert user_data["photo_url"] == "https://lh3.googleusercontent.com/photo.jpg"

        # Verify in database
        db_user = db_session.query(models.User).filter(
            models.User.email == "googleuser@gmail.com"
        ).first()
        assert db_user is not None
        db_session.refresh(db_user)
        assert db_user.photo_url == "https://lh3.googleusercontent.com/photo.jpg"
        assert db_user.provider == "google"
        assert db_user.hashed_password is None  # Google users have no password

    def test_existing_google_user_returns_tokens(self, db_session, monkeypatch):
        """Existing Google user should get tokens without creating duplicate."""
        # Ensure user does not already exist
        existing = db_session.query(models.User).filter(
            models.User.email == "returning@gmail.com"
        ).first()
        if existing:
            db_session.delete(existing)
            db_session.commit()

        monkeypatch.setattr(
            google_auth_service,
            "fetch_google_user_profile",
            lambda access_token: _mock_google_profile(
                "returning@gmail.com",
                "Returning User",
            ),
        )

        # First login creates the user
        client.post(
            "/users/google-login",
            json={
                "google_access_token": "valid-google-token",
                "provider": "google",
            },
        )

        # Second login should return the same user
        resp = client.post(
            "/users/google-login",
            json={
                "google_access_token": "valid-google-token",
                "provider": "google",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["email"] == "returning@gmail.com"

        # Should still be only one user with that email
        count = db_session.query(models.User).filter(
            models.User.email == "returning@gmail.com"
        ).count()
        assert count == 1

    def test_google_login_without_photo_url(self, db_session, monkeypatch):
        """Google login without photo_url should succeed with null photo."""
        existing = db_session.query(models.User).filter(
            models.User.email == "nophoto@gmail.com"
        ).first()
        if existing:
            db_session.delete(existing)
            db_session.commit()

        monkeypatch.setattr(
            google_auth_service,
            "fetch_google_user_profile",
            lambda access_token: _mock_google_profile(
                "nophoto@gmail.com",
                "No Photo User",
            ),
        )

        resp = client.post(
            "/users/google-login",
            json={
                "google_access_token": "valid-google-token",
                "provider": "google",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["photo_url"] is None

    def test_google_login_response_structure(self, db_session, monkeypatch):
        """Response should match AuthResponse schema."""
        existing = db_session.query(models.User).filter(
            models.User.email == "schema_check@gmail.com"
        ).first()
        if existing:
            db_session.delete(existing)
            db_session.commit()

        monkeypatch.setattr(
            google_auth_service,
            "fetch_google_user_profile",
            lambda access_token: _mock_google_profile(
                "schema_check@gmail.com",
                "Schema Check",
                "https://example.com/photo.jpg",
            ),
        )

        resp = client.post(
            "/users/google-login",
            json={
                "google_access_token": "valid-google-token",
                "provider": "google",
            },
        )
        assert resp.status_code == 200
        data = resp.json()

        # Verify all expected fields
        assert set(data.keys()) == {"access_token", "refresh_token", "token_type", "user"}
        user = data["user"]
        assert "id" in user
        assert "email" in user
        assert "name" in user
        assert "provider" in user
        assert "photo_url" in user
        assert "created_at" in user

    def test_invalid_google_token_is_rejected(self, monkeypatch):
        """Invalid Google tokens should not create or authenticate users."""
        def raise_invalid_token(access_token):
            raise HTTPException(status_code=401, detail="Invalid Google access token")

        monkeypatch.setattr(
            google_auth_service,
            "fetch_google_user_profile",
            raise_invalid_token,
        )

        resp = client.post(
            "/users/google-login",
            json={
                "google_access_token": "bad-token",
                "provider": "google",
            },
        )

        assert resp.status_code == 401
        assert resp.json()["detail"] == "Invalid Google access token"

    def test_invalid_google_response_is_rejected(self, monkeypatch):
        """Malformed Google profile responses should surface a gateway error."""

        class MockResponse:
            def raise_for_status(self):
                return None

            def json(self):
                raise json.JSONDecodeError("bad json", "", 0)

        monkeypatch.setattr(
            google_auth_service.httpx,
            "get",
            lambda *args, **kwargs: MockResponse(),
        )

        with pytest.raises(HTTPException) as exc_info:
            google_auth_service.fetch_google_user_profile("valid-google-token")

        assert exc_info.value.status_code == 502
        assert exc_info.value.detail == "Invalid response from Google authentication service"
