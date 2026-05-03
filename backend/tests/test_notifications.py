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
from app import crud, models, schemas
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


# ---------------------------------------------------------------------------
# Side-effect: publishing a new podcast notifies all followers
# ---------------------------------------------------------------------------

class TestNewEpisodeNotification:
    """Verify that create_podcast fans out 'new_episode' notifications to followers."""

    def _make_follow(self, db, follower: models.User, followed: models.User) -> None:
        """Create a follow relationship; skip if it already exists."""
        existing = db.query(models.UserFollow).filter(
            models.UserFollow.follower_id == follower.id,
            models.UserFollow.followed_id == followed.id,
        ).first()
        if existing:
            return
        follow = models.UserFollow(follower_id=follower.id, followed_id=followed.id)
        db.add(follow)
        db.commit()

    def _cleanup(self, db, *user_ids: int) -> None:
        """Remove follows and notifications for the given user IDs."""
        db.query(models.UserFollow).filter(
            models.UserFollow.follower_id.in_(user_ids)
            | models.UserFollow.followed_id.in_(user_ids)
        ).delete(synchronize_session=False)
        db.query(models.Notification).filter(
            models.Notification.user_id.in_(user_ids)
        ).delete(synchronize_session=False)
        db.commit()

    def test_two_followers_each_receive_notification(self, db_session):
        """Both followers of a creator get a new_episode notification."""
        creator   = _make_user(db_session, "ne_creator1@example.com",   "Creator One")
        follower1 = _make_user(db_session, "ne_follower1a@example.com", "Fan A")
        follower2 = _make_user(db_session, "ne_follower1b@example.com", "Fan B")
        self._cleanup(db_session, creator.id, follower1.id, follower2.id)

        self._make_follow(db_session, follower1, creator)
        self._make_follow(db_session, follower2, creator)

        podcast_data = schemas.PodcastCreate(
            title="Episode Zero",
            description="Pilot",
            category="Technology",
            is_public=True,
            duration=120,
            audio_url="https://cdn.example.com/ep0.mp3",
        )
        _pod = crud.create_podcast(db_session, podcast_data, owner_id=creator.id)
        # Fan-out is now a BackgroundTask in the router; tests call the helper directly.
        crud._notify_followers_new_episode(db=db_session, podcast=_pod, owner_id=creator.id)

        for fan_id in (follower1.id, follower2.id):
            notifs = crud.get_notifications(db_session, user_id=fan_id)[0]
            new_ep = [n for n in notifs if n.type == "new_episode"]
            assert len(new_ep) >= 1, f"Follower {fan_id} should have received a new_episode notification"

    def test_no_followers_means_no_notifications(self, db_session):
        """Publishing a podcast when the creator has no followers is a no-op."""
        lone_creator = _make_user(db_session, "ne_lone@example.com", "Lone Creator")
        self._cleanup(db_session, lone_creator.id)

        before_total = db_session.query(models.Notification).count()

        podcast_data = schemas.PodcastCreate(
            title="Solo Episode",
            description="Just me",
            category="Arts",
            is_public=True,
            duration=60,
            audio_url="https://cdn.example.com/solo.mp3",
        )
        _pod = crud.create_podcast(db_session, podcast_data, owner_id=lone_creator.id)
        # Fan-out is now a BackgroundTask in the router; tests call the helper directly.
        crud._notify_followers_new_episode(db=db_session, podcast=_pod, owner_id=lone_creator.id)

        after_total = db_session.query(models.Notification).count()
        # No new notifications should have been created
        assert after_total == before_total

    def test_notification_title_contains_creator_name(self, db_session):
        """Notification title says 'New episode from <creator name>'."""
        creator  = _make_user(db_session, "ne_creator2@example.com",  "Alice Podcast")
        follower = _make_user(db_session, "ne_follower2@example.com", "Bob Listener")
        self._cleanup(db_session, creator.id, follower.id)
        self._make_follow(db_session, follower, creator)

        podcast_data = schemas.PodcastCreate(
            title="Deep Dive #1",
            description="desc",
            category="Science",
            is_public=True,
            duration=180,
            audio_url="https://cdn.example.com/dd1.mp3",
        )
        _pod = crud.create_podcast(db_session, podcast_data, owner_id=creator.id)
        # Fan-out is now a BackgroundTask in the router; tests call the helper directly.
        crud._notify_followers_new_episode(db=db_session, podcast=_pod, owner_id=creator.id)

        notifs = crud.get_notifications(db_session, user_id=follower.id)[0]
        new_ep = [n for n in notifs if n.type == "new_episode"]
        assert new_ep, "Expected at least one new_episode notification"
        assert "Alice Podcast" in new_ep[0].title
        assert "New episode from" in new_ep[0].title

    def test_notification_message_contains_podcast_title(self, db_session):
        """Notification message includes the episode title."""
        creator  = _make_user(db_session, "ne_creator3@example.com",  "Charlie Show")
        follower = _make_user(db_session, "ne_follower3@example.com", "Dave Fan")
        self._cleanup(db_session, creator.id, follower.id)
        self._make_follow(db_session, follower, creator)

        podcast_data = schemas.PodcastCreate(
            title="The Great Reveal",
            description="desc",
            category="News",
            is_public=True,
            duration=240,
            audio_url="https://cdn.example.com/reveal.mp3",
        )
        _pod = crud.create_podcast(db_session, podcast_data, owner_id=creator.id)
        # Fan-out is now a BackgroundTask in the router; tests call the helper directly.
        crud._notify_followers_new_episode(db=db_session, podcast=_pod, owner_id=creator.id)

        notifs = crud.get_notifications(db_session, user_id=follower.id)[0]
        new_ep = [n for n in notifs if n.type == "new_episode"]
        assert new_ep, "Expected at least one new_episode notification"
        assert "The Great Reveal" in new_ep[0].message

    def test_notification_has_podcast_id_and_actor_id(self, db_session):
        """Notification rows carry podcast_id and actor_id for deep-linking."""
        creator  = _make_user(db_session, "ne_creator4@example.com",  "Eve Radio")
        follower = _make_user(db_session, "ne_follower4@example.com", "Frank Subscriber")
        self._cleanup(db_session, creator.id, follower.id)
        self._make_follow(db_session, follower, creator)

        podcast_data = schemas.PodcastCreate(
            title="Linked Episode",
            description="desc",
            category="Business",
            is_public=True,
            duration=300,
            audio_url="https://cdn.example.com/linked.mp3",
        )
        podcast = crud.create_podcast(db_session, podcast_data, owner_id=creator.id)
        # Fan-out is now a BackgroundTask in the router; tests call the helper directly.
        crud._notify_followers_new_episode(db=db_session, podcast=podcast, owner_id=creator.id)

        notifs = crud.get_notifications(db_session, user_id=follower.id)[0]
        new_ep = [n for n in notifs if n.type == "new_episode"]
        assert new_ep, "Expected at least one new_episode notification"
        n = new_ep[0]
        assert n.podcast_id == podcast.id
        assert n.actor_id == creator.id

    def test_private_podcast_does_not_notify_followers(self, db_session):
        """Followers must not receive notifications for private episodes."""
        creator  = _make_user(db_session, "ne_creator5@example.com",  "Private Creator")
        follower = _make_user(db_session, "ne_follower5@example.com", "Eager Follower")
        self._cleanup(db_session, creator.id, follower.id)
        self._make_follow(db_session, follower, creator)

        before = db_session.query(models.Notification).filter(
            models.Notification.user_id == follower.id,
            models.Notification.type == "new_episode",
        ).count()

        podcast_data = schemas.PodcastCreate(
            title="Secret Draft",
            description="not for public eyes",
            category="Technology",
            is_public=False,
            duration=60,
            audio_url="https://cdn.example.com/secret.mp3",
        )
        _pod = crud.create_podcast(db_session, podcast_data, owner_id=creator.id)
        # Fan-out is now a BackgroundTask in the router; tests call the helper directly.
        crud._notify_followers_new_episode(db=db_session, podcast=_pod, owner_id=creator.id)

        after = db_session.query(models.Notification).filter(
            models.Notification.user_id == follower.id,
            models.Notification.type == "new_episode",
        ).count()
        assert after == before, "Private podcast must not generate new_episode notifications"


# ---------------------------------------------------------------------------
# TestFollowNotification
# ---------------------------------------------------------------------------

class TestFollowNotification:
    """Verify that following a creator triggers in-app + Expo push notifications."""

    def _cleanup(self, db, *user_ids):
        db.query(models.UserFollow).filter(
            models.UserFollow.follower_id.in_(user_ids)
            | models.UserFollow.followed_id.in_(user_ids)
        ).delete(synchronize_session=False)
        db.query(models.Notification).filter(
            models.Notification.user_id.in_(user_ids)
        ).delete(synchronize_session=False)
        db.query(models.DeviceToken).filter(
            models.DeviceToken.user_id.in_(user_ids)
        ).delete(synchronize_session=False)
        db.commit()

    def test_follow_creates_in_app_notification(self, db_session):
        """POSTing to /{id}/follow creates a 'follow' in-app notification for the creator."""
        from unittest.mock import patch, MagicMock
        fan     = _make_user(db_session, "fn_fan@example.com",     "Fan")
        creator = _make_user(db_session, "fn_creator@example.com", "Creator")
        self._cleanup(db_session, fan.id, creator.id)

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": []}
        with patch("app.crud.httpx.post", return_value=mock_resp):
            resp = client.post(f"/users/{creator.id}/follow", headers=_auth(fan))
        assert resp.status_code == 201

        notif = (
            db_session.query(models.Notification)
            .filter(
                models.Notification.user_id == creator.id,
                models.Notification.type == "follow",
            )
            .first()
        )
        assert notif is not None
        assert notif.actor_id == fan.id
        assert "following" in notif.message.lower()

    def test_follow_sends_push_when_device_registered(self, db_session):
        """Expo push is sent with correct payload when the creator has a registered device token."""
        from unittest.mock import patch, MagicMock
        fan     = _make_user(db_session, "fp_fan@example.com",     "PushFan")
        creator = _make_user(db_session, "fp_creator@example.com", "PushCreator")
        self._cleanup(db_session, fan.id, creator.id)

        crud.register_device_token(db_session, creator.id, "ExponentPushToken[follow-push-test]", "ios")

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": [{"status": "ok", "id": "follow-ticket-001"}]}
        with patch("app.crud.httpx.post", return_value=mock_resp) as mock_post:
            resp = client.post(f"/users/{creator.id}/follow", headers=_auth(fan))
        assert resp.status_code == 201

        mock_post.assert_called_once()
        messages = mock_post.call_args.kwargs["json"]
        assert isinstance(messages, list) and len(messages) == 1
        assert messages[0]["data"]["type"] == "follow"
        assert messages[0]["data"]["actorId"] == fan.id

    def test_follow_no_push_when_no_device_token(self, db_session):
        """No Expo push is attempted when the followed creator has no device tokens."""
        from unittest.mock import patch
        fan     = _make_user(db_session, "np_fan@example.com",     "NoPushFan")
        creator = _make_user(db_session, "np_creator@example.com", "NoPushCreator")
        self._cleanup(db_session, fan.id, creator.id)

        with patch("app.crud.httpx.post") as mock_post:
            resp = client.post(f"/users/{creator.id}/follow", headers=_auth(fan))
        assert resp.status_code == 201
        mock_post.assert_not_called()


# ---------------------------------------------------------------------------
# Tests -- like / comment trigger Expo push notifications
# ---------------------------------------------------------------------------


class TestLikePushNotification:
    """like_podcast sends a best-effort Expo push to the podcast owner."""

    def _cleanup(self, db, *user_ids):
        db.query(models.PodcastLike).filter(
            models.PodcastLike.user_id.in_(user_ids)
        ).delete(synchronize_session=False)
        db.query(models.Notification).filter(
            models.Notification.user_id.in_(user_ids)
        ).delete(synchronize_session=False)
        db.query(models.DeviceToken).filter(
            models.DeviceToken.user_id.in_(user_ids)
        ).delete(synchronize_session=False)
        db.commit()

    def test_like_sends_push_when_device_registered(self, db_session):
        """Expo push fires with correct payload when the owner has a device token."""
        from unittest.mock import patch, MagicMock
        owner   = _make_user(db_session, "lp_owner@example.com",  "LikePushOwner")
        liker   = _make_user(db_session, "lp_liker@example.com",  "LikePushLiker")
        podcast = _make_podcast(db_session, owner, "Push-worthy Show")
        self._cleanup(db_session, owner.id, liker.id)

        crud.register_device_token(db_session, owner.id, "ExponentPushToken[like-push-test]", "ios")

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": [{"status": "ok", "id": "like-ticket-001"}]}
        with patch("app.crud.httpx.post", return_value=mock_resp) as mock_post:
            resp = client.post(f"/podcasts/{podcast.id}/like", headers=_auth(liker))
        assert resp.status_code == 200

        mock_post.assert_called_once()
        messages = mock_post.call_args.kwargs["json"]
        assert isinstance(messages, list) and len(messages) == 1
        assert messages[0]["data"]["type"] == "like"
        assert messages[0]["data"]["actorId"] == liker.id
        assert messages[0]["data"]["podcastId"] == podcast.id
    def test_like_no_push_when_no_device_token(self, db_session):
        """No Expo push is attempted when the owner has no registered device tokens."""
        from unittest.mock import patch
        owner   = _make_user(db_session, "lnp_owner@example.com", "LikeNoPushOwner")
        liker   = _make_user(db_session, "lnp_liker@example.com", "LikeNoPushLiker")
        podcast = _make_podcast(db_session, owner, "No Push Show")
        self._cleanup(db_session, owner.id, liker.id)

        with patch("app.crud.httpx.post") as mock_post:
            resp = client.post(f"/podcasts/{podcast.id}/like", headers=_auth(liker))
        assert resp.status_code == 200
        mock_post.assert_not_called()

    def test_self_like_no_push(self, db_session):
        """Owner liking their own podcast must not trigger a push notification."""
        from unittest.mock import patch
        owner   = _make_user(db_session, "lself_owner@example.com", "LikeSelfOwner")
        podcast = _make_podcast(db_session, owner, "Self Like Show")
        self._cleanup(db_session, owner.id)

        crud.register_device_token(db_session, owner.id, "ExponentPushToken[like-self-test]", "ios")

        with patch("app.crud.httpx.post") as mock_post:
            resp = client.post(f"/podcasts/{podcast.id}/like", headers=_auth(owner))
        assert resp.status_code == 200
        mock_post.assert_not_called()

class TestCommentPushNotification:
    """create_comment sends a best-effort Expo push to the podcast owner."""

    def _cleanup(self, db, *user_ids):
        db.query(models.PodcastComment).filter(
            models.PodcastComment.user_id.in_(user_ids)
        ).delete(synchronize_session=False)
        db.query(models.Notification).filter(
            models.Notification.user_id.in_(user_ids)
        ).delete(synchronize_session=False)
        db.query(models.DeviceToken).filter(
            models.DeviceToken.user_id.in_(user_ids)
        ).delete(synchronize_session=False)
        db.commit()

    def test_comment_sends_push_when_device_registered(self, db_session):
        """Expo push fires with correct payload when the owner has a device token."""
        from unittest.mock import patch, MagicMock
        owner     = _make_user(db_session, "cp_owner@example.com",     "CommentPushOwner")
        commenter = _make_user(db_session, "cp_commenter@example.com", "CommentPushLiker")
        podcast   = _make_podcast(db_session, owner, "Comment Push Show")
        self._cleanup(db_session, owner.id, commenter.id)

        crud.register_device_token(db_session, owner.id, "ExponentPushToken[comment-push-test]", "ios")

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": [{"status": "ok", "id": "comment-ticket-001"}]}
        with patch("app.crud.httpx.post", return_value=mock_resp) as mock_post:
            resp = client.post(
                f"/podcasts/{podcast.id}/comments",
                json={"podcast_id": podcast.id, "content": "Great episode!"},
                headers=_auth(commenter),
            )
        assert resp.status_code == 200

        mock_post.assert_called_once()
        messages = mock_post.call_args.kwargs["json"]
        assert isinstance(messages, list) and len(messages) == 1
        assert messages[0]["data"]["type"] == "comment"
        assert messages[0]["data"]["actorId"] == commenter.id
        assert messages[0]["data"]["podcastId"] == podcast.id
    def test_comment_no_push_when_no_device_token(self, db_session):
        """No Expo push is attempted when the owner has no registered device tokens."""
        from unittest.mock import patch
        owner     = _make_user(db_session, "cnp_owner@example.com",     "CommentNoPushOwner")
        commenter = _make_user(db_session, "cnp_commenter@example.com", "CommentNoPushCommenter")
        podcast   = _make_podcast(db_session, owner, "Comment No Push Show")
        self._cleanup(db_session, owner.id, commenter.id)

        with patch("app.crud.httpx.post") as mock_post:
            resp = client.post(
                f"/podcasts/{podcast.id}/comments",
                json={"podcast_id": podcast.id, "content": "No push comment"},
                headers=_auth(commenter),
            )
        assert resp.status_code == 200
        mock_post.assert_not_called()

    def test_self_comment_no_push(self, db_session):
        """Owner commenting on their own podcast must not trigger a push notification."""
        from unittest.mock import patch
        owner   = _make_user(db_session, "cself_owner@example.com", "CommentSelfOwner")
        podcast = _make_podcast(db_session, owner, "Self Comment Show")
        self._cleanup(db_session, owner.id)

        crud.register_device_token(db_session, owner.id, "ExponentPushToken[comment-self-test]", "ios")

        with patch("app.crud.httpx.post") as mock_post:
            resp = client.post(
                f"/podcasts/{podcast.id}/comments",
                json={"podcast_id": podcast.id, "content": "Talking to myself"},
                headers=_auth(owner),
            )
        assert resp.status_code == 200
        mock_post.assert_not_called()

