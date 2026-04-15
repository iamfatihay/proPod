"""Tests for the /users/me/device-token endpoints (push notification tokens).

Covers:
- POST /users/me/device-token  — register (happy path, idempotent upsert)
- DELETE /users/me/device-token — remove token
- CRUD layer: register_device_token, get_device_tokens_for_user, remove_device_token
- create_notification push dispatch (fire-and-forget, no crash on failure)
- push payload content: podcastId included when podcast_id provided, omitted otherwise
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app import crud, models
from app.auth import create_access_token, get_password_hash

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(db_session, email: str, name: str) -> models.User:
    existing = db_session.query(models.User).filter(models.User.email == email).first()
    if existing:
        return existing
    user = models.User(
        email=email,
        name=name,
        hashed_password=get_password_hash("password123"),
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _auth_headers(user: models.User) -> dict:
    token = create_access_token({"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# POST /users/me/device-token
# ---------------------------------------------------------------------------

class TestRegisterDeviceToken:
    def test_register_token_happy_path(self, db_session):
        user = _make_user(db_session, "push_happy@test.com", "Happy Push")
        headers = _auth_headers(user)

        payload = {"token": "ExponentPushToken[abc123happypath]", "platform": "ios"}
        resp = client.post("/users/me/device-token", json=payload, headers=headers)

        assert resp.status_code == 201
        data = resp.json()
        assert data["token"] == payload["token"]
        assert data["platform"] == "ios"
        assert "id" in data

    def test_register_token_idempotent(self, db_session):
        """Registering the same token twice returns 201 both times without error."""
        user = _make_user(db_session, "push_idem@test.com", "Idem Push")
        headers = _auth_headers(user)
        payload = {"token": "ExponentPushToken[idem_token_xyz]", "platform": "android"}

        resp1 = client.post("/users/me/device-token", json=payload, headers=headers)
        resp2 = client.post("/users/me/device-token", json=payload, headers=headers)

        assert resp1.status_code == 201
        assert resp2.status_code == 201
        assert resp1.json()["id"] == resp2.json()["id"]  # same row updated

    def test_register_token_requires_auth(self):
        payload = {"token": "ExponentPushToken[no_auth]", "platform": "ios"}
        resp = client.post("/users/me/device-token", json=payload)
        assert resp.status_code == 401

    def test_register_token_invalid_platform(self, db_session):
        user = _make_user(db_session, "push_badplat@test.com", "Bad Platform")
        headers = _auth_headers(user)
        payload = {"token": "ExponentPushToken[badplatform]", "platform": "windows"}
        resp = client.post("/users/me/device-token", json=payload, headers=headers)
        assert resp.status_code == 422  # pydantic validation error

    def test_register_token_missing_token_field(self, db_session):
        user = _make_user(db_session, "push_missing@test.com", "Missing Token")
        headers = _auth_headers(user)
        resp = client.post("/users/me/device-token", json={"platform": "ios"}, headers=headers)
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# DELETE /users/me/device-token
# ---------------------------------------------------------------------------

class TestRemoveDeviceToken:
    def test_remove_token_happy_path(self, db_session):
        user = _make_user(db_session, "push_del@test.com", "Delete Push")
        headers = _auth_headers(user)

        token_str = "ExponentPushToken[delete_me_token]"
        client.post("/users/me/device-token", json={"token": token_str, "platform": "ios"}, headers=headers)

        resp = client.request("DELETE", "/users/me/device-token", json={"token": token_str, "platform": "ios"}, headers=headers)
        assert resp.status_code == 200
        assert "removed" in resp.json()["message"].lower()

    def test_remove_nonexistent_token_still_200(self, db_session):
        """Removing a token that was never registered is a no-op, not an error."""
        user = _make_user(db_session, "push_noexist@test.com", "No Exist")
        headers = _auth_headers(user)
        resp = client.request(
            "DELETE",
            "/users/me/device-token",
            json={"token": "ExponentPushToken[never_registered]", "platform": "ios"},
            headers=headers,
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# CRUD layer: register_device_token / get_device_tokens_for_user
# ---------------------------------------------------------------------------

class TestDeviceTokenCrud:
    def test_register_and_retrieve(self, db_session):
        user = _make_user(db_session, "push_crud@test.com", "CRUD Push")
        token = crud.register_device_token(db_session, user.id, "ExponentPushToken[crud_tok]", "android")

        assert token.id is not None
        assert token.user_id == user.id
        assert token.platform == "android"

        tokens = crud.get_device_tokens_for_user(db_session, user.id)
        assert any(t.token == "ExponentPushToken[crud_tok]" for t in tokens)

    def test_upsert_updates_existing(self, db_session):
        user = _make_user(db_session, "push_upsert@test.com", "Upsert Push")
        tok = "ExponentPushToken[upsert_tok]"
        t1 = crud.register_device_token(db_session, user.id, tok, "ios")
        t2 = crud.register_device_token(db_session, user.id, tok, "android")  # same token, new platform

        assert t1.id == t2.id
        assert t2.platform == "android"

    def test_remove_token(self, db_session):
        user = _make_user(db_session, "push_rm@test.com", "Remove Push")
        tok = "ExponentPushToken[remove_tok]"
        crud.register_device_token(db_session, user.id, tok, "ios")

        removed = crud.remove_device_token(db_session, user.id, tok)
        assert removed is True

        tokens = crud.get_device_tokens_for_user(db_session, user.id)
        assert not any(t.token == tok for t in tokens)

    def test_remove_nonexistent_returns_false(self, db_session):
        user = _make_user(db_session, "push_rmnone@test.com", "Remove None")
        removed = crud.remove_device_token(db_session, user.id, "ExponentPushToken[ghost]")
        assert removed is False


# ---------------------------------------------------------------------------
# create_notification: push dispatch is fire-and-forget
# ---------------------------------------------------------------------------

class TestCreateNotificationPushDispatch:
    def test_notification_created_even_if_push_fails(self, db_session):
        """A network error in _send_expo_push must not prevent notification creation."""
        user = _make_user(db_session, "push_notif@test.com", "Push Notif")
        # Register a token so the push code path is exercised
        crud.register_device_token(db_session, user.id, "ExponentPushToken[notif_tok]", "ios")

        with patch("app.crud.httpx.post", side_effect=Exception("network down")):
            notif = crud.create_notification(
                db=db_session,
                user_id=user.id,
                type="like",
                title="Someone liked your podcast",
                message="Check it out!",
            )

        assert notif.id is not None
        assert notif.type == "like"

    def test_notification_created_with_no_tokens(self, db_session):
        """Notification creation works normally when the user has no device tokens."""
        user = _make_user(db_session, "push_notok@test.com", "No Tokens")
        notif = crud.create_notification(
            db=db_session,
            user_id=user.id,
            type="comment",
            title="New comment",
            message="Someone commented",
        )
        assert notif.id is not None

    def test_push_payload_includes_podcast_id_when_provided(self, db_session):
        """podcastId must appear in the Expo push data when podcast_id is set.

        _send_expo_push calls httpx.post with json=list_of_messages, where each
        message dict has a 'data' key forwarded to the Expo recipient app.
        """
        user = _make_user(db_session, "push_payload_with@test.com", "Payload With")
        crud.register_device_token(db_session, user.id, "ExponentPushToken[payload_with]", "android")

        mock_post = MagicMock()
        mock_post.return_value.status_code = 200
        with patch("app.crud.httpx.post", mock_post):
            crud.create_notification(
                db=db_session,
                user_id=user.id,
                type="like",
                title="Liked",
                message="Someone liked your podcast",
                podcast_id=42,
            )

        assert mock_post.called
        # json= kwarg is a list of Expo message objects (one per device token)
        messages = mock_post.call_args.kwargs["json"]
        assert isinstance(messages, list) and len(messages) == 1
        assert messages[0]["data"]["podcastId"] == 42
        assert messages[0]["data"]["type"] == "like"

    def test_push_payload_omits_podcast_id_when_not_provided(self, db_session):
        """podcastId must NOT appear in the Expo push data when podcast_id is None."""
        user = _make_user(db_session, "push_payload_without@test.com", "Payload Without")
        crud.register_device_token(db_session, user.id, "ExponentPushToken[payload_without]", "ios")

        mock_post = MagicMock()
        mock_post.return_value.status_code = 200
        with patch("app.crud.httpx.post", mock_post):
            crud.create_notification(
                db=db_session,
                user_id=user.id,
                type="comment",
                title="New comment",
                message="Someone commented",
                # podcast_id intentionally omitted
            )

        assert mock_post.called
        messages = mock_post.call_args.kwargs["json"]
        assert isinstance(messages, list) and len(messages) == 1
        assert "podcastId" not in messages[0]["data"]
