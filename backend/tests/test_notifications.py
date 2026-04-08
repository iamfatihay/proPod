"""Tests for the /notifications endpoints.

Covers:
- GET /notifications — list, pagination, unread count
- PATCH /notifications/{id}/read — mark single as read
- POST /notifications/mark-all-read — mark all as read
- Notification creation side-effects on like and comment
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import crud, models
from app.database import SessionLocal
from app.auth import create_access_token, get_password_hash

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(db, email: str, name: str) -> models.User:
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        return existing
    user = models.User(
        email=email,
        name=name,
        hashed_password=get_password_hash("password123"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_podcast(db, owner: models.User, title: str = "Test Podcast") -> models.Podcast:
    podcast = models.Podcast(
        title=title,
        description="A test podcast",
        owner_id=owner.id,
        is_public=True,
        audio_url="https://cdn.example.com/audio.mp3",
    )
    db.add(podcast)
    db.commit()
    db.refresh(podcast)
    return podcast


def _auth(user: models.User) -> dict:
    token = create_access_token({"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# GET /notifications
# ---------------------------------------------------------------------------

class TestListNotifications:
    def test_returns_empty_for_new_user(self, db_session):
        user = _make_user(db_session, "notif_list@example.com", "List User")
        resp = client.get("/notifications/", headers=_auth(user))
        assert resp.status_code == 200
        data = resp.json()
        assert data["notifications"] == []
        assert data["total"] == 0
        assert data["unread_count"] == 0

    def test_returns_user_notifications(self, db_session):
        user = _make_user(db_session, "notif_has@example.com", "Has Notifs")
        crud.create_notification(
            db_session, user_id=user.id, type="system",
            title="Welcome", message="Thanks for joining!",
        )
        resp = client.get("/notifications/", headers=_auth(user))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert data["unread_count"] >= 1
        titles = [n["title"] for n in data["notifications"]]
        assert "Welcome" in titles

    def test_unauthenticated_returns_401(self):
        resp = client.get("/notifications/")
        assert resp.status_code == 401

    def test_notifications_are_user_scoped(self, db_session):
        """Notifications for user A must NOT appear in user B's list."""
        user_a = _make_user(db_session, "notif_a@example.com", "User A")
        user_b = _make_user(db_session, "notif_b@example.com", "User B")
        crud.create_notification(
            db_session, user_id=user_a.id, type="system",
            title="Only For A", message="Private",
        )
        resp = client.get("/notifications/", headers=_auth(user_b))
        titles = [n["title"] for n in resp.json()["notifications"]]
        assert "Only For A" not in titles

    def test_pagination_limit(self, db_session):
        user = _make_user(db_session, "notif_page@example.com", "Pager")
        for i in range(5):
            crud.create_notification(
                db_session, user_id=user.id, type="system",
                title=f"Notif {i}", message="msg",
            )
        resp = client.get("/notifications/?limit=3", headers=_auth(user))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["notifications"]) == 3
        assert data["has_more"] is True


# ---------------------------------------------------------------------------
# PATCH /notifications/{id}/read
# ---------------------------------------------------------------------------

class TestMarkSingleRead:
    def test_mark_own_notification_read(self, db_session):
        user = _make_user(db_session, "notif_read@example.com", "Read User")
        notif = crud.create_notification(
            db_session, user_id=user.id, type="system",
            title="Unread", message="Mark me",
        )
        assert notif.read is False

        resp = client.patch(f"/notifications/{notif.id}/read", headers=_auth(user))
        assert resp.status_code == 200
        assert resp.json()["read"] is True

    def test_cannot_mark_other_users_notification(self, db_session):
        owner = _make_user(db_session, "notif_owner@example.com", "Owner")
        thief = _make_user(db_session, "notif_thief@example.com", "Thief")
        notif = crud.create_notification(
            db_session, user_id=owner.id, type="system",
            title="Owner Only", message="Private",
        )
        resp = client.patch(f"/notifications/{notif.id}/read", headers=_auth(thief))
        assert resp.status_code == 404

    def test_mark_nonexistent_returns_404(self, db_session):
        user = _make_user(db_session, "notif_noexist@example.com", "No Exist")
        resp = client.patch("/notifications/999999/read", headers=_auth(user))
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /notifications/mark-all-read
# ---------------------------------------------------------------------------

class TestMarkAllRead:
    def test_marks_all_as_read(self, db_session):
        user = _make_user(db_session, "notif_all@example.com", "All User")
        for i in range(3):
            crud.create_notification(
                db_session, user_id=user.id, type="system",
                title=f"N{i}", message="msg",
            )

        resp = client.post("/notifications/mark-all-read", headers=_auth(user))
        assert resp.status_code == 200

        # Verify via list endpoint
        list_resp = client.get("/notifications/", headers=_auth(user))
        assert list_resp.json()["unread_count"] == 0

    def test_unauthenticated_returns_401(self):
        resp = client.post("/notifications/mark-all-read")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Side-effect: like creates notification for podcast owner
# ---------------------------------------------------------------------------

class TestLikeNotification:
    def test_like_creates_notification_for_owner(self, db_session):
        owner = _make_user(db_session, "like_owner@example.com", "Pod Owner")
        liker = _make_user(db_session, "like_liker@example.com", "Liker")
        podcast = _make_podcast(db_session, owner, "Great Show")

        resp = client.post(
            f"/podcasts/{podcast.id}/like",
            headers=_auth(liker),
        )
        assert resp.status_code == 200

        # Owner should now have a 'like' notification
        notifs = crud.get_notifications(db_session, user_id=owner.id)[0]
        like_notifs = [n for n in notifs if n.type == "like" and n.podcast_id == podcast.id]
        assert len(like_notifs) >= 1
        assert "Liker" in like_notifs[0].message

    def test_self_like_does_not_create_notification(self, db_session):
        user = _make_user(db_session, "self_like@example.com", "Self Liker")
        podcast = _make_podcast(db_session, user, "My Own Show")

        # Count notifications before
        before = len(crud.get_notifications(db_session, user_id=user.id)[0])

        # Avoid duplicate-like error from previous runs by unliking first
        existing = db_session.query(models.PodcastLike).filter(
            models.PodcastLike.user_id == user.id,
            models.PodcastLike.podcast_id == podcast.id,
        ).first()
        if existing:
            db_session.delete(existing)
            db_session.commit()

        resp = client.post(f"/podcasts/{podcast.id}/like", headers=_auth(user))
        assert resp.status_code == 200

        after = len(crud.get_notifications(db_session, user_id=user.id)[0])
        # No new notification should have been added for a self-like
        assert after == before


# ---------------------------------------------------------------------------
# Side-effect: comment creates notification for podcast owner
# ---------------------------------------------------------------------------

class TestCommentNotification:
    def test_comment_creates_notification_for_owner(self, db_session):
        owner = _make_user(db_session, "comment_owner@example.com", "Comment Owner")
        commenter = _make_user(db_session, "comment_commenter@example.com", "Commenter")
        podcast = _make_podcast(db_session, owner, "Podcast To Comment")

        resp = client.post(
            f"/podcasts/{podcast.id}/comments",
            json={"podcast_id": podcast.id, "content": "Amazing episode!"},
            headers=_auth(commenter),
        )
        assert resp.status_code == 200

        notifs = crud.get_notifications(db_session, user_id=owner.id)[0]
        comment_notifs = [n for n in notifs if n.type == "comment" and n.podcast_id == podcast.id]
        assert len(comment_notifs) >= 1
        assert "Amazing episode" in comment_notifs[0].message

    def test_self_comment_does_not_create_notification(self, db_session):
        user = _make_user(db_session, "self_comment@example.com", "Self Commenter")
        podcast = _make_podcast(db_session, user, "My Podcast")

        before = len(crud.get_notifications(db_session, user_id=user.id)[0])

        resp = client.post(
            f"/podcasts/{podcast.id}/comments",
            json={"podcast_id": podcast.id, "content": "My own comment"},
            headers=_auth(user),
        )
        assert resp.status_code == 200

        after = len(crud.get_notifications(db_session, user_id=user.id)[0])
        assert after == before
