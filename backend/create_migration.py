#!/usr/bin/env python3
"""
Database Migration Script for Volo Podcast App
Creates new interaction tables and updates existing schemas
"""

from sqlalchemy import create_engine, text
from app.config import settings
from app.models import Base
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_migration():
    """Run database migration to add interaction tables"""
    engine = create_engine(settings.DATABASE_URL)
    
    try:
        logger.info("Starting database migration...")
        
        # Create all tables (new ones will be created, existing ones will be skipped)
        Base.metadata.create_all(bind=engine)
        
        # Run additional SQL migrations if needed
        with engine.connect() as connection:
            # Add new columns to existing podcasts table if they don't exist
            migration_queries = [
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR;
                """,
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 0;
                """,
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS category VARCHAR DEFAULT 'General';
                """,
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;
                """,
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS ai_enhanced BOOLEAN DEFAULT FALSE;
                """,
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS play_count INTEGER DEFAULT 0;
                """,
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;
                """,
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS bookmark_count INTEGER DEFAULT 0;
                """,
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                """,
                # AI-related columns
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS transcription_text TEXT;
                """,
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS transcription_language VARCHAR;
                """,
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS transcription_confidence VARCHAR;
                """,
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS ai_keywords TEXT;
                """,
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS ai_summary TEXT;
                """,
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS ai_sentiment VARCHAR;
                """,
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS ai_categories TEXT;
                """,
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS ai_processing_status VARCHAR DEFAULT 'pending';
                """,
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS ai_processing_date TIMESTAMP;
                """,
                """
                ALTER TABLE podcasts 
                ADD COLUMN IF NOT EXISTS ai_quality_score VARCHAR;
                """,
            ]
            
            for query in migration_queries:
                try:
                    connection.execute(text(query))
                    logger.info(f"Executed: {query.strip()}")
                except Exception as e:
                    logger.warning(f"Query already executed or failed: {e}")
            
            # Commit changes
            connection.commit()
        
        logger.info("Database migration completed successfully!")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise

if __name__ == "__main__":
    run_migration() 