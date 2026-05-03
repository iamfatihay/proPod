"""
Tests for podcast interaction endpoints: like, unlike, bookmark, unbookmark,
comments (create, update, delete, list), and listening history.

Covers:
- Like/unlike podcasts with correct stats updates
- Bookmark/unbookmark podcasts with correct stats updates
- Duplicate interaction prevention (400 on re-like/re-bookmark)
- Comment CRUD with ownership authorization
- Listening history create and update
- Authorization: interactions require authentication
- Authorization: comment edit/delete restricted to owner
- Edge cases: unlike non-liked, unbookmark non-bookmarked, interact with non-existent podcast
"""
from fastapi.testclient import TestClient

from app.main import app
import app.models as models

client = TestClient(app)


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestPodcastLike:
    """Tests for POST /podcasts/{id}/like and DELETE /podcasts/{id}/like."""

    def test_like_podcast_success(self, test_user, test_podcast):
        _, token = test_user
        resp = client.post(
            f"/podcasts/{test_podcast.id}/like",
            headers=auth_header(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["podcast_id"] == test_podcast.id
        assert data["user_id"] == test_user[0].id

    def test_like_podcast_updates_stats(self, db_session, test_user, test_podcast):
        _, token = test_user
        client.post(
            f"/podcasts/{test_podcast.id}/like",
            headers=auth_header(token),
        )
        # Verify stats incremented
        stats = db_session.query(models.PodcastStats).filter(
            models.PodcastStats.podcast_id == test_podcast.id
        ).first()
        db_session.refresh(stats)
        assert stats.like_count >= 1

    def test_like_podcast_duplicate_returns_400(self, test_user, test_podcast):
        _, token = test_user
        # Like once
        client.post(
            f"/podcasts/{test_podcast.id}/like",
            headers=auth_header(token),
        )
        # Like again — should fail
        resp = client.post(
            f"/podcasts/{test_podcast.id}/like",
            headers=auth_header(token),
        )
        assert resp.status_code == 400
        assert "already liked" in resp.json()["detail"].lower()

    def test_like_nonexistent_podcast_returns_404(self, test_user):
        _, token = test_user
        resp = client.post(
            "/podcasts/99999/like",
            headers=auth_header(token),
        )
        assert resp.status_code == 404

    def test_like_podcast_unauthenticated_returns_401(self, test_podcast):
        resp = client.post(f"/podcasts/{test_podcast.id}/like")
        assert resp.status_code == 401

    def test_unlike_podcast_success(self, test_user, test_podcast):
        _, token = test_user
        # Like first
        client.post(
            f"/podcasts/{test_podcast.id}/like",
            headers=auth_header(token),
        )
        # Unlike
        resp = client.delete(
            f"/podcasts/{test_podcast.id}/like",
            headers=auth_header(token),
        )
        assert resp.status_code == 200
        assert "unliked" in resp.json()["message"].lower()

    def test_unlike_not_liked_returns_404(self, test_user, test_podcast):
        _, token = test_user
        resp = client.delete(
            f"/podcasts/{test_podcast.id}/like",
            headers=auth_header(token),
        )
        assert resp.status_code == 404


class TestPodcastBookmark:
    """Tests for POST /podcasts/{id}/bookmark and DELETE /podcasts/{id}/bookmark."""

    def test_bookmark_podcast_success(self, test_user, test_podcast):
        _, token = test_user
        resp = client.post(
            f"/podcasts/{test_podcast.id}/bookmark",
            headers=auth_header(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["podcast_id"] == test_podcast.id
        assert data["user_id"] == test_user[0].id

    def test_bookmark_podcast_updates_stats(self, db_session, test_user, test_podcast):
        _, token = test_user
        client.post(
            f"/podcasts/{test_podcast.id}/bookmark",
            headers=auth_header(token),
        )
        stats = db_session.query(models.PodcastStats).filter(
            models.PodcastStats.podcast_id == test_podcast.id
        ).first()
        db_session.refresh(stats)
        assert stats.bookmark_count >= 1

    def test_bookmark_podcast_duplicate_returns_400(self, test_user, test_podcast):
        _, token = test_user
        client.post(
            f"/podcasts/{test_podcast.id}/bookmark",
            headers=auth_header(token),
        )
        resp = client.post(
            f"/podcasts/{test_podcast.id}/bookmark",
            headers=auth_header(token),
        )
        assert resp.status_code == 400
        assert "already bookmarked" in resp.json()["detail"].lower()

    def test_bookmark_nonexistent_podcast_returns_404(self, test_user):
        _, token = test_user
        resp = client.post(
            "/podcasts/99999/bookmark",
            headers=auth_header(token),
        )
        assert resp.status_code == 404

    def test_bookmark_unauthenticated_returns_401(self, test_podcast):
        resp = client.post(f"/podcasts/{test_podcast.id}/bookmark")
        assert resp.status_code == 401

    def test_remove_bookmark_success(self, test_user, test_podcast):
        _, token = test_user
        client.post(
            f"/podcasts/{test_podcast.id}/bookmark",
            headers=auth_header(token),
        )
        resp = client.delete(
            f"/podcasts/{test_podcast.id}/bookmark",
            headers=auth_header(token),
        )
        assert resp.status_code == 200
        assert "removed" in resp.json()["message"].lower()

    def test_remove_bookmark_not_bookmarked_returns_404(self, test_user, test_podcast):
        _, token = test_user
        resp = client.delete(
            f"/podcasts/{test_podcast.id}/bookmark",
            headers=auth_header(token),
        )
        assert resp.status_code == 404


class TestPodcastInteractions:
    """Tests for GET /podcasts/{id}/interactions."""

    def test_get_interactions_no_activity(self, test_user, test_podcast):
        _, token = test_user
        resp = client.get(
            f"/podcasts/{test_podcast.id}/interactions",
            headers=auth_header(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_liked"] is False
        assert data["is_bookmarked"] is False
        assert data["listening_history"] is None

    def test_get_interactions_after_like_and_bookmark(self, test_user, test_podcast):
        _, token = test_user
        client.post(
            f"/podcasts/{test_podcast.id}/like",
            headers=auth_header(token),
        )
        client.post(
            f"/podcasts/{test_podcast.id}/bookmark",
            headers=auth_header(token),
        )
        resp = client.get(
            f"/podcasts/{test_podcast.id}/interactions",
            headers=auth_header(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_liked"] is True
        assert data["is_bookmarked"] is True

    def test_get_interactions_unauthenticated_returns_401(self, test_podcast):
        resp = client.get(f"/podcasts/{test_podcast.id}/interactions")
        assert resp.status_code == 401


class TestPodcastComments:
    """Tests for comment CRUD on podcasts."""

    def test_create_comment_success(self, test_user, test_podcast):
        _, token = test_user
        resp = client.post(
            f"/podcasts/{test_podcast.id}/comments",
            headers=auth_header(token),
            json={
                "podcast_id": test_podcast.id,
                "content": "Great episode!",
                "timestamp": 42,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["content"] == "Great episode!"
        assert data["timestamp"] == 42
        assert data["podcast_id"] == test_podcast.id
        assert data["user_id"] == test_user[0].id

    def test_create_comment_podcast_id_mismatch_returns_400(self, test_user, test_podcast):
        _, token = test_user
        resp = client.post(
            f"/podcasts/{test_podcast.id}/comments",
            headers=auth_header(token),
            json={
                "podcast_id": 99999,  # mismatch
                "content": "Should fail",
                "timestamp": 0,
            },
        )
        assert resp.status_code == 400

    def test_create_comment_nonexistent_podcast_returns_404(self, test_user):
        _, token = test_user
        resp = client.post(
            "/podcasts/99999/comments",
            headers=auth_header(token),
            json={
                "podcast_id": 99999,
                "content": "Ghost podcast",
                "timestamp": 0,
            },
        )
        assert resp.status_code == 404

    def test_list_comments(self, test_user, test_podcast):
        _, token = test_user
        # Create two comments
        for i in range(2):
            client.post(
                f"/podcasts/{test_podcast.id}/comments",
                headers=auth_header(token),
                json={
                    "podcast_id": test_podcast.id,
                    "content": f"Comment {i}",
                    "timestamp": i * 10,
                },
            )
        resp = client.get(f"/podcasts/{test_podcast.id}/comments")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 2

    def test_update_comment_owner_success(self, test_user, test_podcast):
        _, token = test_user
        # Create comment
        create_resp = client.post(
            f"/podcasts/{test_podcast.id}/comments",
            headers=auth_header(token),
            json={
                "podcast_id": test_podcast.id,
                "content": "Original",
                "timestamp": 0,
            },
        )
        comment_id = create_resp.json()["id"]

        # Update it
        resp = client.put(
            f"/podcasts/comments/{comment_id}",
            headers=auth_header(token),
            json={"content": "Updated content"},
        )
        assert resp.status_code == 200
        assert resp.json()["content"] == "Updated content"

    def test_update_comment_non_owner_returns_403(
        self, test_user, second_user, test_podcast
    ):
        _, owner_token = test_user
        _, other_token = second_user

        # Owner creates comment
        create_resp = client.post(
            f"/podcasts/{test_podcast.id}/comments",
            headers=auth_header(owner_token),
            json={
                "podcast_id": test_podcast.id,
                "content": "Owner's comment",
                "timestamp": 0,
            },
        )
        comment_id = create_resp.json()["id"]

        # Other user tries to update
        resp = client.put(
            f"/podcasts/comments/{comment_id}",
            headers=auth_header(other_token),
            json={"content": "Hijacked"},
        )
        assert resp.status_code == 403

    def test_delete_comment_owner_success(self, test_user, test_podcast):
        _, token = test_user
        create_resp = client.post(
            f"/podcasts/{test_podcast.id}/comments",
            headers=auth_header(token),
            json={
                "podcast_id": test_podcast.id,
                "content": "To be deleted",
                "timestamp": 0,
            },
        )
        comment_id = create_resp.json()["id"]

        resp = client.delete(
            f"/podcasts/comments/{comment_id}",
            headers=auth_header(token),
        )
        assert resp.status_code == 200
        assert "deleted" in resp.json()["message"].lower()

    def test_delete_comment_non_owner_returns_403(
        self, test_user, second_user, test_podcast
    ):
        _, owner_token = test_user
        _, other_token = second_user

        create_resp = client.post(
            f"/podcasts/{test_podcast.id}/comments",
            headers=auth_header(owner_token),
            json={
                "podcast_id": test_podcast.id,
                "content": "Protected comment",
                "timestamp": 0,
            },
        )
        comment_id = create_resp.json()["id"]

        resp = client.delete(
            f"/podcasts/comments/{comment_id}",
            headers=auth_header(other_token),
        )
        assert resp.status_code == 403

    def test_delete_nonexistent_comment_returns_404(self, test_user):
        _, token = test_user
        resp = client.delete(
            "/podcasts/comments/99999",
            headers=auth_header(token),
        )
        assert resp.status_code == 404

    def test_create_comment_unauthenticated_returns_401(self, test_podcast):
        resp = client.post(
            f"/podcasts/{test_podcast.id}/comments",
            json={
                "podcast_id": test_podcast.id,
                "content": "No auth",
                "timestamp": 0,
            },
        )
        assert resp.status_code == 401


class TestListeningHistory:
    """Tests for POST /podcasts/{id}/history."""

    def test_create_listening_history(self, test_user, test_podcast):
        _, token = test_user
        resp = client.post(
            f"/podcasts/{test_podcast.id}/history",
            headers=auth_header(token),
            json={"position": 120, "listen_time": 120, "completed": False},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["position"] == 120
        assert data["listen_time"] == 120
        assert data["completed"] is False
        assert data["podcast_id"] == test_podcast.id

    def test_update_listening_history(self, test_user, test_podcast):
        _, token = test_user
        # Create
        client.post(
            f"/podcasts/{test_podcast.id}/history",
            headers=auth_header(token),
            json={"position": 60},
        )
        # Update
        resp = client.post(
            f"/podcasts/{test_podcast.id}/history",
            headers=auth_header(token),
            json={"position": 200, "listen_time": 200, "completed": True},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["position"] == 200
        assert data["completed"] is True

    def test_history_nonexistent_podcast_returns_404(self, test_user):
        _, token = test_user
        resp = client.post(
            "/podcasts/99999/history",
            headers=auth_header(token),
            json={"position": 10},
        )
        assert resp.status_code == 404

    def test_history_unauthenticated_returns_401(self, test_podcast):
        resp = client.post(
            f"/podcasts/{test_podcast.id}/history",
            json={"position": 10},
        )
        assert resp.status_code == 401


class TestDeleteListeningHistory:
    """Tests for DELETE /podcasts/{id}/history."""

    def test_delete_history_entry(self, test_user, test_podcast):
        _, token = test_user
        # Create a history entry first
        client.post(
            f"/podcasts/{test_podcast.id}/history",
            headers=auth_header(token),
            json={"position": 100, "listen_time": 100, "completed": False},
        )
        # Delete it
        resp = client.delete(
            f"/podcasts/{test_podcast.id}/history",
            headers=auth_header(token),
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "History entry removed"

    def test_delete_history_then_gone_from_list(self, test_user, test_podcast):
        _, token = test_user
        headers = auth_header(token)
        # Create
        client.post(
            f"/podcasts/{test_podcast.id}/history",
            headers=headers,
            json={"position": 50},
        )
        # Delete
        client.delete(f"/podcasts/{test_podcast.id}/history", headers=headers)
        # Verify no longer in history list
        resp = client.get("/podcasts/my/history", headers=headers)
        assert resp.status_code == 200
        ids = [e["podcast_id"] for e in resp.json()]
        assert test_podcast.id not in ids

    def test_delete_nonexistent_history_returns_404(self, test_user, test_podcast):
        _, token = test_user
        resp = client.delete(
            f"/podcasts/{test_podcast.id}/history",
            headers=auth_header(token),
        )
        assert resp.status_code == 404

    def test_delete_history_nonexistent_podcast_returns_404(self, test_user):
        _, token = test_user
        resp = client.delete(
            "/podcasts/99999/history",
            headers=auth_header(token),
        )
        assert resp.status_code == 404

    def test_delete_history_unauthenticated_returns_401(self, test_podcast):
        resp = client.delete(f"/podcasts/{test_podcast.id}/history")
        assert resp.status_code == 401
