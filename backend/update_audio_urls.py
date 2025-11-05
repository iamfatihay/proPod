"""
Update audio URLs for existing seed podcasts with real audio files.
"""
from app.models import Podcast
from app.database import SessionLocal
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


# Real audio files from media/audio folder
REAL_AUDIO_FILES = [
    "/media/audio/podcast_2_30873217087000.mp3",
    "/media/audio/podcast_2_436548343173200.mp3",
    "/media/audio/podcast_2_4831927909900.mp3",
    "/media/audio/podcast_2_1360749012285700.mp3",
    "/media/audio/podcast_2_1470405469080600.mp3",
]


def main():
    print("=" * 60)
    print("UPDATING PODCAST AUDIO URLS")
    print("=" * 60)

    db = SessionLocal()
    try:
        # Get all podcasts with example.com URLs
        podcasts = db.query(Podcast).filter(
            Podcast.audio_url.like('%example.com%')
        ).all()

        if not podcasts:
            print("\n[INFO] No podcasts with fake URLs found")
            return

        print(f"\nFound {len(podcasts)} podcasts with fake URLs")

        updated_count = 0
        for idx, podcast in enumerate(podcasts):
            # Cycle through real audio files
            new_audio_url = REAL_AUDIO_FILES[idx % len(REAL_AUDIO_FILES)]
            old_url = podcast.audio_url
            podcast.audio_url = new_audio_url

            print(f"  [{idx+1}/{len(podcasts)}] Updated: {podcast.title[:50]}")
            print(f"    Old: {old_url}")
            print(f"    New: {new_audio_url}")

            updated_count += 1

        db.commit()

        print(f"\n[OK] Successfully updated {updated_count} podcasts")
        print("=" * 60)

    except Exception as e:
        print(f"\n[ERROR] Update failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
