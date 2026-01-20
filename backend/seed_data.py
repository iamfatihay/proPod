"""
Seed database with sample podcast data for demo/development purposes.
Run this script to populate the database with realistic sample data.

Usage:
    python seed_data.py
"""

from app.auth import get_password_hash
from app import models
from app.database import SessionLocal, engine
import sys
import os
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


# Sample podcast data
SAMPLE_PODCASTS = [
    {
        "title": "The AI Revolution: How Machine Learning is Changing Our World",
        "description": "In this episode, we dive deep into the world of artificial intelligence and explore how machine learning is transforming industries, from healthcare to finance. Join us as we discuss the latest breakthroughs, ethical considerations, and what the future holds for AI technology.",
        "category": "Technology",
        "duration": 2845,  # ~47 minutes
        "ai_enhanced": True,
        "tags": ["AI", "Machine Learning", "Technology", "Future", "Innovation"],
        "transcript": "Welcome to our deep dive into artificial intelligence. Today we're exploring how machine learning algorithms are revolutionizing everything from medical diagnosis to financial predictions. The rapid advancement in neural networks and deep learning has opened up possibilities we never imagined just a decade ago...",
    },
    {
        "title": "Mindfulness in Modern Life: Finding Peace in Chaos",
        "description": "Discover practical mindfulness techniques that busy professionals can integrate into their daily routines. We discuss meditation, breathing exercises, and how to maintain mental clarity in our fast-paced world.",
        "category": "Health & Wellness",
        "duration": 1620,  # ~27 minutes
        "ai_enhanced": True,
        "tags": ["Mindfulness", "Meditation", "Mental Health", "Wellness", "Self-Care"],
        "transcript": "In today's episode, we focus on the importance of mindfulness and how it can transform your daily life. Studies show that just 10 minutes of meditation per day can significantly reduce stress levels and improve focus...",
    },
    {
        "title": "Startup Success Stories: From Garage to Billion Dollar Valuation",
        "description": "Hear inspiring stories from founders who turned their garage projects into billion-dollar companies. Learn about the challenges they faced, pivotal decisions, and lessons learned along the way.",
        "category": "Business",
        "duration": 3240,  # ~54 minutes
        "ai_enhanced": True,
        "tags": ["Startup", "Entrepreneurship", "Business", "Success", "Innovation"],
        "transcript": "Today we're speaking with three founders who bootstrapped their companies from zero to unicorn status. Their journey teaches us valuable lessons about persistence, product-market fit, and knowing when to pivot...",
    },
    {
        "title": "Climate Change: What Scientists Really Want You to Know",
        "description": "Leading climate scientists explain the latest research on global warming, its impacts, and what individuals and governments can do to make a difference. An essential listen for anyone concerned about our planet's future.",
        "category": "Science",
        "duration": 2560,  # ~43 minutes
        "ai_enhanced": True,
        "tags": ["Climate Change", "Environment", "Science", "Sustainability", "Future"],
        "transcript": "The scientific consensus on climate change is clear, and today we're breaking down the latest IPCC reports to understand what they mean for our future. We'll discuss carbon emissions, renewable energy solutions, and actionable steps everyone can take...",
    },
    {
        "title": "The Future of Remote Work: Trends for 2025 and Beyond",
        "description": "Explore how remote work is evolving. From virtual reality meetings to asynchronous collaboration tools, discover the technologies and practices shaping the future of work.",
        "category": "Technology",
        "duration": 1890,  # ~31 minutes
        "ai_enhanced": True,
        "tags": ["Remote Work", "Future of Work", "Technology", "Productivity", "Digital Nomad"],
        "transcript": "Remote work isn't just a trend anymore—it's the new reality for millions of professionals worldwide. Today we explore emerging technologies like VR meeting spaces, AI-powered productivity tools, and how companies are adapting their cultures...",
    },
    {
        "title": "Learning Guitar: A Beginner's Guide to Your First Song",
        "description": "Whether you're picking up a guitar for the first time or coming back after years away, this episode guides you through the basics and gets you playing your first complete song.",
        "category": "Education",
        "duration": 1440,  # ~24 minutes
        "ai_enhanced": False,
        "tags": ["Music", "Guitar", "Learning", "Beginner", "Education"],
        "transcript": "Let's start with the basics: how to hold your guitar, proper hand positioning, and the first three chords every guitarist should know. By the end of this episode, you'll be able to play a simple song...",
    },
    {
        "title": "True Crime: The Mystery of the Missing Millionaire",
        "description": "A gripping investigation into one of the most perplexing disappearances of the decade. Follow the clues, hear from investigators, and form your own theories about what really happened.",
        "category": "Entertainment",
        "duration": 2980,  # ~50 minutes
        "ai_enhanced": True,
        "tags": ["True Crime", "Mystery", "Investigation", "Documentary"],
        "transcript": "On a cold November evening in 2019, tech entrepreneur Marcus Wellington vanished without a trace. His car was found abandoned near the Golden Gate Bridge, but no body was ever discovered. Today we examine the evidence...",
    },
    {
        "title": "Cooking Like a Pro: Restaurant Techniques at Home",
        "description": "Professional chef shares insider techniques that will elevate your home cooking. Learn about mise en place, proper knife skills, and how to build complex flavors.",
        "category": "Food & Drink",
        "duration": 2110,  # ~35 minutes
        "ai_enhanced": True,
        "tags": ["Cooking", "Food", "Chef", "Techniques", "Culinary"],
        "transcript": "Today we're bringing restaurant-quality cooking into your home kitchen. First, let's talk about organization—what chefs call mise en place. Having everything prepped and ready transforms the cooking experience...",
    },
]

# Sample user credentials (for demo only - change in production)
DEMO_USER = {
    "email": "demo@volo.com",
    "name": "Demo User",
    "password": "demo123",  # This will be hashed
    "role": "super_admin"  # Make demo user super admin for testing
}


def create_demo_user(db: Session) -> models.User:
    """Create or get demo user."""
    user = db.query(models.User).filter(
        models.User.email == DEMO_USER["email"]).first()

    if not user:
        print(f"Creating demo user: {DEMO_USER['email']} (role: {DEMO_USER['role']})")
        user = models.User(
            email=DEMO_USER["email"],
            name=DEMO_USER["name"],
            hashed_password=get_password_hash(DEMO_USER["password"]),
            role=models.UserRole.SUPER_ADMIN,  # Super admin role
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"[OK] Demo user created with ID: {user.id}")
    else:
        print(f"Demo user already exists with ID: {user.id}")

    return user


def seed_podcasts(db: Session, owner: models.User):
    """Seed database with sample podcasts."""
    print(f"\nSeeding {len(SAMPLE_PODCASTS)} sample podcasts...")

    created_count = 0

    for idx, podcast_data in enumerate(SAMPLE_PODCASTS, 1):
        # Check if podcast already exists (by title)
        existing = db.query(models.Podcast).filter(
            models.Podcast.title == podcast_data["title"]
        ).first()

        if existing:
            print(
                f"  [{idx}/{len(SAMPLE_PODCASTS)}] Skipping (already exists): {podcast_data['title'][:50]}...")
            continue

        # Create podcast
        # Use demo online audio files (free to use)
        demo_audio_files = [
            "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
            "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
            "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
            "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
        ]
        # Cycle through demo audio files
        audio_url = demo_audio_files[(idx - 1) % len(demo_audio_files)]

        podcast = models.Podcast(
            title=podcast_data["title"],
            description=podcast_data["description"],
            category=podcast_data["category"],
            duration=podcast_data["duration"],
            audio_url=audio_url,  # Use real audio files
            # Random image
            thumbnail_url=f"https://picsum.photos/seed/{idx}/400/400",
            owner_id=owner.id,
            ai_enhanced=podcast_data["ai_enhanced"],
            created_at=datetime.utcnow() - timedelta(days=len(SAMPLE_PODCASTS) - idx),
        )

        db.add(podcast)
        db.commit()
        db.refresh(podcast)
        created_count += 1
        print(
            f"  [{idx}/{len(SAMPLE_PODCASTS)}] Created: {podcast_data['title'][:50]}...")

    print(f"\n[OK] Successfully created {created_count} new podcasts")
    print(f"Total podcasts in database: {db.query(models.Podcast).count()}")


def clear_existing_data(db: Session):
    """Clear existing seed data (optional)."""
    print("\n[WARNING] Clearing existing demo data...")

    # Delete all podcasts owned by demo user
    demo_user = db.query(models.User).filter(
        models.User.email == DEMO_USER["email"]).first()
    if demo_user:
        deleted = db.query(models.Podcast).filter(
            models.Podcast.owner_id == demo_user.id).delete()
        db.commit()
        print(f"   Deleted {deleted} podcasts")


def main():
    """Main seed function."""
    print("=" * 60)
    print("VOLO PODCAST APP - DATABASE SEEDING")
    print("=" * 60)

    db = SessionLocal()

    try:
        # Option to clear existing data (auto-skip for non-interactive)
        # response = input("\n❓ Clear existing demo data first? (y/N): ").lower()
        # if response == 'y':
        #     clear_existing_data(db)

        # Create demo user
        demo_user = create_demo_user(db)

        # Seed podcasts
        seed_podcasts(db, demo_user)

        print("\n" + "=" * 60)
        print("[OK] SEEDING COMPLETED SUCCESSFULLY")
        print("=" * 60)
        print(f"\nDemo credentials:")
        print(f"   Email: {DEMO_USER['email']}")
        print(f"   Password: {DEMO_USER['password']}")
        print("\nYou can now log in with these credentials to see sample data!")

    except Exception as e:
        print(f"\n[ERROR] Error during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
