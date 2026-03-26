"""Shared test fixtures and configuration for backend tests.

Creates database tables before the test session and cleans up afterward,
ensuring that tests using SessionLocal() have the required schema in place.
"""
import os
import pytest
from app.database import Base, engine
import app.models  # noqa: F401 — ensure all models are registered with Base.metadata


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
