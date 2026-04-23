"""Shared test fixtures and configuration for backend tests.

Creates database tables before the test session and cleans up afterward,
ensuring that tests using SessionLocal() have the required schema in place.
"""
import os
import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///./propod_test.db")

from app.database import Base, engine, SessionLocal
from app.auth import create_access_token, get_password_hash
from app import crud, schemas
import app.models as models  # noqa: F401 — ensure all models are registered with Base.metadata


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create all database tables before tests run, drop them after."""
    db_name = os.path.basename(str(engine.url.database or ""))
    is_memory = str(engine.url) == "sqlite://" or ":memory:" in str(engine.url)
    if not is_memory and "test" not in db_name:
        raise RuntimeError(
            f"Refusing to run tests against non-test database: {db_name!r}. "
            "Ensure DATABASE_URL points to a dedicated test database "
            '(e.g., with a name containing "test" or using an in-memory SQLite DB).'
        )
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    # Dispose the connection pool before deleting the SQLite file.
    # Without this, open pooled connections hold a file lock on Windows
    # (and can intermittently do so on Linux/macOS too), causing
    # teardown to fail with a PermissionError / "database is locked".
    engine.dispose()
    db_path = str(engine.url.database or "")
    if db_path and db_path not in (":memory:", "") and os.path.exists(db_path):
        try:
            os.remove(db_path)
        except OSError:
            pass  # best-effort: file may still be locked briefly


@pytest.fixture
def db_session():
    """Provide a database session for each test. Closed after test completes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_user(db_session):
    """Create a test user and return (user, access_token) tuple."""
    # Clean up any existing test user
    existing = db_session.query(models.User).filter(
        models.User.email == "testuser@example.com"
    ).first()
    if existing:
        # Clean up playlists and their items
        playlist_ids = [
            p.id for p in db_session.query(models.Playlist).filter(
                models.Playlist.owner_id == existing.id
            ).all()
        ]
        if playlist_ids:
            db_session.query(models.PlaylistItem).filter(
                models.PlaylistItem.playlist_id.in_(playlist_ids)
            ).delete(synchronize_session=False)
            db_session.query(models.Playlist).filter(
                models.Playlist.owner_id == existing.id
            ).delete(synchronize_session=False)
        db_session.query(models.PodcastComment).filter(
            models.PodcastComment.user_id == existing.id
        ).delete()
        db_session.query(models.ListeningHistory).filter(
            models.ListeningHistory.user_id == existing.id
        ).delete()
        db_session.query(models.PodcastBookmark).filter(
            models.PodcastBookmark.user_id == existing.id
        ).delete()
        db_session.query(models.PodcastLike).filter(
            models.PodcastLike.user_id == existing.id
        ).delete()
        podcast_ids = [
            p.id for p in db_session.query(models.Podcast).filter(
                models.Podcast.owner_id == existing.id
            ).all()
        ]
        if podcast_ids:
            for mid in [models.PodcastComment, models.ListeningHistory,
                        models.PodcastBookmark, models.PodcastLike, models.PodcastStats]:
                db_session.query(mid).filter(
                    mid.podcast_id.in_(podcast_ids)
                ).delete(synchronize_session=False)
            db_session.query(models.Podcast).filter(
                models.Podcast.owner_id == existing.id
            ).delete(synchronize_session=False)
        db_session.delete(existing)
        db_session.commit()

    user_data = schemas.UserCreate(
        email="testuser@example.com",
        name="Test User",
        password="testpassword123",
        provider="local",
    )
    user = crud.create_user(db_session, user_data)
    token = create_access_token(data={"sub": user.email})
    return user, token


@pytest.fixture
def second_user(db_session):
    """Create a second test user for authorization tests."""
    existing = db_session.query(models.User).filter(
        models.User.email == "seconduser@example.com"
    ).first()
    if existing:
        db_session.delete(existing)
        db_session.commit()

    user_data = schemas.UserCreate(
        email="seconduser@example.com",
        name="Second User",
        password="testpassword456",
        provider="local",
    )
    user = crud.create_user(db_session, user_data)
    token = create_access_token(data={"sub": user.email})
    return user, token


@pytest.fixture
def test_podcast(db_session, test_user):
    """Create a test podcast with stats using crud.create_podcast, return the podcast object."""
    user, _ = test_user

    podcast_data = schemas.PodcastCreate(
        title="Test Podcast",
        description="A test podcast for unit testing",
        category="Technology",
        is_public=True,
        duration=300,
        audio_url="http://localhost:8000/media/audio/test.mp3",
    )
    # Use crud.create_podcast so PodcastStats row is created correctly (no duplicate)
    podcast = crud.create_podcast(db_session, podcast_data, owner_id=user.id)
    return podcast
