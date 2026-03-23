"""
Tests for user authentication and profile management endpoints.

Covers:
- User registration (local and validation)
- User login (success, wrong password, missing user, OAuth user)
- Google OAuth login (new and existing user)
- Token refresh
- Get current user profile
- Update user profile
- Change password
- Forgot password (dev mode)
- Reset password (dev mode)
- Delete account (soft delete)
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models import User
from app import crud, schemas
from app.auth import create_access_token

client = TestClient(app)


# ==================== Fixtures ====================

@pytest.fixture
def db_session():
    """Provide a database session that rolls back after test."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_user(db_session):
    """Create a local test user and return user data with token."""
    email = "authtest@test.com"

    # Clean up existing test user
    existing = db_session.query(User).filter(User.email == email).first()
    if existing:
        db_session.delete(existing)
        db_session.commit()

    user_create = schemas.UserCreate(
        email=email,
        name="Auth Test User",
        password="SecurePass123",
    )
    user = crud.create_user(db_session, user_create)
    token = create_access_token(data={"sub": user.email})

    yield {"user": user, "token": token, "password": "SecurePass123", "db": db_session}

    # Cleanup
    u = db_session.query(User).filter(User.email == email).first()
    if u:
        db_session.delete(u)
        db_session.commit()


@pytest.fixture
def unique_email():
    """Generate a unique email for registration tests."""
    import uuid
    return f"reg_{uuid.uuid4().hex[:8]}@test.com"


# ==================== Registration Tests ====================

class TestRegistration:
    """Test suite for POST /users/register."""

    def test_register_success(self, unique_email, db_session):
        """Register a new local user successfully."""
        response = client.post("/users/register", json={
            "email": unique_email,
            "name": "New User",
            "password": "StrongPass1",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == unique_email
        assert data["user"]["name"] == "New User"

        # Cleanup
        user = db_session.query(User).filter(User.email == unique_email).first()
        if user:
            db_session.delete(user)
            db_session.commit()

    def test_register_duplicate_email(self, test_user):
        """Registering with an existing email returns 400."""
        response = client.post("/users/register", json={
            "email": test_user["user"].email,
            "name": "Duplicate",
            "password": "AnyPass1",
        })
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]

    def test_register_missing_password_local(self):
        """Local registration without password returns 400."""
        response = client.post("/users/register", json={
            "email": "nopass@test.com",
            "name": "No Pass",
            "password": "",
            "provider": "local",
        })
        assert response.status_code == 400

    def test_register_whitespace_password(self):
        """Local registration with whitespace-only password returns 400."""
        response = client.post("/users/register", json={
            "email": "whitespace@test.com",
            "name": "Whitespace",
            "password": "   ",
            "provider": "local",
        })
        assert response.status_code == 400


# ==================== Login Tests ====================

class TestLogin:
    """Test suite for POST /users/login."""

    def test_login_success(self, test_user):
        """Login with correct credentials returns tokens and user."""
        response = client.post("/users/login", json={
            "email": test_user["user"].email,
            "password": test_user["password"],
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == test_user["user"].email

    def test_login_wrong_password(self, test_user):
        """Login with wrong password returns 400."""
        response = client.post("/users/login", json={
            "email": test_user["user"].email,
            "password": "WrongPassword",
        })
        assert response.status_code == 400
        assert "Invalid email or password" in response.json()["detail"]

    def test_login_nonexistent_user(self):
        """Login with non-existent email returns 400."""
        response = client.post("/users/login", json={
            "email": "nobody@nowhere.com",
            "password": "anything",
        })
        assert response.status_code == 400
        assert "Invalid email or password" in response.json()["detail"]

    def test_login_oauth_user_no_password(self, db_session):
        """Login attempt for OAuth user (no password) returns 400."""
        email = "oauthonly@test.com"
        existing = db_session.query(User).filter(User.email == email).first()
        if existing:
            db_session.delete(existing)
            db_session.commit()

        # Create OAuth user without password
        user_create = schemas.UserCreate(
            email=email,
            name="OAuth Only",
            provider="google",
            password=None,
        )
        crud.create_user(db_session, user_create)

        response = client.post("/users/login", json={
            "email": email,
            "password": "anything",
        })
        assert response.status_code == 400

        # Cleanup
        u = db_session.query(User).filter(User.email == email).first()
        if u:
            db_session.delete(u)
            db_session.commit()


# ==================== Google Login Tests ====================

class TestGoogleLogin:
    """Test suite for POST /users/google-login."""

    def test_google_login_new_user(self, db_session):
        """Google login creates a new user if not exists."""
        email = "newgoogle@test.com"
        existing = db_session.query(User).filter(User.email == email).first()
        if existing:
            db_session.delete(existing)
            db_session.commit()

        response = client.post("/users/google-login", json={
            "email": email,
            "name": "Google User",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == email

        # Cleanup
        u = db_session.query(User).filter(User.email == email).first()
        if u:
            db_session.delete(u)
            db_session.commit()

    def test_google_login_existing_user(self, test_user):
        """Google login returns tokens for existing user."""
        response = client.post("/users/google-login", json={
            "email": test_user["user"].email,
            "name": test_user["user"].name,
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == test_user["user"].email


# ==================== Token Refresh Tests ====================

class TestTokenRefresh:
    """Test suite for POST /users/refresh-token."""

    def test_refresh_token_success(self, test_user):
        """Valid refresh token returns new access token."""
        # First get a refresh token via login
        login_resp = client.post("/users/login", json={
            "email": test_user["user"].email,
            "password": test_user["password"],
        })
        refresh_token = login_resp.json()["refresh_token"]

        response = client.post("/users/refresh-token", json={
            "refresh_token": refresh_token,
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_refresh_token_invalid(self):
        """Invalid refresh token returns 401."""
        response = client.post("/users/refresh-token", json={
            "refresh_token": "invalid-token-here",
        })
        assert response.status_code == 401


# ==================== Profile Tests ====================

class TestProfile:
    """Test suite for GET /users/me and PUT /users/me."""

    def test_get_me_success(self, test_user):
        """Authenticated user can get own profile."""
        response = client.get(
            "/users/me",
            headers={"Authorization": f"Bearer {test_user['token']}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user["user"].email
        assert data["name"] == "Auth Test User"

    def test_get_me_unauthenticated(self):
        """Unauthenticated request returns 401."""
        response = client.get("/users/me")
        assert response.status_code == 401

    def test_get_me_invalid_token(self):
        """Invalid token returns 401."""
        response = client.get(
            "/users/me",
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert response.status_code == 401

    def test_update_me_success(self, test_user):
        """Authenticated user can update own profile."""
        response = client.put(
            "/users/me",
            headers={"Authorization": f"Bearer {test_user['token']}"},
            json={"email": test_user["user"].email, "name": "Updated Name"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    def test_update_me_unauthenticated(self):
        """Unauthenticated profile update returns 401."""
        response = client.put(
            "/users/me",
            json={"email": "x@test.com", "name": "Hacker"},
        )
        assert response.status_code == 401


# ==================== Change Password Tests ====================

class TestChangePassword:
    """Test suite for POST /users/change-password."""

    def test_change_password_success(self, test_user):
        """Change password with correct old password succeeds."""
        response = client.post(
            "/users/change-password",
            headers={"Authorization": f"Bearer {test_user['token']}"},
            json={
                "old_password": test_user["password"],
                "new_password": "NewSecure456",
            },
        )
        assert response.status_code == 200
        assert "successfully" in response.json()["message"].lower()

        # Verify new password works for login
        login_resp = client.post("/users/login", json={
            "email": test_user["user"].email,
            "password": "NewSecure456",
        })
        assert login_resp.status_code == 200

    def test_change_password_wrong_old(self, test_user):
        """Change password with wrong old password returns 400."""
        response = client.post(
            "/users/change-password",
            headers={"Authorization": f"Bearer {test_user['token']}"},
            json={
                "old_password": "WrongOld",
                "new_password": "NewSecure456",
            },
        )
        assert response.status_code == 400

    def test_change_password_unauthenticated(self):
        """Unauthenticated password change returns 401."""
        response = client.post(
            "/users/change-password",
            json={"old_password": "x", "new_password": "y"},
        )
        assert response.status_code == 401


# ==================== Forgot / Reset Password Tests ====================

class TestForgotResetPassword:
    """Test suite for POST /users/forgot-password and POST /users/reset-password."""

    def test_forgot_password_existing_user(self, test_user):
        """Forgot password for existing user returns token in dev mode."""
        response = client.post("/users/forgot-password", json={
            "email": test_user["user"].email,
        })
        assert response.status_code == 200
        data = response.json()
        assert "msg" in data
        # In dev mode, token is returned in response
        assert "token" in data

    def test_forgot_password_nonexistent_user(self):
        """Forgot password for non-existent email still returns 200 (no enumeration)."""
        response = client.post("/users/forgot-password", json={
            "email": "nonexistent@test.com",
        })
        assert response.status_code == 200
        data = response.json()
        assert "msg" in data
        # Token should NOT be present for non-existent user
        assert "token" not in data

    def test_reset_password_success(self, test_user):
        """Reset password with valid token succeeds."""
        # Get reset token
        forgot_resp = client.post("/users/forgot-password", json={
            "email": test_user["user"].email,
        })
        token = forgot_resp.json()["token"]

        # Reset password
        response = client.post("/users/reset-password", json={
            "token": token,
            "new_password": "ResetPass789",
        })
        assert response.status_code == 200

        # Verify new password works
        login_resp = client.post("/users/login", json={
            "email": test_user["user"].email,
            "password": "ResetPass789",
        })
        assert login_resp.status_code == 200

    def test_reset_password_invalid_token(self):
        """Reset password with invalid token returns 400."""
        response = client.post("/users/reset-password", json={
            "token": "invalid-token-value",
            "new_password": "anything",
        })
        assert response.status_code == 400


# ==================== Delete Account Tests ====================

class TestDeleteAccount:
    """Test suite for POST /users/delete."""

    def test_delete_account_success(self, test_user):
        """Authenticated user can soft-delete their account."""
        response = client.post(
            "/users/delete",
            headers={"Authorization": f"Bearer {test_user['token']}"},
        )
        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

        # Verify user is soft-deleted (is_active = False)
        db = test_user["db"]
        user = db.query(User).filter(User.email == test_user["user"].email).first()
        db.refresh(user)
        assert user.is_active is False

    def test_delete_account_unauthenticated(self):
        """Unauthenticated delete returns 401."""
        response = client.post("/users/delete")
        assert response.status_code == 401
