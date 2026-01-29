"""Add is_premium field to users table."""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.config import settings

def add_is_premium_field():
    """Add is_premium column to users table if it doesn't exist."""
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        try:
            # Try to add the column (will fail silently if exists)
            conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN is_premium BOOLEAN DEFAULT FALSE
            """))
            conn.commit()
            print("✅ Added is_premium column to users table")
        except Exception as e:
            if "duplicate column" in str(e).lower():
                print("ℹ️  is_premium column already exists")
            else:
                print(f"❌ Error: {e}")
                raise

if __name__ == "__main__":
    add_is_premium_field()
