"""
Shared test fixtures and configuration.

Ensures database tables exist before any tests run.
Uses the application's configured DATABASE_URL (SQLite for dev/testing).
"""

import pytest
from app.database import Base, engine


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    """Create all database tables before the test session starts."""
    Base.metadata.create_all(bind=engine)
    yield
    # Optionally drop tables after all tests complete:
    # Base.metadata.drop_all(bind=engine)
