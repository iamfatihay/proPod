"""
Migration script to move podcast AI data and stats to separate tables.

This script:
1. Creates new podcast_ai_data and podcast_stats tables
2. Migrates existing AI data from podcasts table
3. Migrates existing stats from podcasts table
4. Preserves all existing data

Run this after updating models.py but before dropping old columns.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.database import DATABASE_URL
from app import models

# Create engine and session
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def migrate_data():
    """Migrate existing podcast data to new tables."""
    db = SessionLocal()
    
    try:
        print("🚀 Starting migration...")
        
        # 1. Create new tables
        print("📊 Creating new tables (podcast_ai_data, podcast_stats)...")
        models.Base.metadata.create_all(bind=engine)
        print("✅ Tables created!")
        
        # 2. Check if old columns exist
        print("\n🔍 Checking for old data columns...")
        result = db.execute(text("PRAGMA table_info(podcasts)"))
        columns = [row[1] for row in result.fetchall()]
        
        has_old_columns = 'play_count' in columns and 'transcription_text' in columns
        
        if not has_old_columns:
            print("✅ Already migrated! Old columns not found.")
            print("📊 Initializing stats for existing podcasts without stats...")
            
            # Initialize stats for podcasts that don't have them
            podcasts_without_stats = db.query(models.Podcast).outerjoin(
                models.PodcastStats
            ).filter(models.PodcastStats.id == None).all()
            
            for podcast in podcasts_without_stats:
                stats = models.PodcastStats(
                    podcast_id=podcast.id,
                    play_count=0,
                    like_count=len(podcast.likes),
                    bookmark_count=len(podcast.bookmarks),
                    comment_count=len(podcast.comments)
                )
                db.add(stats)
            
            if podcasts_without_stats:
                db.commit()
                print(f"✅ Initialized stats for {len(podcasts_without_stats)} podcasts")
            
            return
        
        # 3. Get all podcasts
        print(f"\n📚 Found old columns. Fetching podcasts...")
        result = db.execute(text("""
            SELECT id, play_count, like_count, bookmark_count,
                   transcription_text, transcription_language, transcription_confidence,
                   ai_keywords, ai_summary, ai_sentiment, ai_categories,
                   ai_processing_status, ai_processing_date, ai_quality_score
            FROM podcasts
        """))
        podcasts = result.fetchall()
        print(f"📚 Found {len(podcasts)} podcasts to migrate")
        
        # 4. Migrate stats
        print("\n📊 Migrating podcast stats...")
        stats_migrated = 0
        for podcast in podcasts:
            existing_stats = db.query(models.PodcastStats).filter(
                models.PodcastStats.podcast_id == podcast[0]
            ).first()
            
            if not existing_stats:
                stats = models.PodcastStats(
                    podcast_id=podcast[0],
                    play_count=podcast[1] or 0,
                    like_count=podcast[2] or 0,
                    bookmark_count=podcast[3] or 0,
                    comment_count=0  # Will be calculated later
                )
                db.add(stats)
                stats_migrated += 1
        
        db.commit()
        print(f"✅ Migrated {stats_migrated} podcast stats")
        
        # 5. Migrate AI data (only if exists)
        print("\n🤖 Migrating AI data...")
        ai_migrated = 0
        for podcast in podcasts:
            # Only create AI data if there's actual AI content
            has_ai_data = any([
                podcast[4],  # transcription_text
                podcast[7],  # ai_keywords
                podcast[8],  # ai_summary
            ])
            
            if has_ai_data:
                existing_ai = db.query(models.PodcastAIData).filter(
                    models.PodcastAIData.podcast_id == podcast[0]
                ).first()
                
                if not existing_ai:
                    ai_data = models.PodcastAIData(
                        podcast_id=podcast[0],
                        transcription_text=podcast[4],
                        transcription_language=podcast[5],
                        transcription_confidence=podcast[6],
                        keywords=podcast[7],
                        summary=podcast[8],
                        sentiment=podcast[9],
                        categories=podcast[10],
                        processing_status=podcast[11] or "pending",
                        processing_date=podcast[12],
                        quality_score=podcast[13]
                    )
                    db.add(ai_data)
                    ai_migrated += 1
        
        db.commit()
        print(f"✅ Migrated {ai_migrated} AI data records")
        
        # 6. Update comment counts
        print("\n💬 Calculating comment counts...")
        result = db.execute(text("""
            SELECT podcast_id, COUNT(*) as count
            FROM podcast_comments
            WHERE is_active = 1
            GROUP BY podcast_id
        """))
        
        for row in result.fetchall():
            db.execute(text("""
                UPDATE podcast_stats
                SET comment_count = :count
                WHERE podcast_id = :podcast_id
            """), {"count": row[1], "podcast_id": row[0]})
        
        db.commit()
        print("✅ Comment counts updated")
        
        print("\n" + "="*50)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
        print("="*50)
        print(f"📊 Stats migrated: {stats_migrated}")
        print(f"🤖 AI data migrated: {ai_migrated}")
        print("\n⚠️  IMPORTANT NEXT STEPS:")
        print("1. Test the application thoroughly")
        print("2. Verify all podcast data is accessible")
        print("3. Only after verification, you can manually drop old columns")
        print("   (SQLite doesn't support DROP COLUMN easily)")
        
    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_data()
