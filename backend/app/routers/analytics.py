"""Creator analytics dashboard endpoints.

Provides aggregate statistics across all of a creator's podcasts,
including top-performing content, category breakdowns, and engagement metrics.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, case
from typing import List

from .. import schemas, models, auth
from ..database import get_db

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=schemas.CreatorDashboardResponse)
def get_creator_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Get the full creator analytics dashboard.

    Returns aggregate stats, top podcasts, and category breakdown
    for all non-deleted podcasts owned by the authenticated user.
    """
    stats = _get_aggregate_stats(db, current_user.id)
    top_podcasts = _get_top_podcasts(db, current_user.id, limit=5)
    category_breakdown = _get_category_breakdown(db, current_user.id)

    return schemas.CreatorDashboardResponse(
        stats=stats,
        top_podcasts=top_podcasts,
        category_breakdown=category_breakdown,
    )


@router.get("/stats", response_model=schemas.CreatorDashboardStats)
def get_creator_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Get aggregate statistics for the authenticated creator."""
    return _get_aggregate_stats(db, current_user.id)


@router.get("/top-podcasts", response_model=List[schemas.TopPodcastStats])
def get_top_podcasts(
    limit: int = Query(5, ge=1, le=20, description="Number of top podcasts to return"),
    sort_by: str = Query(
        "plays",
        description="Sort metric: plays, likes, or bookmarks",
    ),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Get creator's top-performing podcasts sorted by the chosen metric."""
    return _get_top_podcasts(db, current_user.id, limit=limit, sort_by=sort_by)


@router.get("/categories", response_model=List[schemas.CategoryStats])
def get_category_breakdown(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Get statistics broken down by podcast category."""
    return _get_category_breakdown(db, current_user.id)


# ==================== Private helpers ====================


def _get_aggregate_stats(db: Session, owner_id: int) -> schemas.CreatorDashboardStats:
    """Build aggregate stats across all of a creator's non-deleted podcasts."""

    # Base filter: non-deleted podcasts owned by this user
    base_filter = [
        models.Podcast.owner_id == owner_id,
        models.Podcast.is_deleted == False,
    ]

    # Total podcast count and AI-enhanced count
    podcast_counts = db.query(
        func.count(models.Podcast.id).label("total"),
        func.count(
            case((models.Podcast.ai_enhanced == True, 1))
        ).label("ai_count"),
    ).filter(*base_filter).first()

    total_podcasts = podcast_counts.total if podcast_counts else 0
    podcasts_with_ai = podcast_counts.ai_count if podcast_counts else 0

    if total_podcasts == 0:
        return schemas.CreatorDashboardStats()

    # Aggregate stats from PodcastStats (joined via podcast_id)
    engagement = db.query(
        func.coalesce(func.sum(models.PodcastStats.play_count), 0).label("plays"),
        func.coalesce(func.sum(models.PodcastStats.like_count), 0).label("likes"),
        func.coalesce(func.sum(models.PodcastStats.bookmark_count), 0).label("bookmarks"),
        func.coalesce(func.sum(models.PodcastStats.comment_count), 0).label("comments"),
    ).join(
        models.Podcast, models.PodcastStats.podcast_id == models.Podcast.id
    ).filter(*base_filter).first()

    # Listening history stats
    podcast_ids_subq = db.query(models.Podcast.id).filter(*base_filter).scalar_subquery()

    history = db.query(
        func.coalesce(func.sum(models.ListeningHistory.listen_time), 0).label("listen_time"),
        func.count(models.ListeningHistory.id).label("total_entries"),
        func.count(
            case((models.ListeningHistory.completed == True, 1))
        ).label("completed"),
    ).filter(
        models.ListeningHistory.podcast_id.in_(podcast_ids_subq)
    ).first()

    total_entries = history.total_entries if history else 0
    completed = history.completed if history else 0
    avg_completion = (completed / total_entries * 100) if total_entries > 0 else 0.0

    return schemas.CreatorDashboardStats(
        total_podcasts=total_podcasts,
        total_plays=engagement.plays if engagement else 0,
        total_likes=engagement.likes if engagement else 0,
        total_bookmarks=engagement.bookmarks if engagement else 0,
        total_comments=engagement.comments if engagement else 0,
        total_listen_time_seconds=history.listen_time if history else 0,
        average_completion_rate=round(avg_completion, 2),
        podcasts_with_ai=podcasts_with_ai,
    )


def _get_top_podcasts(
    db: Session,
    owner_id: int,
    limit: int = 5,
    sort_by: str = "plays",
) -> List[schemas.TopPodcastStats]:
    """Return the creator's top podcasts sorted by the requested metric."""

    sort_column_map = {
        "plays": models.PodcastStats.play_count,
        "likes": models.PodcastStats.like_count,
        "bookmarks": models.PodcastStats.bookmark_count,
    }
    sort_col = sort_column_map.get(sort_by, models.PodcastStats.play_count)

    rows = (
        db.query(
            models.Podcast.id,
            models.Podcast.title,
            models.Podcast.category,
            models.Podcast.created_at,
            func.coalesce(models.PodcastStats.play_count, 0).label("play_count"),
            func.coalesce(models.PodcastStats.like_count, 0).label("like_count"),
            func.coalesce(models.PodcastStats.bookmark_count, 0).label("bookmark_count"),
            func.coalesce(models.PodcastStats.comment_count, 0).label("comment_count"),
        )
        .outerjoin(models.PodcastStats, models.PodcastStats.podcast_id == models.Podcast.id)
        .filter(
            models.Podcast.owner_id == owner_id,
            models.Podcast.is_deleted == False,
        )
        .order_by(desc(func.coalesce(sort_col, 0)))
        .limit(limit)
        .all()
    )

    return [
        schemas.TopPodcastStats(
            id=r.id,
            title=r.title,
            category=r.category,
            play_count=r.play_count,
            like_count=r.like_count,
            bookmark_count=r.bookmark_count,
            comment_count=r.comment_count,
            created_at=r.created_at,
        )
        for r in rows
    ]


def _get_category_breakdown(db: Session, owner_id: int) -> List[schemas.CategoryStats]:
    """Return per-category aggregates for a creator's podcasts."""

    rows = (
        db.query(
            models.Podcast.category,
            func.count(models.Podcast.id).label("podcast_count"),
            func.coalesce(func.sum(models.PodcastStats.play_count), 0).label("plays"),
            func.coalesce(func.sum(models.PodcastStats.like_count), 0).label("likes"),
            func.coalesce(func.sum(models.PodcastStats.bookmark_count), 0).label("bookmarks"),
        )
        .outerjoin(models.PodcastStats, models.PodcastStats.podcast_id == models.Podcast.id)
        .filter(
            models.Podcast.owner_id == owner_id,
            models.Podcast.is_deleted == False,
        )
        .group_by(models.Podcast.category)
        .order_by(desc("plays"))
        .all()
    )

    return [
        schemas.CategoryStats(
            category=r.category,
            podcast_count=r.podcast_count,
            total_plays=r.plays,
            total_likes=r.likes,
            total_bookmarks=r.bookmarks,
        )
        for r in rows
    ]
