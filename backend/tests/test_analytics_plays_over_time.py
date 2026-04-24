"""Tests for GET /analytics/plays-over-time.

Covers: basic daily grouping, empty state, auth required,
days parameter validation, creator isolation.
"""
import datetime
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models import User, Podcast, PodcastStats, ListeningHistory
from app import crud, schemas
from app.auth import create_access_token

client = TestClient(app)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _cleanup_user(db, user):
    podcast_ids = [
        p.id for p in db.query(Podcast).filter(Podcast.owner_id == user.id).all()
    ]
    if podcast_ids:
        db.query(ListeningHistory).filter(
            ListeningHistory.podcast_id.in_(podcast_ids)
        ).delete(synchronize_session=False)
        db.query(PodcastStats).filter(
            PodcastStats.podcast_id.in_(podcast_ids)
        ).delete(synchronize_session=False)
        db.query(Podcast).filter(Podcast.owner_id == user.id).delete(
            synchronize_session=False
        )
    db.query(ListeningHistory).filter(ListeningHistory.user_id == user.id).delete()
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
    db = db_session
    existing = db.query(User).filter(User.email == "pot_creator@test.com").first()
    if existing:
        _cleanup_user(db, existing)
    user = crud.create_user(db, schemas.UserCreate(
        email="pot_creator@test.com",
        name="POT Creator",
        password="testpass123",
    ))
    token = create_access_token(data={"sub": user.email})
    yield {"user": user, "token": token, "db": db}
    _cleanup_user(db, user)


@pytest.fixture
def listener(db_session):
    db = db_session
    existing = db.query(User).filter(User.email == "pot_listener@test.com").first()
    if existing:
        _cleanup_user(db, existing)
    user = crud.create_user(db, schemas.UserCreate(
        email="pot_listener@test.com",
        name="POT Listener",
        password="testpass123",
    ))
    yield {"user": user, "db": db}
    _cleanup_user(db, user)


@pytest.fixture
def podcast(creator):
    db = creator["db"]
    p = Podcast(
        title="POT Test Podcast",
        description="desc",
        audio_url="http://example.com/audio.mp3",
        owner_id=creator["user"].id,
        is_deleted=False,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    db.add(PodcastStats(podcast_id=p.id))
    db.commit()
    return {"podcast": p, "db": db}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestPlaysOverTimeAuth:
    def test_requires_auth(self):
        resp = client.get("/analytics/plays-over-time")
        assert resp.status_code == 401

    def test_returns_200_for_authenticated_user(self, creator):
        resp = client.get(
            "/analytics/plays-over-time",
            headers=_auth(creator["token"]),
        )
        assert resp.status_code == 200


class TestPlaysOverTimeEmpty:
    def test_empty_when_no_podcasts(self, creator):
        resp = client.get(
            "/analytics/plays-over-time?days=30",
            headers=_auth(creator["token"]),
        )
        body = resp.json()
        assert resp.status_code == 200
        assert body["data"] == []
        assert body["days"] == 30

    def test_empty_when_no_history(self, creator, podcast):
        resp = client.get(
            "/analytics/plays-over-time?days=30",
            headers=_auth(creator["token"]),
        )
        assert resp.json()["data"] == []


class TestPlaysOverTimeData:
    def test_counts_history_entries_by_day(self, creator, listener, podcast):
        db = creator["db"]
        pod = podcast["podcast"]
        today = datetime.datetime.utcnow().replace(
            hour=12, minute=0, second=0, microsecond=0
        )
        h1 = ListeningHistory(
            user_id=listener["user"].id,
            podcast_id=pod.id,
            position=60,
            updated_at=today,
        )
        h2 = ListeningHistory(
            user_id=creator["user"].id,
            podcast_id=pod.id,
            position=30,
            updated_at=today,
        )
        db.add_all([h1, h2])
        db.commit()

        try:
            resp = client.get(
                "/analytics/plays-over-time?days=7",
                headers=_auth(creator["token"]),
            )
            assert resp.status_code == 200
            body = resp.json()
            today_str = today.strftime("%Y-%m-%d")
            today_point = next(
                (d for d in body["data"] if d["date"] == today_str), None
            )
            assert today_point is not None
            assert today_point["plays"] == 2
        finally:
            db.query(ListeningHistory).filter(
                ListeningHistory.podcast_id == pod.id
            ).delete()
            db.commit()

    def test_excludes_history_outside_window(self, creator, listener, podcast):
        db = creator["db"]
        pod = podcast["podcast"]
        old_date = datetime.datetime.utcnow() - datetime.timedelta(days=40)
        h = ListeningHistory(
            user_id=listener["user"].id,
            podcast_id=pod.id,
            position=60,
            updated_at=old_date,
        )
        db.add(h)
        db.commit()

        try:
            resp = client.get(
                "/analytics/plays-over-time?days=30",
                headers=_auth(creator["token"]),
            )
            assert resp.json()["data"] == []
        finally:
            db.query(ListeningHistory).filter(
                ListeningHistory.podcast_id == pod.id
            ).delete()
            db.commit()

    def test_creator_isolation(self, creator, listener, podcast):
        """History on another creator's podcast must not appear in creator's response."""
        db = creator["db"]
        other_user = crud.create_user(db, schemas.UserCreate(
            email="pot_other@test.com",
            name="POT Other",
            password="testpass123",
        ))
        other_pod = Podcast(
            title="Other POT Podcast",
            description="x",
            audio_url="http://x.com/x.mp3",
            owner_id=other_user.id,
            is_deleted=False,
        )
        db.add(other_pod)
        db.commit()
        db.refresh(other_pod)
        db.add(PodcastStats(podcast_id=other_pod.id))
        db.commit()

        today = datetime.datetime.utcnow()
        h = ListeningHistory(
            user_id=listener["user"].id,
            podcast_id=other_pod.id,
            position=60,
            updated_at=today,
        )
        db.add(h)
        db.commit()

        try:
            resp = client.get(
                "/analytics/plays-over-time?days=30",
                headers=_auth(creator["token"]),
            )
            assert resp.json()["data"] == []
        finally:
            db.query(ListeningHistory).filter(
                ListeningHistory.podcast_id == other_pod.id
            ).delete()
            db.query(PodcastStats).filter(
                PodcastStats.podcast_id == other_pod.id
            ).delete()
            db.delete(other_pod)
            _cleanup_user(db, other_user)


class TestPlaysOverTimeDaysParam:
    def test_days_param_reflected_in_response(self, creator):
        for d in [7, 30, 90]:
            resp = client.get(
                f"/analytics/plays-over-time?days={d}",
                headers=_auth(creator["token"]),
            )
            assert resp.status_code == 200
            assert resp.json()["days"] == d

    def test_days_below_minimum_rejected(self, creator):
        resp = client.get(
            "/analytics/plays-over-time?days=3",
            headers=_auth(creator["token"]),
        )
        assert resp.status_code == 422

    def test_days_above_maximum_rejected(self, creator):
        resp = client.get(
            "/analytics/plays-over-time?days=400",
            headers=_auth(creator["token"]),
        )
        assert resp.status_code == 422
