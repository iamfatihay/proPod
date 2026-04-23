"""Database configuration and session management."""
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from sqlalchemy.pool import Pool
from typing import Generator
import os
from dotenv import load_dotenv
import logging

# Configure logging
logger = logging.getLogger(__name__)

# Load .env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/propod_db")

# Make SQL query logging configurable via DATABASE_ECHO environment variable
def str_to_bool(value: str) -> bool:
    """Convert string to boolean."""
    return value.lower() in ("1", "true", "yes", "on")

DATABASE_ECHO = str_to_bool(os.getenv("DATABASE_ECHO", "false"))

# Determine if using PostgreSQL
is_postgresql = DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgresql+")

if is_postgresql:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        echo=DATABASE_ECHO,
        pool_size=10,
        max_overflow=20,
        pool_recycle=3600,
        pool_timeout=30,
        connect_args={"connect_timeout": 10, "options": "-c timezone=utc"},
    )
else:
    # SQLite needs check_same_thread=False when used with FastAPI's
    # TestClient (which runs the ASGI app in a separate thread).
    # Without this, SQLAlchemy raises "SQLite objects created in a thread
    # can only be used in that same thread" for pooled connections.
    _sqlite_connect_args = (
        {"check_same_thread": False}
        if DATABASE_URL.startswith("sqlite")
        else {}
    )
    engine = create_engine(
        DATABASE_URL,
        echo=DATABASE_ECHO,
        connect_args=_sqlite_connect_args,
    )

# Connection pool event listeners for debugging (optional)
@event.listens_for(Pool, "connect")
def receive_connect(dbapi_conn, connection_record):
    """Log when a new database connection is created."""
    logger.debug("New database connection created")

@event.listens_for(Pool, "checkout")
def receive_checkout(dbapi_conn, connection_record, connection_proxy):
    """Log when a connection is checked out from the pool."""
    logger.debug("Connection checked out from pool")

SessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine,
    expire_on_commit=False  # Keep objects usable after commit
)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Dependency function to get database session.
    Yields a database session and ensures it's closed after use.
    
    Usage:
        @router.get("/example")
        def example_endpoint(db: Session = Depends(get_db)):
            # Use db here
            db.commit()  # Explicitly commit when needed
    
    Features:
    - Caller controls when to commit or rollback
    - Auto-rollback on uncaught exceptions
    - Always closes connection (returns to pool)
    - Thread-safe
    
    Note: Route handlers should call db.commit() explicitly when they want
    to persist changes. This prevents partial commits if an exception occurs
    after the dependency yields but before the route completes.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        db.rollback()  # Rollback on error
        # HTTPException is intentional control flow (e.g. 404 when a resource
        # doesn't exist) — don't log it as a database error.
        from fastapi import HTTPException
        if not isinstance(e, HTTPException):
            logger.error(f"Database error: {str(e)}")
        raise
    finally:
        db.close()  # Always close the session (returns to pool)


def get_db_context():
    """
    Context manager for database sessions outside of FastAPI dependency injection.
    
    Usage:
        with get_db_context() as db:
            user = db.query(User).first()
            db.commit()  # Explicitly commit when needed
    
    Note: Caller should call db.commit() explicitly to persist changes.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        db.rollback()
        logger.error(f"Database error: {str(e)}")
        raise
    finally:
        db.close()


# Health check function
def check_database_connection() -> bool:
    """
    Check if database connection is healthy.
    Returns True if connection is successful, False otherwise.
    """
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))  # Use text() for raw SQL - SQLAlchemy best practice
        db.close()
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        return False 