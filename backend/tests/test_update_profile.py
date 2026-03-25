"""Tests for PUT /users/me profile update endpoint.

Validates that the endpoint uses UserUpdate schema (optional name only)
instead of UserBase, preventing unintended email changes and ensuring
users don't need to send their email on every profile update.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models import User
from app import crud, schemas
from app.auth import create_access_token

client = TestClient(app)

TEST_EMAIL = "updateprofile@test.com"
TEST_PASSWORD = "TestPassword123!"


@pytest.fixture
def test_user():
    """Create a test user and return (user, access_token, db)."""
    db = SessionLocal()
    try:
        # Clean up existing test user
        existing = db.query(User).filter(User.email == TEST_EMAIL).first()
        if existing:
            db.delete(existing)
            db.commit()

        # Create test user
        user_create = schemas.UserCreate(
            email=TEST_EMAIL,
            name="Original Name",
            password=TEST_PASSWORD,
            provider="local",
        )
        user = crud.create_user(db, user_create)
        token = create_access_token(data={"sub": user.email})

        yield user, token, db
    finally:
        # Cleanup
        cleanup_user = db.query(User).filter(User.email == TEST_EMAIL).first()
        if cleanup_user:
            db.delete(cleanup_user)
            db.commit()
        db.close()


class TestUpdateProfile:
    """Tests for the PUT /users/me endpoint."""

    def test_update_name_only(self, test_user):
        """Updating with just a name should succeed (no email required)."""
        user, token, db = test_user
        response = client.put(
            "/users/me",
            json={"name": "Updated Name"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["email"] == TEST_EMAIL  # Email unchanged

    def test_update_empty_body(self, test_user):
        """Sending an empty body should succeed (no fields are required)."""
        user, token, db = test_user
        response = client.put(
            "/users/me",
            json={},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == user.name  # Name unchanged
        assert data["email"] == TEST_EMAIL

    def test_email_field_ignored(self, test_user):
        """Email field in request body should be ignored (not in UserUpdate)."""
        user, token, db = test_user
        response = client.put(
            "/users/me",
            json={"email": "hacker@evil.com", "name": "Still Original"},
            headers={"Authorization": f"Bearer {token}"},
        )
        # The request should succeed (extra fields are ignored by Pydantic)
        assert response.status_code == 200
        data = response.json()
        # Email must NOT have changed — this is the security fix
        assert data["email"] == TEST_EMAIL
        assert data["email"] != "hacker@evil.com"

    def test_update_requires_authentication(self):
        """PUT /users/me without a token should return 401."""
        response = client.put(
            "/users/me",
            json={"name": "No Auth"},
        )
        assert response.status_code == 401

    def test_update_with_invalid_token(self):
        """PUT /users/me with an invalid token should return 401."""
        response = client.put(
            "/users/me",
            json={"name": "Bad Token"},
            headers={"Authorization": "Bearer invalid-token-here"},
        )
        assert response.status_code == 401
