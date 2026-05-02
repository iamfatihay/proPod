"""
Tests for the creator follow / unfollow feature.

Covers:
- POST /users/{user_id}/follow   â authenticated follow
- DELETE /users/{user_id}/follow â authenticated unfollow
- GET /users/me/following         â paginated following list
- GET /users/{user_id}/profile    â total_followers and is_following fields
- Guard: cannot follow yourself
- Guard: duplicate follow returns 400
- Guard: unfollow non-existent follow returns 404
- Guard: unauthenticated profile request sets is_following = False

NOTE: Uses the shared conftest db_session and TestClient so it doesn't
interfere with other test modules via app.dependency_overrides.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import models, auth
from app.auth import get_password_hash

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers â create test data directly in the conftest db_session database
# ---------------------------------------------------------------------------

def _make_user(db, email: str, name: str = "Test User") -> models.User:
    """Create a fresh user; skip if the email already exists (test isolation)."""
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        return existing
    user = models.User(
        email=email,
        name=name,
        hashed_password=get_password_hash("password123"),
        provider="local",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_header(user: models.User) -> dict:
    token = auth.create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


def _cleanup_follows(db):
    """Remove all follow rows to keep tests independent."""
    db.query(models.UserFollow).delete(synchronize_session=False)
    db.commit()


# ---------------------------------------------------------------------------
# Tests â follow / unfollow
# ---------------------------------------------------------------------------

class TestFollowCreator:
    """POST /users/{user_id}/follow"""

    def test_follow_returns_201(self, db_session):
        _cleanup_follows(db_session)
        follower = _make_user(db_session, "tc_follower1@example.com", "Follower1")
        creator  = _make_user(db_session, "tc_creator1@example.com",  "Creator1")

        resp = client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))
        assert resp.status_code == 201

    def test_follow_response_body(self, db_session):
        _cleanup_follows(db_session)
        follower = _make_user(db_session, "tc_follower2@example.com", "Follower2")
        creator  = _make_user(db_session, "tc_creator2@example.com",  "Creator2")

        resp = client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))
        assert resp.json()["detail"] == "Now following"

    def test_cannot_follow_yourself(self, db_session):
        user = _make_user(db_session, "tc_self@example.com", "Self")
        resp = client.post(f"/users/{user.id}/follow", headers=_auth_header(user))
        assert resp.status_code == 400

    def test_duplicate_follow_returns_400(self, db_session):
        _cleanup_follows(db_session)
        follower = _make_user(db_session, "tc_follower3@example.com", "Follower3")
        creator  = _make_user(db_session, "tc_creator3@example.com",  "Creator3")

        client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))
        resp = client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))
        assert resp.status_code == 400

    def test_follow_nonexistent_user_returns_404(self, db_session):
        user = _make_user(db_session, "tc_follower4@example.com", "Follower4")
        resp = client.post("/users/99999/follow", headers=_auth_header(user))
        assert resp.status_code == 404

    def test_unauthenticated_follow_returns_401(self, db_session):
        creator = _make_user(db_session, "tc_creator5@example.com", "Creator5")
        resp = client.post(f"/users/{creator.id}/follow")
        assert resp.status_code == 401


class TestUnfollowCreator:
    """DELETE /users/{user_id}/follow"""

    def test_unfollow_returns_200(self, db_session):
        _cleanup_follows(db_session)
        follower = _make_user(db_session, "tu_follower1@example.com", "UFFollower1")
        creator  = _make_user(db_session, "tu_creator1@example.com",  "UFCreator1")

        client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))
        resp = client.delete(f"/users/{creator.id}/follow", headers=_auth_header(follower))
        assert resp.status_code == 200

    def test_unfollow_response_body(self, db_session):
        _cleanup_follows(db_session)
        follower = _make_user(db_session, "tu_follower2@example.com", "UFFollower2")
        creator  = _make_user(db_session, "tu_creator2@example.com",  "UFCreator2")

        client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))
        resp = client.delete(f"/users/{creator.id}/follow", headers=_auth_header(follower))
        assert resp.json()["detail"] == "Unfollowed"

    def test_unfollow_not_following_returns_404(self, db_session):
        follower = _make_user(db_session, "tu_follower3@example.com", "UFFollower3")
        creator  = _make_user(db_session, "tu_creator3@example.com",  "UFCreator3")
        _cleanup_follows(db_session)

        resp = client.delete(f"/users/{creator.id}/follow", headers=_auth_header(follower))
        assert resp.status_code == 404

    def test_unauthenticated_unfollow_returns_401(self, db_session):
        creator = _make_user(db_session, "tu_creator4@example.com", "UFCreator4")
        resp = client.delete(f"/users/{creator.id}/follow")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Tests â GET /users/me/following
# ---------------------------------------------------------------------------

class TestGetFollowingList:
    """GET /users/me/following"""

    def test_empty_following_list(self, db_session):
        _cleanup_follows(db_session)
        user = _make_user(db_session, "gfl_user1@example.com", "GFLUser1")
        resp = client.get("/users/me/following", headers=_auth_header(user))
        assert resp.status_code == 200
        data = resp.json()
        assert data["following"] == []
        assert data["total"] == 0

    def test_following_list_contains_followed_creators(self, db_session):
        _cleanup_follows(db_session)
        follower = _make_user(db_session, "gfl_follower@example.com", "GFLFollower")
        creator1 = _make_user(db_session, "gfl_creator1@example.com", "Creator One")
        creator2 = _make_user(db_session, "gfl_creator2@example.com", "Creator Two")

        client.post(f"/users/{creator1.id}/follow", headers=_auth_header(follower))
        client.post(f"/users/{creator2.id}/follow", headers=_auth_header(follower))

        resp = client.get("/users/me/following", headers=_auth_header(follower))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        names = {c["name"] for c in data["following"]}
        assert "Creator One" in names
        assert "Creator Two" in names

    def test_following_list_after_unfollow(self, db_session):
        _cleanup_follows(db_session)
        follower = _make_user(db_session, "gfl_unf@example.com", "GFLUnf")
        creator  = _make_user(db_session, "gfl_unfcr@example.com", "GFLUnfCr")

        client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))
        client.delete(f"/users/{creator.id}/follow", headers=_auth_header(follower))

        resp = client.get("/users/me/following", headers=_auth_header(follower))
        assert resp.json()["total"] == 0

    def test_unauthenticated_following_list_returns_401(self):
        resp = client.get("/users/me/following")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Tests â profile endpoint: total_followers + is_following
# ---------------------------------------------------------------------------

class TestProfileFollowerFields:
    """GET /users/{user_id}/profile â follower-related fields."""

    def test_profile_total_followers_initially_zero(self, db_session):
        _cleanup_follows(db_session)
        creator = _make_user(db_session, "pf_creator0@example.com", "PFCreator0")
        resp = client.get(f"/users/{creator.id}/profile")
        assert resp.status_code == 200
        assert resp.json()["total_followers"] == 0

    def test_profile_total_followers_increments_on_follow(self, db_session):
        _cleanup_follows(db_session)
        follower = _make_user(db_session, "pf_follower1@example.com", "PFFollower1")
        creator  = _make_user(db_session, "pf_creator1@example.com",  "PFCreator1")

        client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))

        resp = client.get(f"/users/{creator.id}/profile")
        assert resp.json()["total_followers"] == 1

    def test_profile_total_followers_decrements_on_unfollow(self, db_session):
        _cleanup_follows(db_session)
        follower = _make_user(db_session, "pf_follower2@example.com", "PFFollower2")
        creator  = _make_user(db_session, "pf_creator2@example.com",  "PFCreator2")

        client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))
        client.delete(f"/users/{creator.id}/follow", headers=_auth_header(follower))

        resp = client.get(f"/users/{creator.id}/profile")
        assert resp.json()["total_followers"] == 0

    def test_profile_multiple_followers(self, db_session):
        _cleanup_follows(db_session)
        creator = _make_user(db_session, "pf_multicr@example.com", "PFMultiCr")
        for i in range(3):
            f = _make_user(db_session, f"pf_mf{i}@example.com", f"MultiFollower{i}")
            client.post(f"/users/{creator.id}/follow", headers=_auth_header(f))

        resp = client.get(f"/users/{creator.id}/profile")
        assert resp.json()["total_followers"] == 3

    def test_is_following_false_for_unauthenticated(self, db_session):
        creator = _make_user(db_session, "pf_anon@example.com", "PFAnon")
        resp = client.get(f"/users/{creator.id}/profile")
        assert resp.json()["is_following"] is False

    def test_is_following_false_before_follow(self, db_session):
        _cleanup_follows(db_session)
        follower = _make_user(db_session, "pf_pre@example.com", "PFPre")
        creator  = _make_user(db_session, "pf_precr@example.com", "PFPreCr")

        resp = client.get(f"/users/{creator.id}/profile", headers=_auth_header(follower))
        assert resp.json()["is_following"] is False

    def test_is_following_true_after_follow(self, db_session):
        _cleanup_follows(db_session)
        follower = _make_user(db_session, "pf_post@example.com", "PFPost")
        creator  = _make_user(db_session, "pf_postcr@example.com", "PFPostCr")

        client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))
        resp = client.get(f"/users/{creator.id}/profile", headers=_auth_header(follower))
        assert resp.json()["is_following"] is True

    def test_is_following_false_after_unfollow(self, db_session):
        _cleanup_follows(db_session)
        follower = _make_user(db_session, "pf_unfpost@example.com", "PFUnfPost")
        creator  = _make_user(db_session, "pf_unfpostcr@example.com", "PFUnfPostCr")

        client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))
        client.delete(f"/users/{creator.id}/follow", headers=_auth_header(follower))
        resp = client.get(f"/users/{creator.id}/profile", headers=_auth_header(follower))
        assert resp.json()["is_following"] is False

    def test_own_profile_is_following_is_false(self, db_session):
        """A user looking at their own profile should see is_following = False."""
        user = _make_user(db_session, "pf_self@example.com", "PFSelf")
        resp = client.get(f"/users/{user.id}/profile", headers=_auth_header(user))
        assert resp.json()["is_following"] is False


# ---------------------------------------------------------------------------
# Tests – follow creates an in-app notification
# ---------------------------------------------------------------------------

class TestFollowNotification:
    """POST /users/{user_id}/follow creates a notification for the followed user."""

    def test_follow_creates_notification(self, db_session):
        _cleanup_follows(db_session)
        follower = _make_user(db_session, "fn_follower@example.com", "FNFollower")
        creator  = _make_user(db_session, "fn_creator@example.com",  "FNCreator")

        resp = client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))
        assert resp.status_code == 201

        notif = (
            db_session.query(models.Notification)
            .filter(
                models.Notification.user_id == creator.id,
                models.Notification.type == "follow",
                models.Notification.actor_id == follower.id,
            )
            .first()
        )
        assert notif is not None, "expected a follow notification for the creator"
        assert "FNFollower" in notif.message

    def test_follow_notification_has_correct_type(self, db_session):
        _cleanup_follows(db_session)
        follower = _make_user(db_session, "fn2_follower@example.com", "FN2Follower")
        creator  = _make_user(db_session, "fn2_creator@example.com",  "FN2Creator")

        client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))

        notif = (
            db_session.query(models.Notification)
            .filter(
                models.Notification.user_id == creator.id,
                models.Notification.type == "follow",
            )
            .order_by(models.Notification.id.desc())
            .first()
        )
        assert notif is not None
        assert notif.type == "follow"
        assert notif.actor_id == follower.id
        assert notif.read is False

    def test_self_follow_blocked_no_notification(self, db_session):
        """Self-follow returns 400 and must not create a notification."""
        user = _make_user(db_session, "fn_self@example.com", "FNSelf")

        before = (
            db_session.query(models.Notification)
            .filter(models.Notification.user_id == user.id, models.Notification.type == "follow")
            .count()
        )
        client.post(f"/users/{user.id}/follow", headers=_auth_header(user))
        after = (
            db_session.query(models.Notification)
            .filter(models.Notification.user_id == user.id, models.Notification.type == "follow")
            .count()
        )
        assert before == after, "self-follow must not create a notification"
