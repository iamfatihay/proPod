"""
Tests for PodcastStats.comment_count synchronization.

Verifies that creating and deleting comments correctly increments
and decrements the denormalized comment_count in PodcastStats,
matching the existing pattern used by like_count and bookmark_count.
"""
from fastapi.testclient import TestClient

from app.main import app
import app.models as models

client = TestClient(app)


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestCommentStatsSync:
    """Tests that PodcastStats.comment_count stays in sync with comments."""

    def test_create_comment_increments_stats(self, db_session, test_user, test_podcast):
        _, token = test_user
        # Get initial comment count
        stats = db_session.query(models.PodcastStats).filter(
            models.PodcastStats.podcast_id == test_podcast.id
        ).first()
        db_session.refresh(stats)
        initial_count = stats.comment_count

        resp = client.post(
            f"/podcasts/{test_podcast.id}/comments",
            json={
                "podcast_id": test_podcast.id,
                "content": "Great episode!",
                "timestamp": 30,
            },
            headers=auth_header(token),
        )
        assert resp.status_code == 200

        db_session.refresh(stats)
        assert stats.comment_count == initial_count + 1

    def test_delete_comment_decrements_stats(self, db_session, test_user, test_podcast):
        _, token = test_user
        # Create a comment first
        resp = client.post(
            f"/podcasts/{test_podcast.id}/comments",
            json={
                "podcast_id": test_podcast.id,
                "content": "Comment to delete",
                "timestamp": 0,
            },
            headers=auth_header(token),
        )
        assert resp.status_code == 200
        comment_id = resp.json()["id"]

        stats = db_session.query(models.PodcastStats).filter(
            models.PodcastStats.podcast_id == test_podcast.id
        ).first()
        db_session.refresh(stats)
        count_after_create = stats.comment_count

        # Delete the comment
        resp = client.delete(
            f"/podcasts/comments/{comment_id}",
            headers=auth_header(token),
        )
        assert resp.status_code == 200

        db_session.refresh(stats)
        assert stats.comment_count == count_after_create - 1

    def test_multiple_comments_increment_correctly(self, db_session, test_user, test_podcast):
        _, token = test_user
        stats = db_session.query(models.PodcastStats).filter(
            models.PodcastStats.podcast_id == test_podcast.id
        ).first()
        db_session.refresh(stats)
        initial_count = stats.comment_count

        # Add three comments
        for i in range(3):
            resp = client.post(
                f"/podcasts/{test_podcast.id}/comments",
                json={
                    "podcast_id": test_podcast.id,
                    "content": f"Comment number {i+1}",
                    "timestamp": i * 10,
                },
                headers=auth_header(token),
            )
            assert resp.status_code == 200

        db_session.refresh(stats)
        assert stats.comment_count == initial_count + 3

    def test_comment_count_never_goes_negative(self, db_session, test_user, test_podcast):
        """Ensure comment_count doesn't underflow if stats are out of sync."""
        _, token = test_user
        # Force stats to zero
        stats = db_session.query(models.PodcastStats).filter(
            models.PodcastStats.podcast_id == test_podcast.id
        ).first()
        stats.comment_count = 0
        db_session.commit()

        # Create a comment
        create_resp = client.post(
            f"/podcasts/{test_podcast.id}/comments",
            json={
                "podcast_id": test_podcast.id,
                "content": "Temp comment",
                "timestamp": 0,
            },
            headers=auth_header(token),
        )
        assert create_resp.status_code == 200, (
            f"Expected 200 on comment create, got {create_resp.status_code}: {create_resp.text}"
        )
        comment_id = create_resp.json()["id"]

        # Stats should now be 1
        db_session.refresh(stats)
        assert stats.comment_count == 1

        # Delete the comment
        delete_resp = client.delete(
            f"/podcasts/comments/{comment_id}",
            headers=auth_header(token),
        )
        assert delete_resp.status_code == 200, (
            f"Expected 200 on comment delete, got {delete_resp.status_code}: {delete_resp.text}"
        )

        db_session.refresh(stats)
        assert stats.comment_count == 0
