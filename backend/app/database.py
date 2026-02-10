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

# PostgreSQL-specific connection arguments
postgresql_connect_args = {
    "connect_timeout": 10,  # Connection timeout in seconds
    "options": "-c timezone=utc"  # Set timezone to UTC
}

# PostgreSQL engine with optimized connection pooling
# Note: This configuration is optimized for PostgreSQL. For other databases,
# adjust pool settings and remove PostgreSQL-specific connect_args.
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before using
    echo=DATABASE_ECHO,  # SQL query logging
    pool_size=10,  # Connection pool size (10 concurrent connections)
    max_overflow=20,  # Extra connections when pool is full (total max: 30)
    pool_recycle=3600,  # Recycle connections after 1 hour (prevent stale connections)
    pool_timeout=30,  # Wait 30s for available connection
    connect_args=postgresql_connect_args if is_postgresql else {}
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