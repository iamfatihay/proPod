"""
Tests for GET /users/search (creator search endpoint).

Covers:
- Basic name search returns matching users
- Search is case-insensitive
- Partial match works
- Returns empty list when no match
- Missing query param returns 422
- Query too short or too long returns 422
- is_following flag is False for unauthenticated requests
- is_following flag is True when caller follows the result user
- Pagination (skip/limit) works
- Inactive users are excluded
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models import User, UserFollow
from app import crud, schemas
from app.auth import create_access_token

client = TestClient(app)


# ==================== Fixtures ====================

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def user_alice(db):
    email = "alice_search@test.com"
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        db.delete(existing)
        db.commit()
    u = crud.create_user(db, schemas.UserCreate(email=email, name="Alice Wonder", password="Pass1234!"))
    token = create_access_token({"sub": u.email})
    yield {"user": u, "token": token, "headers": {"Authorization": f"Bearer {token}"}}
    db.query(UserFollow).filter(
        (UserFollow.follower_id == u.id) | (UserFollow.followed_id == u.id)
    ).delete(synchronize_session=False)
    db.delete(u)
    db.commit()


@pytest.fixture
def user_bob(db):
    email = "bob_search@test.com"
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        db.delete(existing)
        db.commit()
    u = crud.create_user(db, schemas.UserCreate(email=email, name="Bob Builder", password="Pass1234!"))
    token = create_access_token({"sub": u.email})
    yield {"user": u, "token": token, "headers": {"Authorization": f"Bearer {token}"}}
    db.query(UserFollow).filter(
        (UserFollow.follower_id == u.id) | (UserFollow.followed_id == u.id)
    ).delete(synchronize_session=False)
    db.delete(u)
    db.commit()


@pytest.fixture
def inactive_user(db):
    email = "inactive_search@test.com"
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        db.delete(existing)
        db.commit()
    u = crud.create_user(db, schemas.UserCreate(email=email, name="AliceInactive", password="Pass1234!"))
    u.is_active = False
    db.commit()
    yield u
    db.delete(u)
    db.commit()


# ==================== Tests ====================

class TestUserSearchBasic:
    def test_search_returns_matching_user(self, user_alice):
        resp = client.get("/users/search?q=Alice")
        assert resp.status_code == 200
        names = [u["name"] for u in resp.json()]
        assert any("Alice" in n for n in names)

    def test_search_case_insensitive(self, user_alice):
        resp = client.get("/users/search?q=alice")
        assert resp.status_code == 200
        names = [u["name"] for u in resp.json()]
        assert any("Alice" in n for n in names)

    def test_search_partial_match(self, user_alice):
        resp = client.get("/users/search?q=Wond")
        assert resp.status_code == 200
        names = [u["name"] for u in resp.json()]
        assert any("Alice" in n for n in names)

    def test_search_no_match_returns_empty(self, user_alice):
        resp = client.get("/users/search?q=xyzzy_no_such_user_42")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_search_response_has_required_fields(self, user_alice):
        resp = client.get("/users/search?q=Alice")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        u = next(x for x in data if "Alice" in x["name"])
        for field in ("id", "name", "podcast_count", "total_followers", "is_following"):
            assert field in u, f"Missing field: {field}"


class TestUserSearchValidation:
    def test_missing_query_returns_422(self):
        resp = client.get("/users/search")
        assert resp.status_code == 422

    def test_empty_query_returns_422(self):
        resp = client.get("/users/search?q=")
        assert resp.status_code == 422

    def test_query_too_long_returns_422(self):
        resp = client.get(f"/users/search?q={'a' * 101}")
        assert resp.status_code == 422


class TestUserSearchIsFollowing:
    def test_unauthenticated_is_following_false(self, user_alice):
        resp = client.get("/users/search?q=Alice")
        assert resp.status_code == 200
        for u in resp.json():
            if "Alice" in u["name"]:
                assert u["is_following"] is False

    def test_authenticated_not_following_is_false(self, user_bob, user_alice):
        resp = client.get(
            "/users/search?q=Alice",
            headers=user_bob["headers"],
        )
        assert resp.status_code == 200
        for u in resp.json():
            if u["id"] == user_alice["user"].id:
                assert u["is_following"] is False

    def test_authenticated_following_is_true(self, db, user_bob, user_alice):
        # Bob follows Alice
        client.post(
            f"/users/{user_alice['user'].id}/follow",
            headers=user_bob["headers"],
        )
        resp = client.get(
            "/users/search?q=Alice",
            headers=user_bob["headers"],
        )
        assert resp.status_code == 200
        for u in resp.json():
            if u["id"] == user_alice["user"].id:
                assert u["is_following"] is True


class TestUserSearchExclusions:
    def test_inactive_users_excluded(self, inactive_user):
        resp = client.get("/users/search?q=AliceInactive")
        assert resp.status_code == 200
        ids = [u["id"] for u in resp.json()]
        assert inactive_user.id not in ids


class TestUserSearchPagination:
    def test_limit_respected(self, user_alice, user_bob):
        resp = client.get("/users/search?q=b&limit=1")
        assert resp.status_code == 200
        assert len(resp.json()) <= 1

    def test_skip_offsets_results(self, user_alice, user_bob):
        resp_all = client.get("/users/search?q=b&limit=50")
        resp_skip = client.get("/users/search?q=b&limit=50&skip=1")
        assert resp_all.status_code == 200
        assert resp_skip.status_code == 200
        all_ids = [u["id"] for u in resp_all.json()]
        skip_ids = [u["id"] for u in resp_skip.json()]
        # skip=1 should drop the first result
        if len(all_ids) >= 2:
            assert all_ids[1:] == skip_ids
