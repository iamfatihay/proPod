"""
Tests for the Creator Analytics Dashboard endpoints.

Covers:
- GET /analytics/dashboard (full dashboard)
- GET /analytics/stats (aggregate stats only)
- GET /analytics/top-podcasts (top performing podcasts)
- GET /analytics/categories (category breakdown)
- Authentication requirements
- Empty state (no podcasts)
- Correct stat aggregation with multiple podcasts
- sort_by parameter for top-podcasts
- Soft-deleted podcasts are excluded
"""
import datetime
from datetime import timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app import models, auth

# ---------------------------------------------------------------------------
# Test database setup — in-memory SQLite (no file artifacts, no conflicts)
# ---------------------------------------------------------------------------
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_user(db, email="test@example.com", name="Test User") -> models.User:
    """Create a user directly in the database."""
    from passlib.context import CryptContext
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    user = models.User(
        email=email,
        name=name,
        hashed_password=pwd.hash("testpass123"),
        provider="local",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_header(user: models.User) -> dict:
    """Generate a valid Bearer token header for the given user."""
    token = auth.create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


def _create_podcast(
    db,
    owner_id: int,
    title: str = "Test Podcast",
    category: str = "Technology",
    is_public: bool = True,
    is_deleted: bool = False,
    ai_enhanced: bool = False,
) -> models.Podcast:
    """Create a podcast with its stats entry."""
    podcast = models.Podcast(
        title=title,
        description=f"Description for {title}",
        category=category,
        is_public=is_public,
        owner_id=owner_id,
        ai_enhanced=ai_enhanced,
        is_deleted=is_deleted,
        deleted_at=datetime.datetime.now(timezone.utc) if is_deleted else None,
    )
    db.add(podcast)
    db.flush()

    stats = models.PodcastStats(
        podcast_id=podcast.id,
        play_count=0,
        like_count=0,
        bookmark_count=0,
        comment_count=0,
    )
    db.add(stats)
    db.commit()
    db.refresh(podcast)
    return podcast


def _set_stats(db, podcast_id: int, plays=0, likes=0, bookmarks=0, comments=0):
    """Update PodcastStats for a given podcast."""
    stats = db.query(models.PodcastStats).filter_by(podcast_id=podcast_id).first()
    if stats:
        stats.play_count = plays
        stats.like_count = likes
        stats.bookmark_count = bookmarks
        stats.comment_count = comments
        db.commit()


def _add_listening_history(db, user_id, podcast_id, listen_time=60, completed=False):
    """Create a listening-history entry."""
    entry = models.ListeningHistory(
        user_id=user_id,
        podcast_id=podcast_id,
        position=listen_time,
        listen_time=listen_time,
        completed=completed,
    )
    db.add(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def setup_database():
    """Create tables before each test, override get_db, and clean up after."""
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    """Provide a fresh database session for helper calls inside tests."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Tests – authentication
# ---------------------------------------------------------------------------

class TestAnalyticsAuth:
    """Endpoints must require authentication."""

    def test_dashboard_requires_auth(self):
        resp = client.get("/analytics/dashboard")
        assert resp.status_code == 401

    def test_stats_requires_auth(self):
        resp = client.get("/analytics/stats")
        assert resp.status_code == 401

    def test_top_podcasts_requires_auth(self):
        resp = client.get("/analytics/top-podcasts")
        assert resp.status_code == 401

    def test_categories_requires_auth(self):
        resp = client.get("/analytics/categories")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Tests – empty state
# ---------------------------------------------------------------------------

class TestAnalyticsEmptyState:
    """Creator with no podcasts should get zeroed-out stats."""

    def test_dashboard_empty(self, db):
        user = _create_user(db)
        resp = client.get("/analytics/dashboard", headers=_auth_header(user))
        assert resp.status_code == 200
        data = resp.json()
        assert data["stats"]["total_podcasts"] == 0
        assert data["stats"]["total_plays"] == 0
        assert data["top_podcasts"] == []
        assert data["category_breakdown"] == []

    def test_stats_empty(self, db):
        user = _create_user(db)
        resp = client.get("/analytics/stats", headers=_auth_header(user))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_podcasts"] == 0

    def test_top_podcasts_empty(self, db):
        user = _create_user(db)
        resp = client.get("/analytics/top-podcasts", headers=_auth_header(user))
        assert resp.status_code == 200
        assert resp.json() == []

    def test_categories_empty(self, db):
        user = _create_user(db)
        resp = client.get("/analytics/categories", headers=_auth_header(user))
        assert resp.status_code == 200
        assert resp.json() == []


# ---------------------------------------------------------------------------
# Tests – aggregate stats
# ---------------------------------------------------------------------------

class TestAggregateStats:
    """Verify correct aggregation across multiple podcasts."""

    def test_stats_aggregation(self, db):
        user = _create_user(db)
        headers = _auth_header(user)

        p1 = _create_podcast(db, user.id, "Podcast A", "Technology")
        p2 = _create_podcast(db, user.id, "Podcast B", "Education", ai_enhanced=True)

        _set_stats(db, p1.id, plays=10, likes=3, bookmarks=1, comments=2)
        _set_stats(db, p2.id, plays=20, likes=5, bookmarks=4, comments=1)

        resp = client.get("/analytics/stats", headers=headers)
        assert resp.status_code == 200
        data = resp.json()

        assert data["total_podcasts"] == 2
        assert data["total_plays"] == 30
        assert data["total_likes"] == 8
        assert data["total_bookmarks"] == 5
        assert data["total_comments"] == 3
        assert data["podcasts_with_ai"] == 1

    def test_listen_time_and_completion(self, db):
        user = _create_user(db)
        headers = _auth_header(user)

        p = _create_podcast(db, user.id, "Listen Test")
        listener = _create_user(db, email="listener@example.com", name="Listener")
        _add_listening_history(db, listener.id, p.id, listen_time=120, completed=True)
        _add_listening_history(db, user.id, p.id, listen_time=60, completed=False)

        resp = client.get("/analytics/stats", headers=headers)
        data = resp.json()

        assert data["total_listen_time_seconds"] == 180
        assert data["average_completion_rate"] == 50.0

    def test_deleted_podcasts_excluded(self, db):
        user = _create_user(db)
        headers = _auth_header(user)

        _create_podcast(db, user.id, "Active")
        _create_podcast(db, user.id, "Deleted", is_deleted=True)

        resp = client.get("/analytics/stats", headers=headers)
        data = resp.json()
        assert data["total_podcasts"] == 1


# ---------------------------------------------------------------------------
# Tests – top podcasts
# ---------------------------------------------------------------------------

class TestTopPodcasts:
    """Verify top-podcasts sorting and limits."""

    def test_top_podcasts_sorted_by_plays(self, db):
        user = _create_user(db)
        headers = _auth_header(user)

        p1 = _create_podcast(db, user.id, "Low Plays")
        p2 = _create_podcast(db, user.id, "High Plays")

        _set_stats(db, p1.id, plays=5)
        _set_stats(db, p2.id, plays=50)

        resp = client.get("/analytics/top-podcasts", headers=headers)
        data = resp.json()

        assert len(data) == 2
        assert data[0]["title"] == "High Plays"
        assert data[0]["play_count"] == 50

    def test_sort_by_likes(self, db):
        user = _create_user(db)
        headers = _auth_header(user)

        p1 = _create_podcast(db, user.id, "Many Likes")
        p2 = _create_podcast(db, user.id, "Few Likes")

        _set_stats(db, p1.id, likes=100)
        _set_stats(db, p2.id, likes=2)

        resp = client.get("/analytics/top-podcasts?sort_by=likes", headers=headers)
        data = resp.json()

        assert data[0]["title"] == "Many Likes"
        assert data[0]["like_count"] == 100

    def test_sort_by_bookmarks(self, db):
        user = _create_user(db)
        headers = _auth_header(user)

        p1 = _create_podcast(db, user.id, "Bookmarked")
        p2 = _create_podcast(db, user.id, "Not Bookmarked")

        _set_stats(db, p1.id, bookmarks=30)
        _set_stats(db, p2.id, bookmarks=1)

        resp = client.get("/analytics/top-podcasts?sort_by=bookmarks", headers=headers)
        data = resp.json()

        assert data[0]["title"] == "Bookmarked"

    def test_limit_parameter(self, db):
        user = _create_user(db)
        headers = _auth_header(user)

        for i in range(5):
            _create_podcast(db, user.id, f"Podcast {i}")

        resp = client.get("/analytics/top-podcasts?limit=2", headers=headers)
        data = resp.json()
        assert len(data) == 2

    def test_deleted_excluded_from_top(self, db):
        user = _create_user(db)
        headers = _auth_header(user)

        p_active = _create_podcast(db, user.id, "Active")
        p_deleted = _create_podcast(db, user.id, "Deleted", is_deleted=True)

        _set_stats(db, p_active.id, plays=5)
        _set_stats(db, p_deleted.id, plays=999)

        resp = client.get("/analytics/top-podcasts", headers=headers)
        data = resp.json()
        assert len(data) == 1
        assert data[0]["title"] == "Active"


# ---------------------------------------------------------------------------
# Tests – category breakdown
# ---------------------------------------------------------------------------

class TestCategoryBreakdown:
    """Verify per-category aggregation."""

    def test_category_grouping(self, db):
        user = _create_user(db)
        headers = _auth_header(user)

        p1 = _create_podcast(db, user.id, "Tech 1", "Technology")
        p2 = _create_podcast(db, user.id, "Tech 2", "Technology")
        p3 = _create_podcast(db, user.id, "Edu 1", "Education")

        _set_stats(db, p1.id, plays=10, likes=3)
        _set_stats(db, p2.id, plays=20, likes=5)
        _set_stats(db, p3.id, plays=5, likes=1)

        resp = client.get("/analytics/categories", headers=headers)
        data = resp.json()

        assert len(data) == 2

        tech = next(c for c in data if c["category"] == "Technology")
        edu = next(c for c in data if c["category"] == "Education")

        assert tech["podcast_count"] == 2
        assert tech["total_plays"] == 30
        assert tech["total_likes"] == 8
        assert edu["podcast_count"] == 1
        assert edu["total_plays"] == 5

    def test_categories_sorted_by_plays(self, db):
        user = _create_user(db)
        headers = _auth_header(user)

        p1 = _create_podcast(db, user.id, "Top Category", "Music")
        p2 = _create_podcast(db, user.id, "Low Category", "News")

        _set_stats(db, p1.id, plays=100)
        _set_stats(db, p2.id, plays=1)

        resp = client.get("/analytics/categories", headers=headers)
        data = resp.json()

        assert data[0]["category"] == "Music"
        assert data[1]["category"] == "News"


# ---------------------------------------------------------------------------
# Tests – full dashboard
# ---------------------------------------------------------------------------

class TestFullDashboard:
    """Verify the combined dashboard endpoint returns all sections."""

    def test_dashboard_structure(self, db):
        user = _create_user(db)
        headers = _auth_header(user)

        p = _create_podcast(db, user.id, "Dashboard Test", "General")
        _set_stats(db, p.id, plays=42, likes=7, bookmarks=3, comments=1)

        resp = client.get("/analytics/dashboard", headers=headers)
        assert resp.status_code == 200
        data = resp.json()

        assert "stats" in data
        assert "top_podcasts" in data
        assert "category_breakdown" in data

        assert data["stats"]["total_podcasts"] == 1
        assert data["stats"]["total_plays"] == 42
        assert len(data["top_podcasts"]) == 1
        assert data["top_podcasts"][0]["title"] == "Dashboard Test"
        assert len(data["category_breakdown"]) == 1


# ---------------------------------------------------------------------------
# Tests – isolation between users
# ---------------------------------------------------------------------------

class TestUserIsolation:
    """Each creator should only see their own data."""

    def test_other_user_podcasts_not_included(self, db):
        user_a = _create_user(db, email="a@example.com", name="User A")
        user_b = _create_user(db, email="b@example.com", name="User B")

        p_a = _create_podcast(db, user_a.id, "A's Podcast")
        p_b = _create_podcast(db, user_b.id, "B's Podcast")

        _set_stats(db, p_a.id, plays=10)
        _set_stats(db, p_b.id, plays=999)

        resp = client.get("/analytics/stats", headers=_auth_header(user_a))
        data = resp.json()

        assert data["total_podcasts"] == 1
        assert data["total_plays"] == 10
