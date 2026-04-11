"""
Tests for GET /podcasts/following-feed — personalised feed of podcasts
from creators the authenticated user follows.

Covers:
- 401 for unauthenticated requests
- Empty feed when user follows nobody
- Empty feed when followed creator has no public podcasts
- Public podcasts from followed creator appear in feed
- Private podcasts from followed creator do NOT appear
- Podcasts from non-followed creators do NOT appear
- Followed-creator podcasts ordered newest-first
- Pagination (skip / limit)
- Feed resets to empty after unfollowing
"""

import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app import models, auth
from app.auth import get_password_hash

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(db, email: str, name: str = "Test User") -> models.User:
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


def _make_podcast(
    db,
    owner: models.User,
    title: str = "Test Podcast",
    is_public: bool = True,
    created_offset_days: int = 0,
) -> models.Podcast:
    """Create a minimal podcast for testing."""
    podcast = models.Podcast(
        title=title,
        description="Test description",
        owner_id=owner.id,
        is_public=is_public,
        is_deleted=False,
        audio_url="http://example.com/audio.mp3",
        category="Technology",
        created_at=datetime.utcnow() - timedelta(days=created_offset_days),
    )
    db.add(podcast)
    db.commit()
    db.refresh(podcast)

    stats = models.PodcastStats(podcast_id=podcast.id)
    db.add(stats)
    db.commit()

    return podcast


def _auth_header(user: models.User) -> dict:
    token = auth.create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


def _cleanup(db, emails: list[str]):
    """Remove test data created by these users."""
    for email in emails:
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            db.query(models.UserFollow).filter(
                (models.UserFollow.follower_id == user.id) |
                (models.UserFollow.followed_id == user.id)
            ).delete(synchronize_session=False)
            for p in db.query(models.Podcast).filter(models.Podcast.owner_id == user.id).all():
                db.query(models.PodcastStats).filter(models.PodcastStats.podcast_id == p.id).delete(synchronize_session=False)
                db.delete(p)
    db.commit()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestFollowingFeedAuth:
    """Authentication guard."""

    def test_unauthenticated_returns_401(self):
        resp = client.get("/podcasts/following-feed")
        assert resp.status_code == 401


class TestFollowingFeedEmpty:
    """Empty-state scenarios."""

    def test_empty_when_following_nobody(self, db_session):
        emails = ["ff_lonely@example.com"]
        _cleanup(db_session, emails)

        user = _make_user(db_session, emails[0], "Lonely Listener")
        resp = client.get("/podcasts/following-feed", headers=_auth_header(user))

        assert resp.status_code == 200
        data = resp.json()
        assert data["podcasts"] == []
        assert data["total"] == 0
        assert data["has_more"] is False

    def test_empty_when_followed_creator_has_no_podcasts(self, db_session):
        emails = ["ff_follower_nopod@example.com", "ff_creator_nopod@example.com"]
        _cleanup(db_session, emails)

        follower = _make_user(db_session, emails[0], "Follower NoPod")
        creator  = _make_user(db_session, emails[1], "Creator NoPod")

        client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))

        resp = client.get("/podcasts/following-feed", headers=_auth_header(follower))
        assert resp.status_code == 200
        assert resp.json()["total"] == 0


class TestFollowingFeedContent:
    """Content correctness."""

    def test_public_podcasts_from_followed_creator_appear(self, db_session):
        emails = ["ff_fol1@example.com", "ff_cr1@example.com"]
        _cleanup(db_session, emails)

        follower = _make_user(db_session, emails[0], "Follower1")
        creator  = _make_user(db_session, emails[1], "Creator1")

        pod = _make_podcast(db_session, creator, title="Creator's Public Pod")
        client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))

        resp = client.get("/podcasts/following-feed", headers=_auth_header(follower))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["podcasts"][0]["id"] == pod.id

    def test_private_podcasts_do_not_appear(self, db_session):
        emails = ["ff_fol2@example.com", "ff_cr2@example.com"]
        _cleanup(db_session, emails)

        follower = _make_user(db_session, emails[0], "Follower2")
        creator  = _make_user(db_session, emails[1], "Creator2")

        _make_podcast(db_session, creator, title="Private Pod", is_public=False)
        client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))

        resp = client.get("/podcasts/following-feed", headers=_auth_header(follower))
        assert resp.json()["total"] == 0

    def test_non_followed_creator_podcasts_excluded(self, db_session):
        emails = ["ff_fol3@example.com", "ff_cr3@example.com", "ff_stranger3@example.com"]
        _cleanup(db_session, emails)

        follower  = _make_user(db_session, emails[0], "Follower3")
        creator   = _make_user(db_session, emails[1], "Creator3")
        stranger  = _make_user(db_session, emails[2], "Stranger3")

        followed_pod = _make_podcast(db_session, creator,  title="Followed Creator Pod")
        _make_podcast(db_session, stranger, title="Stranger Pod")
        client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))

        resp = client.get("/podcasts/following-feed", headers=_auth_header(follower))
        data = resp.json()
        assert data["total"] == 1
        assert data["podcasts"][0]["id"] == followed_pod.id

    def test_feed_ordered_newest_first(self, db_session):
        emails = ["ff_fol4@example.com", "ff_cr4@example.com"]
        _cleanup(db_session, emails)

        follower = _make_user(db_session, emails[0], "Follower4")
        creator  = _make_user(db_session, emails[1], "Creator4")

        old_pod = _make_podcast(db_session, creator, title="Old Pod",  created_offset_days=2)
        new_pod = _make_podcast(db_session, creator, title="New Pod",  created_offset_days=0)
        client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))

        resp = client.get("/podcasts/following-feed", headers=_auth_header(follower))
        ids = [p["id"] for p in resp.json()["podcasts"]]
        assert ids.index(new_pod.id) < ids.index(old_pod.id), "newest podcast should come first"

    def test_feed_clears_after_unfollow(self, db_session):
        emails = ["ff_fol5@example.com", "ff_cr5@example.com"]
        _cleanup(db_session, emails)

        follower = _make_user(db_session, emails[0], "Follower5")
        creator  = _make_user(db_session, emails[1], "Creator5")

        _make_podcast(db_session, creator, title="Creator5 Pod")
        client.post(f"/users/{creator.id}/follow",  headers=_auth_header(follower))
        client.delete(f"/users/{creator.id}/follow", headers=_auth_header(follower))

        resp = client.get("/podcasts/following-feed", headers=_auth_header(follower))
        assert resp.json()["total"] == 0


class TestFollowingFeedPagination:
    """Pagination (skip / limit)."""

    def test_limit_respected(self, db_session):
        emails = ["ff_fol_pg@example.com", "ff_cr_pg@example.com"]
        _cleanup(db_session, emails)

        follower = _make_user(db_session, emails[0], "FollowerPg")
        creator  = _make_user(db_session, emails[1], "CreatorPg")

        for i in range(5):
            _make_podcast(db_session, creator, title=f"Pod {i}", created_offset_days=i)
        client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))

        resp = client.get("/podcasts/following-feed?limit=3", headers=_auth_header(follower))
        data = resp.json()
        assert len(data["podcasts"]) == 3
        assert data["total"] == 5
        assert data["has_more"] is True

    def test_skip_returns_remaining_items(self, db_session):
        emails = ["ff_fol_sk@example.com", "ff_cr_sk@example.com"]
        _cleanup(db_session, emails)

        follower = _make_user(db_session, emails[0], "FollowerSk")
        creator  = _make_user(db_session, emails[1], "CreatorSk")

        for i in range(3):
            _make_podcast(db_session, creator, title=f"SkPod {i}", created_offset_days=i)
        client.post(f"/users/{creator.id}/follow", headers=_auth_header(follower))

        resp = client.get("/podcasts/following-feed?skip=2&limit=10", headers=_auth_header(follower))
        data = resp.json()
        assert len(data["podcasts"]) == 1
        assert data["has_more"] is False
