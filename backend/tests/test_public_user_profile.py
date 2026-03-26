"""
Tests for public user profile endpoints.

Covers:
- GET /users/{user_id}/profile — public profile with aggregate stats
- GET /users/{user_id}/podcasts — public podcast listing with pagination
- Edge cases: inactive users, private podcasts, deleted podcasts, empty profiles
- Aggregate stat accuracy (play counts, like counts)
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app import crud, schemas, models

client = TestClient(app)


# --------------- helpers ---------------

def _cleanup_user(db: Session, user: models.User):
    """Remove a user and all related data from the database."""
    # Delete podcast-related data
    for podcast in db.query(models.Podcast).filter(models.Podcast.owner_id == user.id).all():
        db.query(models.PodcastStats).filter(models.PodcastStats.podcast_id == podcast.id).delete()
        db.query(models.PodcastAIData).filter(models.PodcastAIData.podcast_id == podcast.id).delete()
        db.query(models.PodcastLike).filter(models.PodcastLike.podcast_id == podcast.id).delete()
        db.query(models.PodcastBookmark).filter(models.PodcastBookmark.podcast_id == podcast.id).delete()
        db.query(models.PodcastComment).filter(models.PodcastComment.podcast_id == podcast.id).delete()
        db.query(models.ListeningHistory).filter(models.ListeningHistory.podcast_id == podcast.id).delete()
    db.query(models.PodcastLike).filter(models.PodcastLike.user_id == user.id).delete()
    db.query(models.PodcastBookmark).filter(models.PodcastBookmark.user_id == user.id).delete()
    db.query(models.PodcastComment).filter(models.PodcastComment.user_id == user.id).delete()
    db.query(models.ListeningHistory).filter(models.ListeningHistory.user_id == user.id).delete()
    db.query(models.Podcast).filter(models.Podcast.owner_id == user.id).delete()
    db.query(models.User).filter(models.User.id == user.id).delete()
    db.commit()


def _create_podcast_with_stats(
    db: Session,
    owner_id: int,
    title: str,
    is_public: bool = True,
    is_deleted: bool = False,
    play_count: int = 0,
    like_count: int = 0,
):
    """Create a podcast with associated PodcastStats row."""
    podcast = models.Podcast(
        title=title,
        description=f"Description for {title}",
        owner_id=owner_id,
        is_public=is_public,
        is_deleted=is_deleted,
        category="Technology",
    )
    db.add(podcast)
    db.flush()

    stats = models.PodcastStats(
        podcast_id=podcast.id,
        play_count=play_count,
        like_count=like_count,
        bookmark_count=0,
        comment_count=0,
    )
    db.add(stats)
    db.commit()
    db.refresh(podcast)
    return podcast


# --------------- fixtures ---------------

@pytest.fixture
def db():
    """Yield a database session. Closed after each test; tests clean up their own committed state."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def profile_user(db):
    """Create a test user for profile tests. Cleaned up after test."""
    existing = db.query(models.User).filter(models.User.email == "profileuser@test.com").first()
    if existing:
        _cleanup_user(db, existing)

    user_create = schemas.UserCreate(
        email="profileuser@test.com",
        name="Profile Test User",
        password="testpassword123",
    )
    user = crud.create_user(db, user_create)

    yield user

    _cleanup_user(db, user)


@pytest.fixture
def profile_user_with_podcasts(db, profile_user):
    """Create a user with a mix of public, private, and deleted podcasts."""
    # 3 public podcasts with varying stats
    _create_podcast_with_stats(db, profile_user.id, "Public Pod 1", play_count=100, like_count=10)
    _create_podcast_with_stats(db, profile_user.id, "Public Pod 2", play_count=200, like_count=20)
    _create_podcast_with_stats(db, profile_user.id, "Public Pod 3", play_count=50, like_count=5)
    # 1 private podcast (should NOT appear in public profile/counts)
    _create_podcast_with_stats(db, profile_user.id, "Private Pod", is_public=False, play_count=999, like_count=99)
    # 1 deleted podcast (should NOT appear in public profile/counts)
    _create_podcast_with_stats(db, profile_user.id, "Deleted Pod", is_deleted=True, play_count=500, like_count=50)

    yield profile_user


@pytest.fixture
def inactive_user(db):
    """Create an inactive (soft-deleted) user."""
    existing = db.query(models.User).filter(models.User.email == "inactive@test.com").first()
    if existing:
        _cleanup_user(db, existing)

    user_create = schemas.UserCreate(
        email="inactive@test.com",
        name="Inactive User",
        password="testpassword123",
    )
    user = crud.create_user(db, user_create)
    # Deactivate
    user.is_active = False
    db.commit()
    db.refresh(user)

    yield user

    # Re-activate for cleanup (soft_delete_user checks is_active)
    user.is_active = True
    db.commit()
    _cleanup_user(db, user)


# ==================== GET /users/{user_id}/profile ====================


class TestGetUserProfile:
    """Tests for the GET /users/{user_id}/profile endpoint."""

    def test_profile_returns_basic_info(self, profile_user):
        """Profile response includes id, name, photo_url, created_at."""
        resp = client.get(f"/users/{profile_user.id}/profile")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == profile_user.id
        assert data["name"] == "Profile Test User"
        assert "created_at" in data
        # Email must NOT be exposed
        assert "email" not in data
        assert "hashed_password" not in data

    def test_profile_aggregate_stats_with_podcasts(self, profile_user_with_podcasts):
        """Aggregate stats count only public, non-deleted podcasts."""
        user = profile_user_with_podcasts
        resp = client.get(f"/users/{user.id}/profile")
        assert resp.status_code == 200
        data = resp.json()
        # Only 3 public non-deleted podcasts
        assert data["podcast_count"] == 3
        # Plays: 100 + 200 + 50 = 350 (excludes private 999 + deleted 500)
        assert data["total_plays"] == 350
        # Likes: 10 + 20 + 5 = 35 (excludes private 99 + deleted 50)
        assert data["total_likes"] == 35
        # Followers placeholder
        assert data["total_followers"] == 0

    def test_profile_empty_creator(self, profile_user):
        """User with no podcasts returns zero stats."""
        resp = client.get(f"/users/{profile_user.id}/profile")
        assert resp.status_code == 200
        data = resp.json()
        assert data["podcast_count"] == 0
        assert data["total_plays"] == 0
        assert data["total_likes"] == 0

    def test_profile_not_found(self):
        """Returns 404 for non-existent user ID."""
        resp = client.get("/users/999999/profile")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_profile_inactive_user_not_found(self, inactive_user):
        """Returns 404 for inactive (soft-deleted) users."""
        resp = client.get(f"/users/{inactive_user.id}/profile")
        assert resp.status_code == 404

    def test_profile_no_auth_required(self, profile_user):
        """Endpoint works without an Authorization header."""
        resp = client.get(
            f"/users/{profile_user.id}/profile",
            headers={},  # No auth
        )
        assert resp.status_code == 200


# ==================== GET /users/{user_id}/podcasts ====================


class TestGetUserPodcasts:
    """Tests for the GET /users/{user_id}/podcasts endpoint."""

    def test_returns_only_public_podcasts(self, db, profile_user_with_podcasts):
        """Response includes only public, non-deleted podcasts."""
        user = profile_user_with_podcasts
        resp = client.get(f"/users/{user.id}/podcasts")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 3
        titles = [p["title"] for p in data["podcasts"]]
        assert "Private Pod" not in titles
        assert "Deleted Pod" not in titles
        for title in ["Public Pod 1", "Public Pod 2", "Public Pod 3"]:
            assert title in titles

    def test_pagination_limit(self, profile_user_with_podcasts):
        """Pagination limit restricts returned results."""
        user = profile_user_with_podcasts
        resp = client.get(f"/users/{user.id}/podcasts?limit=2")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["podcasts"]) == 2
        assert data["total"] == 3
        assert data["has_more"] is True

    def test_pagination_skip(self, profile_user_with_podcasts):
        """Pagination skip offsets results correctly."""
        user = profile_user_with_podcasts
        resp = client.get(f"/users/{user.id}/podcasts?skip=2&limit=10")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["podcasts"]) == 1
        assert data["total"] == 3
        assert data["has_more"] is False

    def test_empty_podcast_list(self, profile_user):
        """User with no podcasts returns empty list."""
        resp = client.get(f"/users/{profile_user.id}/podcasts")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["podcasts"] == []
        assert data["has_more"] is False

    def test_user_not_found(self):
        """Returns 404 for non-existent user."""
        resp = client.get("/users/999999/podcasts")
        assert resp.status_code == 404

    def test_inactive_user_not_found(self, inactive_user):
        """Returns 404 for inactive users."""
        resp = client.get(f"/users/{inactive_user.id}/podcasts")
        assert resp.status_code == 404

    def test_no_auth_required(self, profile_user):
        """Endpoint works without an Authorization header."""
        resp = client.get(
            f"/users/{profile_user.id}/podcasts",
            headers={},
        )
        assert resp.status_code == 200

    def test_podcasts_sorted_newest_first(self, db, profile_user_with_podcasts):
        """Podcasts are returned in reverse chronological order.

        Uses (created_at, id) as a compound sort key to make the assertion
        stable even if multiple podcasts share the same timestamp.
        """
        user = profile_user_with_podcasts
        resp = client.get(f"/users/{user.id}/podcasts")
        assert resp.status_code == 200
        data = resp.json()
        podcasts = data["podcasts"]
        # Build compound sort key: (created_at desc, id desc) for tie-breaking
        sort_keys = [(p["created_at"], p["id"]) for p in podcasts]
        assert sort_keys == sorted(sort_keys, reverse=True), \
            "Podcasts should be sorted newest-first (by created_at, then id desc)"

    def test_podcast_response_includes_expected_fields(self, profile_user_with_podcasts):
        """Each podcast in the response has the expected schema fields."""
        user = profile_user_with_podcasts
        resp = client.get(f"/users/{user.id}/podcasts?limit=1")
        assert resp.status_code == 200
        podcast = resp.json()["podcasts"][0]
        expected_fields = {"id", "title", "description", "category", "is_public",
                           "duration", "created_at", "updated_at", "owner_id"}
        assert expected_fields.issubset(set(podcast.keys()))
