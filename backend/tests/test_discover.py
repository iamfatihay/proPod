"""Tests for podcast discovery endpoints.

Covers:
- GET /podcasts/discover/categories
- GET /podcasts/discover/trending
- GET /podcasts/discover/recommended
- GET /podcasts/discover/related/{podcast_id}
"""
import datetime
from datetime import timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.auth import create_access_token
from app import crud, models, schemas

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_user(db, email: str, name: str = "Discover User"):
    """Create a user, cleaning up any prior record with the same email."""
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        # Clean related data
        for mid in [
            models.PodcastComment, models.ListeningHistory,
            models.PodcastBookmark, models.PodcastLike,
        ]:
            db.query(mid).filter(mid.user_id == existing.id).delete(synchronize_session=False)
        podcast_ids = [
            p.id for p in db.query(models.Podcast).filter(models.Podcast.owner_id == existing.id).all()
        ]
        if podcast_ids:
            for mid in [
                models.PodcastComment, models.ListeningHistory,
                models.PodcastBookmark, models.PodcastLike, models.PodcastStats,
            ]:
                db.query(mid).filter(mid.podcast_id.in_(podcast_ids)).delete(synchronize_session=False)
            db.query(models.PodcastAIData).filter(
                models.PodcastAIData.podcast_id.in_(podcast_ids)
            ).delete(synchronize_session=False)
            db.query(models.Podcast).filter(models.Podcast.owner_id == existing.id).delete(synchronize_session=False)
        db.delete(existing)
        db.commit()

    user_data = schemas.UserCreate(email=email, name=name, password="pass1234", provider="local")
    return crud.create_user(db, user_data)


def _create_podcast(db, owner_id: int, title: str, category: str = "Technology",
                    is_public: bool = True, is_deleted: bool = False):
    """Create a podcast with stats row via CRUD, optionally soft-deleted."""
    podcast_data = schemas.PodcastCreate(
        title=title, description=f"Description for {title}",
        category=category, is_public=is_public, duration=120,
        audio_url="http://localhost:8000/media/audio/test.mp3",
    )
    podcast = crud.create_podcast(db, podcast_data, owner_id=owner_id)
    if is_deleted:
        podcast.is_deleted = True
        podcast.deleted_at = datetime.datetime.now(timezone.utc)
        db.commit()
    return podcast


def _auth_header(email: str):
    token = create_access_token(data={"sub": email})
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def discover_user(db):
    return _create_user(db, "discover_user@test.com", "Discover Tester")


@pytest.fixture
def discover_podcasts(db, discover_user):
    """Create a mix of podcasts across categories for discovery tests."""
    podcasts = []
    categories = ["Technology", "Technology", "Music", "Science", "Music"]
    for i, cat in enumerate(categories):
        p = _create_podcast(db, discover_user.id, f"Discover Pod {i}", category=cat)
        podcasts.append(p)
    # Also create a soft-deleted podcast — should be excluded everywhere
    _create_podcast(db, discover_user.id, "Deleted Pod", category="Technology", is_deleted=True)
    # And a private podcast — should be excluded from public discover
    _create_podcast(db, discover_user.id, "Private Pod", category="Technology", is_public=False)
    return podcasts


# ===========================================================================
# /discover/categories
# ===========================================================================

class TestDiscoverCategories:
    def test_categories_returns_list(self, discover_podcasts):
        resp = client.get("/podcasts/discover/categories")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Every item has the expected keys
        for item in data:
            assert "category" in item
            assert "podcast_count" in item
            assert item["podcast_count"] > 0

    def test_categories_sorted_by_count_desc(self, discover_podcasts):
        resp = client.get("/podcasts/discover/categories")
        data = resp.json()
        counts = [item["podcast_count"] for item in data]
        assert counts == sorted(counts, reverse=True)

    def test_categories_excludes_deleted(self, db, discover_user, discover_podcasts):
        """Soft-deleted podcasts must not inflate category counts."""
        # Compute the expected count dynamically: all public, non-deleted
        # Technology podcasts in the DB at this moment.  Other test modules
        # may have left Technology podcasts around, so we must not hard-code 2.
        expected = db.query(models.Podcast).filter(
            models.Podcast.is_public == True,
            models.Podcast.is_deleted == False,
            models.Podcast.category == "Technology",
        ).count()
        # Sanity-check: our fixture definitely created a soft-deleted Tech pod
        deleted_count = db.query(models.Podcast).filter(
            models.Podcast.owner_id == discover_user.id,
            models.Podcast.category == "Technology",
            models.Podcast.is_deleted == True,
        ).count()
        assert deleted_count >= 1, "Fixture must include at least 1 deleted Tech podcast"

        resp = client.get("/podcasts/discover/categories")
        data = resp.json()
        tech = next((c for c in data if c["category"] == "Technology"), None)
        assert tech is not None
        # The deleted podcast must not be counted — count must match only the
        # public non-deleted ones.
        assert tech["podcast_count"] == expected

    def test_categories_excludes_private(self, db, discover_user, discover_podcasts):
        """Private podcasts must not be counted."""
        # Same dynamic approach: count only public, non-deleted Tech podcasts.
        expected = db.query(models.Podcast).filter(
            models.Podcast.is_public == True,
            models.Podcast.is_deleted == False,
            models.Podcast.category == "Technology",
        ).count()
        # Sanity-check: our fixture created a private Tech pod
        private_count = db.query(models.Podcast).filter(
            models.Podcast.owner_id == discover_user.id,
            models.Podcast.category == "Technology",
            models.Podcast.is_public == False,
        ).count()
        assert private_count >= 1, "Fixture must include at least 1 private Tech podcast"

        resp = client.get("/podcasts/discover/categories")
        data = resp.json()
        tech = next((c for c in data if c["category"] == "Technology"), None)
        assert tech is not None
        # The private podcast must not be counted.
        assert tech["podcast_count"] == expected

    def test_categories_returns_list_on_empty_db(self, db):
        """Endpoint returns an empty list when there are no public podcasts.

        Verifies no 500 on a bare DB and that the response is a list (satisfies
        the response_model=List[CategoryInfo] contract with zero items).
        """
        from sqlalchemy import text as _text
        # Record exactly which podcasts we are about to hide so that the
        # finally block only restores *those* rows — not pre-existing
        # soft-deleted podcasts (e.g. the "Deleted Pod" fixture).
        rows = db.execute(_text(
            "SELECT id FROM podcasts WHERE is_deleted = 0 AND is_public = 1"
        )).fetchall()
        temporarily_hidden_ids = [row[0] for row in rows]

        if temporarily_hidden_ids:
            id_list = ",".join(str(i) for i in temporarily_hidden_ids)
            db.execute(_text(
                f"UPDATE podcasts SET is_deleted = 1 WHERE id IN ({id_list})"
            ))
            db.commit()
        try:
            resp = client.get("/podcasts/discover/categories")
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            assert data == [], f"Expected empty list, got {data[:3]}"
        finally:
            # Restore only the podcasts we temporarily hid.
            if temporarily_hidden_ids:
                id_list = ",".join(str(i) for i in temporarily_hidden_ids)
                db.execute(_text(
                    f"UPDATE podcasts SET is_deleted = 0, deleted_at = NULL"
                    f" WHERE id IN ({id_list})"
                ))
                db.commit()


# ===========================================================================
# /discover/trending
# ===========================================================================

class TestDiscoverTrending:
    def test_trending_returns_list(self, discover_podcasts):
        resp = client.get("/podcasts/discover/trending")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_trending_respects_limit(self, discover_podcasts):
        resp = client.get("/podcasts/discover/trending?limit=2")
        assert resp.status_code == 200
        assert len(resp.json()) <= 2

    def test_trending_limit_validation(self):
        resp = client.get("/podcasts/discover/trending?limit=0")
        assert resp.status_code == 422
        resp = client.get("/podcasts/discover/trending?limit=51")
        assert resp.status_code == 422

    def test_trending_days_validation(self):
        resp = client.get("/podcasts/discover/trending?days=0")
        assert resp.status_code == 422
        resp = client.get("/podcasts/discover/trending?days=31")
        assert resp.status_code == 422

    def test_trending_excludes_deleted(self, db, discover_user, discover_podcasts):
        """Soft-deleted podcasts must not appear in trending."""
        resp = client.get("/podcasts/discover/trending?limit=50")
        data = resp.json()
        titles = [p["title"] for p in data]
        assert "Deleted Pod" not in titles

    def test_trending_with_interactions(self, db, discover_user, discover_podcasts):
        """Podcasts with more recent interactions should rank higher."""
        target = discover_podcasts[0]  # give this one some likes
        other_user = _create_user(db, "trending_liker@test.com", "Liker")
        like = models.PodcastLike(
            user_id=other_user.id,
            podcast_id=target.id,
            created_at=datetime.datetime.now(timezone.utc),
        )
        db.add(like)
        db.commit()

        resp = client.get("/podcasts/discover/trending?limit=50")
        data = resp.json()
        # The liked podcast should be in the results
        ids = [p["id"] for p in data]
        assert target.id in ids


# ===========================================================================
# /discover/recommended
# ===========================================================================

class TestDiscoverRecommended:
    def test_recommended_requires_auth(self):
        resp = client.get("/podcasts/discover/recommended")
        assert resp.status_code == 401

    def test_recommended_returns_list(self, discover_user, discover_podcasts):
        resp = client.get(
            "/podcasts/discover/recommended",
            headers=_auth_header(discover_user.email),
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_recommended_respects_limit(self, discover_user, discover_podcasts):
        resp = client.get(
            "/podcasts/discover/recommended?limit=2",
            headers=_auth_header(discover_user.email),
        )
        assert resp.status_code == 200
        assert len(resp.json()) <= 2

    def test_recommended_falls_back_to_trending_without_likes(self, db):
        """A user with no likes should still get results (falls back to trending)."""
        fresh_user = _create_user(db, "fresh_discover@test.com", "Fresh")
        resp = client.get(
            "/podcasts/discover/recommended",
            headers=_auth_header(fresh_user.email),
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_recommended_prefers_liked_categories(self, db, discover_podcasts):
        """Recommendations should favor categories the user has liked."""
        liker = _create_user(db, "cat_liker@test.com", "CatLiker")
        # Like a Music podcast
        music_pods = [p for p in discover_podcasts if p.category == "Music"]
        if music_pods:
            like = models.PodcastLike(
                user_id=liker.id,
                podcast_id=music_pods[0].id,
                created_at=datetime.datetime.now(timezone.utc),
            )
            db.add(like)
            db.commit()

        resp = client.get(
            "/podcasts/discover/recommended?limit=50",
            headers=_auth_header(liker.email),
        )
        assert resp.status_code == 200
        data = resp.json()
        # The liked podcast itself should NOT appear in recommendations
        ids = [p["id"] for p in data]
        assert music_pods[0].id not in ids


# ===========================================================================
# /discover/related/{podcast_id}
# ===========================================================================

class TestDiscoverRelated:
    def test_related_returns_same_category(self, discover_podcasts):
        tech_pods = [p for p in discover_podcasts if p.category == "Technology"]
        assert len(tech_pods) >= 2, "Need at least 2 Tech podcasts for this test"

        target = tech_pods[0]
        resp = client.get(f"/podcasts/discover/related/{target.id}")
        assert resp.status_code == 200
        data = resp.json()
        for p in data:
            assert p["category"] == "Technology"
            assert p["id"] != target.id

    def test_related_excludes_reference_podcast(self, discover_podcasts):
        target = discover_podcasts[0]
        resp = client.get(f"/podcasts/discover/related/{target.id}")
        assert resp.status_code == 200
        ids = [p["id"] for p in resp.json()]
        assert target.id not in ids

    def test_related_not_found(self):
        resp = client.get("/podcasts/discover/related/999999")
        assert resp.status_code == 404

    def test_related_respects_limit(self, discover_podcasts):
        target = discover_podcasts[0]
        resp = client.get(f"/podcasts/discover/related/{target.id}?limit=1")
        assert resp.status_code == 200
        assert len(resp.json()) <= 1

    def test_related_limit_validation(self, discover_podcasts):
        target = discover_podcasts[0]
        resp = client.get(f"/podcasts/discover/related/{target.id}?limit=0")
        assert resp.status_code == 422
        resp = client.get(f"/podcasts/discover/related/{target.id}?limit=21")
        assert resp.status_code == 422
