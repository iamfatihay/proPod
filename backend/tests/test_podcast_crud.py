"""Tests for podcast CRUD endpoints.

Covers: create, get, list, update, delete, like, unlike, bookmark,
remove bookmark, interactions, comments, and authorization checks.
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
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def db_session():
    """Yield a raw DB session and close it when done."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_user(db_session):
    """Create a test user, yield user + token, then clean up."""
    db = db_session
    # Clean up leftover from a previous interrupted run
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
def other_user(db_session):
    """Create a second test user for authorization tests."""
    db = db_session
    existing = db.query(User).filter(User.email == "other@test.com").first()
    if existing:
        _cleanup_user(db, existing)

    user_create = schemas.UserCreate(
        email="other@test.com",
        name="Other User",
        password="testpassword123",
    )
    user = crud.create_user(db, user_create)
    token = create_access_token(data={"sub": user.email})

    yield {"user": user, "token": token, "db": db}

    _cleanup_user(db, user)


@pytest.fixture
def test_podcast(test_user):
    """Create a podcast owned by test_user."""
    db = test_user["db"]
    podcast_data = schemas.PodcastCreate(
        title="Test Podcast",
        description="A test podcast",
        category="Technology",
        is_public=True,
        duration=120,
    )
    podcast = crud.create_podcast(db, podcast_data, owner_id=test_user["user"].id)
    yield podcast
    # Cleanup handled by test_user fixture (cascade)


def _cleanup_user(db, user):
    """Remove all data associated with a user."""
    db.query(PodcastComment).filter(PodcastComment.user_id == user.id).delete()
    db.query(ListeningHistory).filter(ListeningHistory.user_id == user.id).delete()
    db.query(PodcastBookmark).filter(PodcastBookmark.user_id == user.id).delete()
    db.query(PodcastLike).filter(PodcastLike.user_id == user.id).delete()
    # Delete stats, then podcasts
    podcast_ids = [p.id for p in db.query(Podcast).filter(Podcast.owner_id == user.id).all()]
    if podcast_ids:
        db.query(PodcastStats).filter(PodcastStats.podcast_id.in_(podcast_ids)).delete(synchronize_session=False)
        db.query(Podcast).filter(Podcast.owner_id == user.id).delete()
    db.delete(user)
    db.commit()


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ===========================================================================
# Podcast CRUD
# ===========================================================================

class TestCreatePodcast:
    """POST /podcasts/create"""

    def test_create_podcast_success(self, test_user):
        response = client.post(
            "/podcasts/create",
            json={
                "title": "My New Podcast",
                "description": "Description here",
                "category": "Science",
                "is_public": True,
                "duration": 300,
            },
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "My New Podcast"
        assert data["category"] == "Science"
        assert data["owner_id"] == test_user["user"].id

    def test_create_podcast_unauthenticated(self):
        response = client.post(
            "/podcasts/create",
            json={"title": "No Auth Podcast"},
        )
        assert response.status_code == 401

    def test_create_podcast_missing_title(self, test_user):
        response = client.post(
            "/podcasts/create",
            json={"description": "No title"},
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 422


class TestGetPodcast:
    """GET /podcasts/{podcast_id}"""

    def test_get_podcast_success(self, test_user, test_podcast):
        response = client.get(f"/podcasts/{test_podcast.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_podcast.id
        assert data["title"] == "Test Podcast"

    def test_get_podcast_not_found(self):
        response = client.get("/podcasts/999999")
        assert response.status_code == 404


class TestGetPodcasts:
    """GET /podcasts/"""

    def test_list_podcasts(self, test_user, test_podcast):
        response = client.get("/podcasts/")
        assert response.status_code == 200
        data = response.json()
        assert "podcasts" in data
        assert "total" in data
        assert data["total"] >= 1

    def test_list_podcasts_with_category_filter(self, test_user, test_podcast):
        response = client.get("/podcasts/", params={"category": "Technology"})
        assert response.status_code == 200
        data = response.json()
        for p in data["podcasts"]:
            assert p["category"] == "Technology"

    def test_list_podcasts_pagination(self, test_user, test_podcast):
        response = client.get("/podcasts/", params={"skip": 0, "limit": 1})
        assert response.status_code == 200
        data = response.json()
        assert len(data["podcasts"]) <= 1


class TestUpdatePodcast:
    """PUT /podcasts/{podcast_id}"""

    def test_update_podcast_success(self, test_user, test_podcast):
        response = client.put(
            f"/podcasts/{test_podcast.id}",
            json={"title": "Updated Title"},
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated Title"

    def test_update_podcast_not_found(self, test_user):
        response = client.put(
            "/podcasts/999999",
            json={"title": "Ghost"},
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 404

    def test_update_podcast_forbidden(self, test_user, test_podcast, other_user):
        response = client.put(
            f"/podcasts/{test_podcast.id}",
            json={"title": "Hacked"},
            headers=_auth_header(other_user["token"]),
        )
        assert response.status_code == 403

    def test_update_podcast_unauthenticated(self, test_podcast):
        response = client.put(
            f"/podcasts/{test_podcast.id}",
            json={"title": "No Auth"},
        )
        assert response.status_code == 401


class TestDeletePodcast:
    """DELETE /podcasts/{podcast_id}"""

    def test_delete_podcast_success(self, test_user):
        # Create a podcast to delete
        resp = client.post(
            "/podcasts/create",
            json={"title": "To Delete", "category": "General"},
            headers=_auth_header(test_user["token"]),
        )
        podcast_id = resp.json()["id"]

        response = client.delete(
            f"/podcasts/{podcast_id}",
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Podcast deleted successfully"

        # Verify soft delete: should return 404 on normal get
        get_resp = client.get(f"/podcasts/{podcast_id}")
        assert get_resp.status_code == 404

    def test_delete_podcast_not_found(self, test_user):
        response = client.delete(
            "/podcasts/999999",
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 404

    def test_delete_podcast_forbidden(self, test_user, test_podcast, other_user):
        response = client.delete(
            f"/podcasts/{test_podcast.id}",
            headers=_auth_header(other_user["token"]),
        )
        assert response.status_code == 403


# ===========================================================================
# Podcast Interactions (like, bookmark)
# ===========================================================================

class TestLikePodcast:
    """POST/DELETE /podcasts/{podcast_id}/like"""

    def test_like_podcast_success(self, test_user, test_podcast):
        response = client.post(
            f"/podcasts/{test_podcast.id}/like",
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["podcast_id"] == test_podcast.id
        assert data["user_id"] == test_user["user"].id

    def test_like_podcast_duplicate(self, test_user, test_podcast):
        # Like once
        client.post(
            f"/podcasts/{test_podcast.id}/like",
            headers=_auth_header(test_user["token"]),
        )
        # Like again — should fail
        response = client.post(
            f"/podcasts/{test_podcast.id}/like",
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 400

    def test_like_nonexistent_podcast(self, test_user):
        response = client.post(
            "/podcasts/999999/like",
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 404

    def test_unlike_podcast_success(self, test_user, test_podcast):
        # Like first
        client.post(
            f"/podcasts/{test_podcast.id}/like",
            headers=_auth_header(test_user["token"]),
        )
        # Unlike
        response = client.delete(
            f"/podcasts/{test_podcast.id}/like",
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 200

    def test_unlike_without_like(self, test_user, test_podcast):
        response = client.delete(
            f"/podcasts/{test_podcast.id}/like",
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 404


class TestBookmarkPodcast:
    """POST/DELETE /podcasts/{podcast_id}/bookmark"""

    def test_bookmark_podcast_success(self, test_user, test_podcast):
        response = client.post(
            f"/podcasts/{test_podcast.id}/bookmark",
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["podcast_id"] == test_podcast.id

    def test_bookmark_duplicate(self, test_user, test_podcast):
        client.post(
            f"/podcasts/{test_podcast.id}/bookmark",
            headers=_auth_header(test_user["token"]),
        )
        response = client.post(
            f"/podcasts/{test_podcast.id}/bookmark",
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 400

    def test_bookmark_nonexistent_podcast(self, test_user):
        response = client.post(
            "/podcasts/999999/bookmark",
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 404

    def test_remove_bookmark_success(self, test_user, test_podcast):
        client.post(
            f"/podcasts/{test_podcast.id}/bookmark",
            headers=_auth_header(test_user["token"]),
        )
        response = client.delete(
            f"/podcasts/{test_podcast.id}/bookmark",
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 200


# ===========================================================================
# User Interactions endpoint
# ===========================================================================

class TestPodcastInteractions:
    """GET /podcasts/{podcast_id}/interactions"""

    def test_interactions_default(self, test_user, test_podcast):
        response = client.get(
            f"/podcasts/{test_podcast.id}/interactions",
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_liked"] is False
        assert data["is_bookmarked"] is False

    def test_interactions_after_like_and_bookmark(self, test_user, test_podcast):
        client.post(
            f"/podcasts/{test_podcast.id}/like",
            headers=_auth_header(test_user["token"]),
        )
        client.post(
            f"/podcasts/{test_podcast.id}/bookmark",
            headers=_auth_header(test_user["token"]),
        )
        response = client.get(
            f"/podcasts/{test_podcast.id}/interactions",
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_liked"] is True
        assert data["is_bookmarked"] is True


# ===========================================================================
# Comments
# ===========================================================================

class TestPodcastComments:
    """POST/GET/PUT/DELETE for podcast comments."""

    def test_create_comment(self, test_user, test_podcast):
        response = client.post(
            f"/podcasts/{test_podcast.id}/comments",
            json={
                "podcast_id": test_podcast.id,
                "content": "Great episode!",
                "timestamp": 30,
            },
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "Great episode!"
        assert data["podcast_id"] == test_podcast.id

    def test_create_comment_podcast_id_mismatch(self, test_user, test_podcast):
        response = client.post(
            f"/podcasts/{test_podcast.id}/comments",
            json={
                "podcast_id": 999999,
                "content": "Mismatch",
            },
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 400

    def test_get_comments(self, test_user, test_podcast):
        # Create a comment first
        client.post(
            f"/podcasts/{test_podcast.id}/comments",
            json={
                "podcast_id": test_podcast.id,
                "content": "Test comment",
            },
            headers=_auth_header(test_user["token"]),
        )
        response = client.get(f"/podcasts/{test_podcast.id}/comments")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_update_comment(self, test_user, test_podcast):
        # Create
        resp = client.post(
            f"/podcasts/{test_podcast.id}/comments",
            json={
                "podcast_id": test_podcast.id,
                "content": "Original",
            },
            headers=_auth_header(test_user["token"]),
        )
        comment_id = resp.json()["id"]

        # Update
        response = client.put(
            f"/podcasts/comments/{comment_id}",
            json={"content": "Edited"},
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 200
        assert response.json()["content"] == "Edited"

    def test_update_comment_forbidden(self, test_user, test_podcast, other_user):
        resp = client.post(
            f"/podcasts/{test_podcast.id}/comments",
            json={
                "podcast_id": test_podcast.id,
                "content": "Owner's comment",
            },
            headers=_auth_header(test_user["token"]),
        )
        comment_id = resp.json()["id"]

        response = client.put(
            f"/podcasts/comments/{comment_id}",
            json={"content": "Hacked"},
            headers=_auth_header(other_user["token"]),
        )
        assert response.status_code == 403

    def test_delete_comment(self, test_user, test_podcast):
        resp = client.post(
            f"/podcasts/{test_podcast.id}/comments",
            json={
                "podcast_id": test_podcast.id,
                "content": "To be deleted",
            },
            headers=_auth_header(test_user["token"]),
        )
        comment_id = resp.json()["id"]

        response = client.delete(
            f"/podcasts/comments/{comment_id}",
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 200

    def test_delete_comment_forbidden(self, test_user, test_podcast, other_user):
        resp = client.post(
            f"/podcasts/{test_podcast.id}/comments",
            json={
                "podcast_id": test_podcast.id,
                "content": "Owner only",
            },
            headers=_auth_header(test_user["token"]),
        )
        comment_id = resp.json()["id"]

        response = client.delete(
            f"/podcasts/comments/{comment_id}",
            headers=_auth_header(other_user["token"]),
        )
        assert response.status_code == 403


# ===========================================================================
# Listening History
# ===========================================================================

class TestListeningHistory:
    """POST /podcasts/{podcast_id}/history"""

    def test_update_listening_history(self, test_user, test_podcast):
        response = client.post(
            f"/podcasts/{test_podcast.id}/history",
            json={"position": 60, "listen_time": 60, "completed": False},
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["position"] == 60
        assert data["completed"] is False

    def test_update_listening_history_nonexistent_podcast(self, test_user):
        response = client.post(
            "/podcasts/999999/history",
            json={"position": 10},
            headers=_auth_header(test_user["token"]),
        )
        assert response.status_code == 404
