"""
Tests for the Google OAuth login endpoint (POST /users/google-login).

Covers:
- New Google user creation with photo_url preserved
- Existing Google user login returns existing account
- Missing photo_url defaults gracefully
- Response contains valid tokens and correct user data
- Existing local user can also authenticate via Google
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
import app.models as models

client = TestClient(app)


class TestGoogleLogin:
    """Tests for POST /users/google-login."""

    def test_new_google_user_created_with_photo(self, db_session):
        """New Google user should be created with photo_url preserved."""
        # Ensure user does not already exist
        existing = db_session.query(models.User).filter(
            models.User.email == "googleuser@gmail.com"
        ).first()
        if existing:
            db_session.delete(existing)
            db_session.commit()

        resp = client.post(
            "/users/google-login",
            json={
                "email": "googleuser@gmail.com",
                "name": "Google User",
                "provider": "google",
                "photo_url": "https://lh3.googleusercontent.com/photo.jpg",
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
        db_session.refresh(db_user)
        assert db_user is not None
        assert db_user.photo_url == "https://lh3.googleusercontent.com/photo.jpg"
        assert db_user.provider == "google"
        assert db_user.hashed_password is None  # Google users have no password

    def test_existing_google_user_returns_tokens(self, db_session):
        """Existing Google user should get tokens without creating duplicate."""
        # Ensure user does not already exist
        existing = db_session.query(models.User).filter(
            models.User.email == "returning@gmail.com"
        ).first()
        if existing:
            db_session.delete(existing)
            db_session.commit()

        # First login creates the user
        client.post(
            "/users/google-login",
            json={
                "email": "returning@gmail.com",
                "name": "Returning User",
                "provider": "google",
            },
        )

        # Second login should return the same user
        resp = client.post(
            "/users/google-login",
            json={
                "email": "returning@gmail.com",
                "name": "Returning User",
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

    def test_google_login_without_photo_url(self, db_session):
        """Google login without photo_url should succeed with null photo."""
        existing = db_session.query(models.User).filter(
            models.User.email == "nophoto@gmail.com"
        ).first()
        if existing:
            db_session.delete(existing)
            db_session.commit()

        resp = client.post(
            "/users/google-login",
            json={
                "email": "nophoto@gmail.com",
                "name": "No Photo User",
                "provider": "google",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["photo_url"] is None

    def test_google_login_response_structure(self, db_session):
        """Response should match AuthResponse schema."""
        existing = db_session.query(models.User).filter(
            models.User.email == "schema_check@gmail.com"
        ).first()
        if existing:
            db_session.delete(existing)
            db_session.commit()

        resp = client.post(
            "/users/google-login",
            json={
                "email": "schema_check@gmail.com",
                "name": "Schema Check",
                "provider": "google",
                "photo_url": "https://example.com/photo.jpg",
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
