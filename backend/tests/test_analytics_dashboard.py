"""Tests for the creator analytics dashboard endpoint.

Covers: aggregate stats, top podcasts, recent engagement, category distribution,
empty state, time window parameter, and authentication requirements.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models import (
    User, Podcast, PodcastStats, PodcastLike, PodcastBookmark,
    PodcastComment, ListeningHistory,
)
from app import crud, schemas
from app.auth import create_access_token

client = TestClient(app)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _cleanup_user(db, user):
    """Remove all data associated with a user."""
    db.query(PodcastComment).filter(PodcastComment.user_id == user.id).delete()
    db.query(ListeningHistory).filter(ListeningHistory.user_id == user.id).delete()
    db.query(PodcastBookmark).filter(PodcastBookmark.user_id == user.id).delete()
    db.query(PodcastLike).filter(PodcastLike.user_id == user.id).delete()

    podcast_ids = [p.id for p in db.query(Podcast).filter(Podcast.owner_id == user.id).all()]
    if podcast_ids:
        db.query(PodcastComment).filter(PodcastComment.podcast_id.in_(podcast_ids)).delete(synchronize_session=False)
        db.query(ListeningHistory).filter(ListeningHistory.podcast_id.in_(podcast_ids)).delete(synchronize_session=False)
        db.query(PodcastBookmark).filter(PodcastBookmark.podcast_id.in_(podcast_ids)).delete(synchronize_session=False)
        db.query(PodcastLike).filter(PodcastLike.podcast_id.in_(podcast_ids)).delete(synchronize_session=False)
        db.query(PodcastStats).filter(PodcastStats.podcast_id.in_(podcast_ids)).delete(synchronize_session=False)
        db.query(Podcast).filter(Podcast.owner_id == user.id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def creator(db_session):
    """Create a creator user with token, clean up after."""
    db = db_session
    existing = db.query(User).filter(User.email == "analytics_creator@test.com").first()
    if existing:
        _cleanup_user(db, existing)

    user_data = schemas.UserCreate(
        email="analytics_creator@test.com",
        name="Analytics Creator",
        password="testpassword123",
    )
    user = crud.create_user(db, user_data)
    token = create_access_token(data={"sub": user.email})

    yield {"user": user, "token": token, "db": db}

    _cleanup_user(db, user)


@pytest.fixture
def listener(db_session):
    """Create a listener user who interacts with the creator's podcasts."""
    db = db_session
    existing = db.query(User).filter(User.email == "analytics_listener@test.com").first()
    if existing:
        _cleanup_user(db, existing)

    user_data = schemas.UserCreate(
        email="analytics_listener@test.com",
        name="Analytics Listener",
        password="testpassword123",
    )
    user = crud.create_user(db, user_data)
    token = create_access_token(data={"sub": user.email})

    yield {"user": user, "token": token, "db": db}

    _cleanup_user(db, user)


@pytest.fixture
def creator_with_podcasts(creator):
    """Create a creator with 3 podcasts in different categories."""
    db = creator["db"]
    user_id = creator["user"].id

    podcasts = []
    categories = ["Technology", "Science", "Technology"]
    for i, cat in enumerate(categories):
        p_data = schemas.PodcastCreate(
            title=f"Analytics Test Podcast {i+1}",
            description=f"Test podcast {i+1} for analytics",
            category=cat,
            is_public=True,
            duration=300 + i * 60,
        )
        podcast = crud.create_podcast(db, p_data, owner_id=user_id)
        podcasts.append(podcast)

    creator["podcasts"] = podcasts
    return creator


# ===========================================================================
# Tests
# ===========================================================================

class TestDashboardAuth:
    """Authentication and authorization for GET /analytics/dashboard."""

    def test_unauthenticated_returns_401(self):
        response = client.get("/analytics/dashboard")
        assert response.status_code == 401

    def test_authenticated_returns_200(self, creator):
        response = client.get(
            "/analytics/dashboard",
            headers=_auth_header(creator["token"]),
        )
        assert response.status_code == 200


class TestDashboardEmptyState:
    """Dashboard with no podcasts returns zeroed-out response."""

    def test_empty_dashboard(self, creator):
        response = client.get(
            "/analytics/dashboard",
            headers=_auth_header(creator["token"]),
        )
        assert response.status_code == 200
        data = response.json()

        assert data["total_podcasts"] == 0
        assert data["total_plays"] == 0
        assert data["total_likes"] == 0
        assert data["total_bookmarks"] == 0
        assert data["total_comments"] == 0
        assert data["average_completion_rate"] == 0.0
        assert data["top_podcasts"] == []
        assert data["recent_likes"] == 0
        assert data["recent_bookmarks"] == 0
        assert data["recent_comments"] == 0
        assert data["category_distribution"] == []
        assert data["days"] == 30  # default


class TestDashboardAggregates:
    """Aggregate totals across podcasts."""

    def test_total_podcasts_count(self, creator_with_podcasts):
        response = client.get(
            "/analytics/dashboard",
            headers=_auth_header(creator_with_podcasts["token"]),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_podcasts"] == 3

    def test_play_count_aggregation(self, creator_with_podcasts):
        """Manually set play counts and verify aggregate."""
        db = creator_with_podcasts["db"]
        podcasts = creator_with_podcasts["podcasts"]

        # Set play counts: 10, 20, 30
        for i, podcast in enumerate(podcasts):
            stats = db.query(PodcastStats).filter(
                PodcastStats.podcast_id == podcast.id
            ).first()
            if stats:
                stats.play_count = (i + 1) * 10
        db.commit()

        response = client.get(
            "/analytics/dashboard",
            headers=_auth_header(creator_with_podcasts["token"]),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_plays"] == 60  # 10 + 20 + 30


class TestDashboardTopPodcasts:
    """Top podcasts by play count."""

    def test_top_podcasts_ordered_by_plays(self, creator_with_podcasts):
        db = creator_with_podcasts["db"]
        podcasts = creator_with_podcasts["podcasts"]

        # Set different play counts
        play_counts = [5, 50, 25]
        for i, podcast in enumerate(podcasts):
            stats = db.query(PodcastStats).filter(
                PodcastStats.podcast_id == podcast.id
            ).first()
            if stats:
                stats.play_count = play_counts[i]
        db.commit()

        response = client.get(
            "/analytics/dashboard",
            headers=_auth_header(creator_with_podcasts["token"]),
        )
        assert response.status_code == 200
        data = response.json()

        top = data["top_podcasts"]
        assert len(top) == 3
        # First should be highest play count (50)
        assert top[0]["play_count"] == 50
        assert top[0]["title"] == "Analytics Test Podcast 2"
        # Play counts should be descending
        assert top[0]["play_count"] >= top[1]["play_count"] >= top[2]["play_count"]

    def test_top_podcasts_contain_expected_fields(self, creator_with_podcasts):
        response = client.get(
            "/analytics/dashboard",
            headers=_auth_header(creator_with_podcasts["token"]),
        )
        assert response.status_code == 200
        data = response.json()

        for entry in data["top_podcasts"]:
            assert "id" in entry
            assert "title" in entry
            assert "category" in entry
            assert "created_at" in entry
            assert "play_count" in entry
            assert "like_count" in entry
            assert "bookmark_count" in entry


class TestDashboardRecentEngagement:
    """Recent likes, bookmarks, and comments within time window."""

    def test_recent_likes_counted(self, creator_with_podcasts, listener):
        """Listener likes a podcast; creator's dashboard reflects it."""
        podcast = creator_with_podcasts["podcasts"][0]

        # Listener likes the podcast
        resp = client.post(
            f"/podcasts/{podcast.id}/like",
            headers=_auth_header(listener["token"]),
        )
        assert resp.status_code == 200

        response = client.get(
            "/analytics/dashboard",
            headers=_auth_header(creator_with_podcasts["token"]),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["recent_likes"] >= 1
        assert data["total_likes"] >= 1

    def test_recent_bookmarks_counted(self, creator_with_podcasts, listener):
        """Listener bookmarks a podcast; creator's dashboard reflects it."""
        podcast = creator_with_podcasts["podcasts"][1]

        resp = client.post(
            f"/podcasts/{podcast.id}/bookmark",
            headers=_auth_header(listener["token"]),
        )
        assert resp.status_code == 200

        response = client.get(
            "/analytics/dashboard",
            headers=_auth_header(creator_with_podcasts["token"]),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["recent_bookmarks"] >= 1
        assert data["total_bookmarks"] >= 1

    def test_recent_comments_counted(self, creator_with_podcasts, listener):
        """Listener comments on a podcast; creator's dashboard reflects it."""
        podcast = creator_with_podcasts["podcasts"][0]

        resp = client.post(
            f"/podcasts/{podcast.id}/comments",
            json={
                "podcast_id": podcast.id,
                "content": "Nice analytics test!",
                "timestamp": 15,
            },
            headers=_auth_header(listener["token"]),
        )
        assert resp.status_code == 200

        response = client.get(
            "/analytics/dashboard",
            headers=_auth_header(creator_with_podcasts["token"]),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["recent_comments"] >= 1


class TestDashboardCategoryDistribution:
    """Category distribution across creator's podcasts."""

    def test_category_distribution(self, creator_with_podcasts):
        response = client.get(
            "/analytics/dashboard",
            headers=_auth_header(creator_with_podcasts["token"]),
        )
        assert response.status_code == 200
        data = response.json()
        dist = data["category_distribution"]

        # We created 2 Technology + 1 Science podcasts
        assert len(dist) == 2
        # Technology should be first (count=2)
        tech = next((d for d in dist if d["category"] == "Technology"), None)
        science = next((d for d in dist if d["category"] == "Science"), None)
        assert tech is not None
        assert tech["count"] == 2
        assert science is not None
        assert science["count"] == 1


class TestDashboardCompletionRate:
    """Average completion rate across listening history."""

    def test_completion_rate_calculation(self, creator_with_podcasts, listener):
        """Create listening history entries and verify completion rate."""
        db = creator_with_podcasts["db"]
        podcasts = creator_with_podcasts["podcasts"]

        # Listener listens to podcast 1 and completes it
        crud.update_listening_history(
            db, listener["user"].id, podcasts[0].id,
            position=300, listen_time=300, completed=True,
        )
        # Listener listens to podcast 2 but doesn't complete
        crud.update_listening_history(
            db, listener["user"].id, podcasts[1].id,
            position=100, listen_time=100, completed=False,
        )

        response = client.get(
            "/analytics/dashboard",
            headers=_auth_header(creator_with_podcasts["token"]),
        )
        assert response.status_code == 200
        data = response.json()
        # 1 out of 2 = 50%
        assert data["average_completion_rate"] == 50.0


class TestDashboardTimeWindow:
    """Time window parameter validation and behavior."""

    def test_custom_days_parameter(self, creator):
        response = client.get(
            "/analytics/dashboard",
            params={"days": 7},
            headers=_auth_header(creator["token"]),
        )
        assert response.status_code == 200
        assert response.json()["days"] == 7

    def test_days_minimum_validation(self, creator):
        response = client.get(
            "/analytics/dashboard",
            params={"days": 0},
            headers=_auth_header(creator["token"]),
        )
        assert response.status_code == 422

    def test_days_maximum_validation(self, creator):
        response = client.get(
            "/analytics/dashboard",
            params={"days": 999},
            headers=_auth_header(creator["token"]),
        )
        assert response.status_code == 422


class TestDashboardIsolation:
    """Creator only sees their own data, not other creators'."""

    def test_creator_does_not_see_other_users_podcasts(self, creator_with_podcasts, listener):
        """Listener creates a podcast; it shouldn't appear in creator's dashboard."""
        db = listener["db"]
        p_data = schemas.PodcastCreate(
            title="Listener's Podcast",
            description="Not the creator's",
            category="Music",
            is_public=True,
            duration=120,
        )
        listener_podcast = crud.create_podcast(db, p_data, owner_id=listener["user"].id)

        response = client.get(
            "/analytics/dashboard",
            headers=_auth_header(creator_with_podcasts["token"]),
        )
        assert response.status_code == 200
        data = response.json()

        # Creator still has 3 podcasts, not 4
        assert data["total_podcasts"] == 3

        # None of the top podcasts should be the listener's
        for entry in data["top_podcasts"]:
            assert entry["id"] != listener_podcast.id
