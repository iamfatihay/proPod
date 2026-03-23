"""
Tests for podcast CRUD endpoints.

Covers:
- Create podcast
- Get single podcast
- List podcasts with pagination/filtering
- Update podcast (owner only)
- Delete podcast (owner only, soft delete)
- Like / unlike
- Bookmark / remove bookmark
- User interactions query
- Comments (create, list, update, delete)
- Discovery endpoints (trending, related)
- User collections (my/likes, my/bookmarks, my/created)
- Authorization checks (401 without token, 403 for non-owner)
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app.models import User, Podcast, PodcastStats, PodcastLike, PodcastBookmark, PodcastComment, ListeningHistory
from app import crud, schemas
from app.auth import create_access_token

client = TestClient(app)


# --------------- fixtures ---------------

@pytest.fixture
def db():
    """Yield a database session, rolled back after the test."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def test_user(db):
    """Create a test user and return user + token dict. Cleaned up after test."""
    # Clean up any leftover from previous runs
    existing = db.query(User).filter(User.email == "podtest@test.com").first()
    if existing:
        _cleanup_user(db, existing)

    user_create = schemas.UserCreate(
        email="podtest@test.com",
        name="Podcast Test User",
        password="testpassword123",
    )
    user = crud.create_user(db, user_create)
    token = create_access_token(data={"sub": user.email})

    yield {"user": user, "token": token, "db": db}

    _cleanup_user(db, user)


@pytest.fixture
def other_user(db):
    """Create a second test user for authorization tests."""
    existing = db.query(User).filter(User.email == "other@test.com").first()
    if existing:
        _cleanup_user(db, existing)

    user_create = schemas.UserCreate(
        email="other@test.com",
        name="Other User",
        password="otherpassword123",
    )
    user = crud.create_user(db, user_create)
    token = create_access_token(data={"sub": user.email})

    yield {"user": user, "token": token, "db": db}

    _cleanup_user(db, user)


def _cleanup_user(db: Session, user: User):
    """Remove a user and all related rows."""
    db.query(PodcastComment).filter(PodcastComment.user_id == user.id).delete()
    db.query(ListeningHistory).filter(ListeningHistory.user_id == user.id).delete()
    db.query(PodcastLike).filter(PodcastLike.user_id == user.id).delete()
    db.query(PodcastBookmark).filter(PodcastBookmark.user_id == user.id).delete()
    # Delete stats for user's podcasts, then podcasts themselves
    user_podcasts = db.query(Podcast).filter(Podcast.owner_id == user.id).all()
    for p in user_podcasts:
        db.query(PodcastStats).filter(PodcastStats.podcast_id == p.id).delete()
        db.query(PodcastComment).filter(PodcastComment.podcast_id == p.id).delete()
        db.query(PodcastLike).filter(PodcastLike.podcast_id == p.id).delete()
        db.query(PodcastBookmark).filter(PodcastBookmark.podcast_id == p.id).delete()
        db.query(ListeningHistory).filter(ListeningHistory.podcast_id == p.id).delete()
    db.query(Podcast).filter(Podcast.owner_id == user.id).delete()
    db.delete(user)
    db.commit()


def _auth(token: str) -> dict:
    """Return Authorization header dict."""
    return {"Authorization": f"Bearer {token}"}


def _create_podcast_via_api(token: str, **overrides) -> dict:
    """Helper: create a podcast through the API and return response JSON."""
    payload = {
        "title": overrides.get("title", "Test Podcast"),
        "description": overrides.get("description", "A test podcast description"),
        "category": overrides.get("category", "Technology"),
        "is_public": overrides.get("is_public", True),
        "duration": overrides.get("duration", 120),
        "audio_url": overrides.get("audio_url", "http://localhost:8000/media/audio/test.mp3"),
    }
    resp = client.post("/podcasts/create", json=payload, headers=_auth(token))
    assert resp.status_code == 200, f"Create failed: {resp.text}"
    return resp.json()


# --------------- Create Podcast ---------------

class TestCreatePodcast:
    """Tests for POST /podcasts/create."""

    def test_create_podcast_success(self, test_user):
        data = _create_podcast_via_api(test_user["token"])
        assert data["title"] == "Test Podcast"
        assert data["category"] == "Technology"
        assert data["owner_id"] == test_user["user"].id
        assert data["is_public"] is True
        assert data["duration"] == 120

    def test_create_podcast_minimal_fields(self, test_user):
        """Title is the only truly required field (from PodcastBase)."""
        resp = client.post(
            "/podcasts/create",
            json={"title": "Minimal"},
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Minimal"
        assert resp.json()["category"] == "General"  # default

    def test_create_podcast_unauthorized(self):
        resp = client.post("/podcasts/create", json={"title": "No Auth"})
        assert resp.status_code == 401

    def test_create_podcast_empty_title_rejected(self, test_user):
        """Empty title should be rejected by schema validation (min_length=1)."""
        resp = client.post(
            "/podcasts/create",
            json={"title": ""},
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 422


# --------------- Get Single Podcast ---------------

class TestGetPodcast:
    """Tests for GET /podcasts/{podcast_id}."""

    def test_get_podcast_success(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        resp = client.get(f"/podcasts/{created['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == created["id"]
        assert resp.json()["title"] == "Test Podcast"

    def test_get_podcast_not_found(self):
        resp = client.get("/podcasts/999999")
        assert resp.status_code == 404

    def test_get_podcast_increments_play_count(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        # First fetch
        resp1 = client.get(f"/podcasts/{created['id']}")
        count1 = resp1.json()["play_count"]
        # Second fetch
        resp2 = client.get(f"/podcasts/{created['id']}")
        count2 = resp2.json()["play_count"]
        assert count2 > count1


# --------------- List Podcasts ---------------

class TestListPodcasts:
    """Tests for GET /podcasts/."""

    def test_list_podcasts_returns_list(self, test_user):
        _create_podcast_via_api(test_user["token"], title="List Test 1")
        _create_podcast_via_api(test_user["token"], title="List Test 2")
        resp = client.get("/podcasts/")
        assert resp.status_code == 200
        data = resp.json()
        assert "podcasts" in data
        assert data["total"] >= 2

    def test_list_podcasts_pagination(self, test_user):
        for i in range(3):
            _create_podcast_via_api(test_user["token"], title=f"Page Test {i}")
        resp = client.get("/podcasts/?skip=0&limit=2")
        data = resp.json()
        assert len(data["podcasts"]) <= 2
        assert data["limit"] == 2

    def test_list_podcasts_category_filter(self, test_user):
        _create_podcast_via_api(test_user["token"], title="Science Pod", category="Science")
        _create_podcast_via_api(test_user["token"], title="Tech Pod", category="Technology")
        resp = client.get("/podcasts/?category=Science")
        data = resp.json()
        for p in data["podcasts"]:
            assert p["category"] == "Science"


# --------------- Update Podcast ---------------

class TestUpdatePodcast:
    """Tests for PUT /podcasts/{podcast_id}."""

    def test_update_podcast_success(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        resp = client.put(
            f"/podcasts/{created['id']}",
            json={"title": "Updated Title", "description": "New desc"},
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Title"
        assert resp.json()["description"] == "New desc"

    def test_update_podcast_unauthorized(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        resp = client.put(
            f"/podcasts/{created['id']}",
            json={"title": "Hacked"},
        )
        assert resp.status_code == 401

    def test_update_podcast_forbidden_for_non_owner(self, test_user, other_user):
        created = _create_podcast_via_api(test_user["token"])
        resp = client.put(
            f"/podcasts/{created['id']}",
            json={"title": "Stolen"},
            headers=_auth(other_user["token"]),
        )
        assert resp.status_code == 403

    def test_update_podcast_not_found(self, test_user):
        resp = client.put(
            "/podcasts/999999",
            json={"title": "Ghost"},
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 404


# --------------- Delete Podcast ---------------

class TestDeletePodcast:
    """Tests for DELETE /podcasts/{podcast_id}."""

    def test_delete_podcast_success(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        resp = client.delete(
            f"/podcasts/{created['id']}",
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 200
        assert "deleted" in resp.json()["message"].lower()

        # Should no longer be retrievable
        resp2 = client.get(f"/podcasts/{created['id']}")
        assert resp2.status_code == 404

    def test_delete_podcast_forbidden_for_non_owner(self, test_user, other_user):
        created = _create_podcast_via_api(test_user["token"])
        resp = client.delete(
            f"/podcasts/{created['id']}",
            headers=_auth(other_user["token"]),
        )
        assert resp.status_code == 403

    def test_delete_podcast_unauthorized(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        resp = client.delete(f"/podcasts/{created['id']}")
        assert resp.status_code == 401


# --------------- Like / Unlike ---------------

class TestLikePodcast:
    """Tests for POST/DELETE /podcasts/{id}/like."""

    def test_like_podcast_success(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        resp = client.post(
            f"/podcasts/{created['id']}/like",
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["podcast_id"] == created["id"]
        assert data["user_id"] == test_user["user"].id

    def test_like_podcast_not_found(self, test_user):
        resp = client.post(
            "/podcasts/999999/like",
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 404

    def test_unlike_podcast_success(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        # Like first
        client.post(
            f"/podcasts/{created['id']}/like",
            headers=_auth(test_user["token"]),
        )
        # Unlike
        resp = client.delete(
            f"/podcasts/{created['id']}/like",
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 200

    def test_like_podcast_unauthorized(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        resp = client.post(f"/podcasts/{created['id']}/like")
        assert resp.status_code == 401


# --------------- Bookmark / Remove Bookmark ---------------

class TestBookmarkPodcast:
    """Tests for POST/DELETE /podcasts/{id}/bookmark."""

    def test_bookmark_podcast_success(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        resp = client.post(
            f"/podcasts/{created['id']}/bookmark",
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 200
        assert resp.json()["podcast_id"] == created["id"]

    def test_bookmark_podcast_not_found(self, test_user):
        resp = client.post(
            "/podcasts/999999/bookmark",
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 404

    def test_remove_bookmark_success(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        client.post(
            f"/podcasts/{created['id']}/bookmark",
            headers=_auth(test_user["token"]),
        )
        resp = client.delete(
            f"/podcasts/{created['id']}/bookmark",
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 200


# --------------- User Interactions ---------------

class TestUserInteractions:
    """Tests for GET /podcasts/{id}/interactions."""

    def test_get_interactions_default(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        resp = client.get(
            f"/podcasts/{created['id']}/interactions",
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_liked"] is False
        assert data["is_bookmarked"] is False

    def test_get_interactions_after_like_and_bookmark(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        client.post(f"/podcasts/{created['id']}/like", headers=_auth(test_user["token"]))
        client.post(f"/podcasts/{created['id']}/bookmark", headers=_auth(test_user["token"]))

        resp = client.get(
            f"/podcasts/{created['id']}/interactions",
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_liked"] is True
        assert data["is_bookmarked"] is True


# --------------- Comments ---------------

class TestComments:
    """Tests for podcast comment endpoints."""

    def test_create_comment_success(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        resp = client.post(
            f"/podcasts/{created['id']}/comments",
            json={"podcast_id": created["id"], "content": "Great episode!"},
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 200
        assert resp.json()["content"] == "Great episode!"
        assert resp.json()["user_id"] == test_user["user"].id

    def test_list_comments(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        for i in range(3):
            client.post(
                f"/podcasts/{created['id']}/comments",
                json={"podcast_id": created["id"], "content": f"Comment {i}"},
                headers=_auth(test_user["token"]),
            )
        resp = client.get(f"/podcasts/{created['id']}/comments")
        assert resp.status_code == 200
        assert len(resp.json()) >= 3

    def test_update_comment_success(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        comment_resp = client.post(
            f"/podcasts/{created['id']}/comments",
            json={"podcast_id": created["id"], "content": "Original"},
            headers=_auth(test_user["token"]),
        )
        comment_id = comment_resp.json()["id"]

        resp = client.put(
            f"/podcasts/comments/{comment_id}",
            json={"content": "Edited"},
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 200
        assert resp.json()["content"] == "Edited"

    def test_update_comment_forbidden_for_non_owner(self, test_user, other_user):
        created = _create_podcast_via_api(test_user["token"])
        comment_resp = client.post(
            f"/podcasts/{created['id']}/comments",
            json={"podcast_id": created["id"], "content": "Mine"},
            headers=_auth(test_user["token"]),
        )
        comment_id = comment_resp.json()["id"]

        resp = client.put(
            f"/podcasts/comments/{comment_id}",
            json={"content": "Stolen"},
            headers=_auth(other_user["token"]),
        )
        assert resp.status_code == 403

    def test_delete_comment_success(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        comment_resp = client.post(
            f"/podcasts/{created['id']}/comments",
            json={"podcast_id": created["id"], "content": "To delete"},
            headers=_auth(test_user["token"]),
        )
        comment_id = comment_resp.json()["id"]

        resp = client.delete(
            f"/podcasts/comments/{comment_id}",
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 200

    def test_delete_comment_forbidden_for_non_owner(self, test_user, other_user):
        created = _create_podcast_via_api(test_user["token"])
        comment_resp = client.post(
            f"/podcasts/{created['id']}/comments",
            json={"podcast_id": created["id"], "content": "Protected"},
            headers=_auth(test_user["token"]),
        )
        comment_id = comment_resp.json()["id"]

        resp = client.delete(
            f"/podcasts/comments/{comment_id}",
            headers=_auth(other_user["token"]),
        )
        assert resp.status_code == 403


# --------------- Discovery ---------------

class TestDiscovery:
    """Tests for discovery/trending endpoints."""

    def test_trending_podcasts(self, test_user):
        _create_podcast_via_api(test_user["token"], title="Trending Candidate")
        resp = client.get("/podcasts/discover/trending?limit=5")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_related_podcasts(self, test_user):
        p1 = _create_podcast_via_api(test_user["token"], title="Related A", category="Science")
        _create_podcast_via_api(test_user["token"], title="Related B", category="Science")
        resp = client.get(f"/podcasts/discover/related/{p1['id']}?limit=5")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        # The reference podcast itself should NOT appear in related
        for p in data:
            assert p["id"] != p1["id"]

    def test_related_podcasts_not_found(self):
        resp = client.get("/podcasts/discover/related/999999")
        assert resp.status_code == 404


# --------------- User Collections ---------------

class TestUserCollections:
    """Tests for my/likes, my/bookmarks, my/created."""

    def test_my_liked_podcasts(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        client.post(f"/podcasts/{created['id']}/like", headers=_auth(test_user["token"]))

        resp = client.get("/podcasts/my/likes", headers=_auth(test_user["token"]))
        assert resp.status_code == 200
        ids = [p["id"] for p in resp.json()]
        assert created["id"] in ids

    def test_my_bookmarked_podcasts(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        client.post(f"/podcasts/{created['id']}/bookmark", headers=_auth(test_user["token"]))

        resp = client.get("/podcasts/my/bookmarks", headers=_auth(test_user["token"]))
        assert resp.status_code == 200
        ids = [p["id"] for p in resp.json()]
        assert created["id"] in ids

    def test_my_created_podcasts(self, test_user):
        _create_podcast_via_api(test_user["token"], title="My Creation")
        resp = client.get("/podcasts/my/created", headers=_auth(test_user["token"]))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        titles = [p["title"] for p in data["podcasts"]]
        assert "My Creation" in titles

    def test_my_collections_unauthorized(self):
        for endpoint in ["/podcasts/my/likes", "/podcasts/my/bookmarks", "/podcasts/my/created"]:
            resp = client.get(endpoint)
            assert resp.status_code == 401, f"{endpoint} should require auth"


# --------------- Listening History ---------------

class TestListeningHistory:
    """Tests for POST /podcasts/{id}/history and GET /podcasts/my/history."""

    def test_update_listening_history(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        resp = client.post(
            f"/podcasts/{created['id']}/history",
            json={"position": 60, "listen_time": 60, "completed": False},
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 200
        assert resp.json()["position"] == 60
        assert resp.json()["completed"] is False

    def test_update_listening_history_completed(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        resp = client.post(
            f"/podcasts/{created['id']}/history",
            json={"position": 120, "listen_time": 120, "completed": True},
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 200
        assert resp.json()["completed"] is True

    def test_my_listening_history(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        client.post(
            f"/podcasts/{created['id']}/history",
            json={"position": 30, "listen_time": 30, "completed": False},
            headers=_auth(test_user["token"]),
        )
        resp = client.get("/podcasts/my/history", headers=_auth(test_user["token"]))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1


# --------------- Analytics ---------------

class TestPodcastAnalytics:
    """Tests for GET /podcasts/{id}/analytics."""

    def test_get_analytics_owner(self, test_user):
        created = _create_podcast_via_api(test_user["token"])
        resp = client.get(
            f"/podcasts/{created['id']}/analytics",
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "total_plays" in data
        assert "total_likes" in data
        assert "completion_rate" in data

    def test_get_analytics_forbidden_for_non_owner(self, test_user, other_user):
        created = _create_podcast_via_api(test_user["token"])
        resp = client.get(
            f"/podcasts/{created['id']}/analytics",
            headers=_auth(other_user["token"]),
        )
        assert resp.status_code == 403

    def test_get_analytics_not_found(self, test_user):
        resp = client.get(
            "/podcasts/999999/analytics",
            headers=_auth(test_user["token"]),
        )
        assert resp.status_code == 404
