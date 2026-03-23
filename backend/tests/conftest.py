"""Shared test fixtures and configuration for backend tests.

Creates database tables before the test session and cleans up afterward,
ensuring that tests using SessionLocal() have the required schema in place.
"""
import pytest
from app.database import Base, engine


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create all database tables before tests run, drop them after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
