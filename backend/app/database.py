"""Database configuration and session management."""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")

# Make SQL query logging configurable via DATABASE_ECHO environment variable
def str_to_bool(value: str) -> bool:
    """Convert string to boolean."""
    return value.lower() in ("1", "true", "yes", "on")

DATABASE_ECHO = str_to_bool(os.getenv("DATABASE_ECHO", "false"))

# Create engine with connection pooling for better performance
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Enable connection health checks
    echo=DATABASE_ECHO  # Configurable SQL query logging via DATABASE_ECHO env var
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Dependency function to get database session.
    Yields a database session and ensures it's closed after use.
    
    Usage:
        @router.get("/example")
        def example_endpoint(db: Session = Depends(get_db)):
            # Use db here
            pass
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 