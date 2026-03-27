"""Tests for the Continue Listening feature.

Covers the GET /podcasts/my/continue-listening endpoint which returns
podcasts the user has started but not yet finished, ordered by most
recently played.
"""
import datetime
from datetime import timezone

from fastapi.testclient import TestClient

from app.main import app
from app import models, crud, schemas

client = TestClient(app)


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _cleanup_history(db, user_id: int):
    """Remove all listening history for a user."""
    db.query(models.ListeningHistory).filter(
        models.ListeningHistory.user_id == user_id
    ).delete(synchronize_session=False)
    db.commit()


def _create_podcast(db, owner_id: int, title: str, duration: int = 600, **kwargs):
    """Helper to create a podcast via CRUD (ensures PodcastStats row exists)."""
    data = schemas.PodcastCreate(
        title=title,
        description=f"Description for {title}",
        category=kwargs.get("category", "Technology"),
        is_public=kwargs.get("is_public", True),
        duration=duration,
        audio_url="http://localhost:8000/media/audio/test.mp3",
    )
    return crud.create_podcast(db, data, owner_id=owner_id)


# ---------- Endpoint tests ----------


class TestContinueListeningEndpoint:
    """Tests for GET /podcasts/my/continue-listening."""

    def test_returns_empty_when_no_history(self, db_session, test_user):
        """Should return an empty list when the user has no listening history."""
        user, token = test_user
        _cleanup_history(db_session, user.id)

        resp = client.get(
            "/podcasts/my/continue-listening",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        assert resp.json() == []

    def test_excludes_completed_podcasts(self, db_session, test_user):
        """Podcasts marked as completed should not appear."""
        user, token = test_user
        _cleanup_history(db_session, user.id)

        podcast = _create_podcast(db_session, user.id, "Completed Episode", duration=300)
        crud.update_listening_history(
            db_session, user.id, podcast.id,
            position=300, listen_time=300, completed=True,
        )

        resp = client.get(
            "/podcasts/my/continue-listening",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        assert resp.json() == []

    def test_excludes_position_zero(self, db_session, test_user):
        """History entries with position == 0 should be excluded."""
        user, token = test_user
        _cleanup_history(db_session, user.id)

        podcast = _create_podcast(db_session, user.id, "Not Started", duration=300)
        crud.update_listening_history(
            db_session, user.id, podcast.id,
            position=0, listen_time=0, completed=False,
        )

        resp = client.get(
            "/podcasts/my/continue-listening",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_in_progress_podcast(self, db_session, test_user):
        """A podcast with position > 0 and completed == False should appear."""
        user, token = test_user
        _cleanup_history(db_session, user.id)

        podcast = _create_podcast(db_session, user.id, "In Progress EP", duration=600)
        crud.update_listening_history(
            db_session, user.id, podcast.id,
            position=120, listen_time=120, completed=False,
        )

        resp = client.get(
            "/podcasts/my/continue-listening",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) == 1

        item = items[0]
        assert item["podcast_id"] == podcast.id
        assert item["title"] == "In Progress EP"
        assert item["position"] == 120
        assert item["listen_time"] == 120
        assert item["duration"] == 600
        assert item["progress_percent"] == 20.0
        assert item["owner_name"] == user.name

    def test_ordered_by_most_recent(self, db_session, test_user):
        """Results should be ordered by last played (most recent first)."""
        user, token = test_user
        _cleanup_history(db_session, user.id)

        p1 = _create_podcast(db_session, user.id, "Older Episode", duration=600)
        p2 = _create_podcast(db_session, user.id, "Newer Episode", duration=600)

        # Create history for p1 first, then p2 — p2 should come first
        crud.update_listening_history(
            db_session, user.id, p1.id,
            position=60, listen_time=60, completed=False,
        )
        crud.update_listening_history(
            db_session, user.id, p2.id,
            position=90, listen_time=90, completed=False,
        )

        resp = client.get(
            "/podcasts/my/continue-listening",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) >= 2
        assert items[0]["podcast_id"] == p2.id
        assert items[1]["podcast_id"] == p1.id

    def test_excludes_deleted_podcasts(self, db_session, test_user):
        """Soft-deleted podcasts should not appear in continue listening."""
        user, token = test_user
        _cleanup_history(db_session, user.id)

        podcast = _create_podcast(db_session, user.id, "Deleted EP", duration=600)
        crud.update_listening_history(
            db_session, user.id, podcast.id,
            position=100, listen_time=100, completed=False,
        )

        # Soft-delete the podcast
        podcast.is_deleted = True
        podcast.deleted_at = datetime.datetime.now(timezone.utc)
        db_session.commit()

        resp = client.get(
            "/podcasts/my/continue-listening",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        assert all(i["podcast_id"] != podcast.id for i in resp.json())

    def test_pagination(self, db_session, test_user):
        """The skip and limit query params should paginate results."""
        user, token = test_user
        _cleanup_history(db_session, user.id)

        podcasts = []
        for i in range(5):
            p = _create_podcast(db_session, user.id, f"Paginate EP {i}", duration=600)
            crud.update_listening_history(
                db_session, user.id, p.id,
                position=50 + i, listen_time=50 + i, completed=False,
            )
            podcasts.append(p)

        resp = client.get(
            "/podcasts/my/continue-listening?skip=0&limit=2",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 2

        resp2 = client.get(
            "/podcasts/my/continue-listening?skip=2&limit=2",
            headers=_auth_header(token),
        )
        assert resp2.status_code == 200
        assert len(resp2.json()) == 2

        # No overlap between pages
        ids_page1 = {i["podcast_id"] for i in resp.json()}
        ids_page2 = {i["podcast_id"] for i in resp2.json()}
        assert ids_page1.isdisjoint(ids_page2)

    def test_progress_percent_zero_duration(self, db_session, test_user):
        """progress_percent should be 0 when podcast duration is 0."""
        user, token = test_user
        _cleanup_history(db_session, user.id)

        podcast = _create_podcast(db_session, user.id, "Zero Duration EP", duration=0)
        crud.update_listening_history(
            db_session, user.id, podcast.id,
            position=10, listen_time=10, completed=False,
        )

        resp = client.get(
            "/podcasts/my/continue-listening",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        items = [i for i in resp.json() if i["podcast_id"] == podcast.id]
        assert len(items) == 1
        assert items[0]["progress_percent"] == 0.0

    def test_requires_authentication(self):
        """Endpoint should return 401 without a valid token."""
        resp = client.get("/podcasts/my/continue-listening")
        assert resp.status_code in (401, 403)

    def test_includes_other_users_podcasts(self, db_session, test_user, second_user):
        """A user can have in-progress history for podcasts they don't own."""
        user, token = test_user
        other_user, _ = second_user
        _cleanup_history(db_session, user.id)

        # Other user's podcast
        podcast = _create_podcast(
            db_session, other_user.id, "Someone Else's EP", duration=500,
        )
        crud.update_listening_history(
            db_session, user.id, podcast.id,
            position=200, listen_time=200, completed=False,
        )

        resp = client.get(
            "/podcasts/my/continue-listening",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        items = [i for i in resp.json() if i["podcast_id"] == podcast.id]
        assert len(items) == 1
        assert items[0]["owner_name"] == other_user.name
        assert items[0]["progress_percent"] == 40.0
