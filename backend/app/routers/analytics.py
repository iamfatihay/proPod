"""Creator analytics dashboard endpoints.

Provides aggregate statistics across all of a creator's podcasts,
including top-performing content, category breakdowns, and engagement metrics.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, case
from typing import List, Literal
import datetime
from datetime import timezone

from .. import schemas, models, auth
from ..database import get_db

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
def get_creator_dashboard(
    days: int = Query(
        30, ge=1, le=365,
        description="Number of days to look back for recent engagement metrics (likes, bookmarks, comments)",
    ),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Get the full creator analytics dashboard.

    Returns aggregate stats, top podcasts, recent engagement trends,
    and category distribution for all non-deleted podcasts owned by
    the authenticated user.
    """
    user_id = current_user.id
    cutoff = datetime.datetime.now(timezone.utc) - datetime.timedelta(days=days)

    # ---- 1. Podcast IDs subquery (avoids materialising IDs into Python) ----
    base_filter = [
        models.Podcast.owner_id == user_id,
        models.Podcast.is_deleted == False,
    ]
    podcast_ids_subq = db.query(models.Podcast.id).filter(*base_filter).scalar_subquery()
    total_podcasts = db.query(models.Podcast.id).filter(*base_filter).count()

    if total_podcasts == 0:
        return {
            "total_podcasts": 0,
            "total_plays": 0,
            "total_likes": 0,
            "total_bookmarks": 0,
            "total_comments": 0,
            "average_completion_rate": 0.0,
            "top_podcasts": [],
            "recent_likes": 0,
            "recent_bookmarks": 0,
            "recent_comments": 0,
            "category_distribution": [],
            "days": days,
        }

    # ---- 2. Aggregate stats from PodcastStats ----
    agg = (
        db.query(
            func.coalesce(func.sum(models.PodcastStats.play_count), 0).label("plays"),
            func.coalesce(func.sum(models.PodcastStats.like_count), 0).label("likes"),
            func.coalesce(func.sum(models.PodcastStats.bookmark_count), 0).label("bookmarks"),
            func.coalesce(func.sum(models.PodcastStats.comment_count), 0).label("comments"),
        )
        .join(models.Podcast, models.PodcastStats.podcast_id == models.Podcast.id)
        .filter(*base_filter)
        .first()
    )

    total_plays = int(agg.plays) if agg else 0
    total_likes = int(agg.likes) if agg else 0
    total_bookmarks = int(agg.bookmarks) if agg else 0
    total_comments = int(agg.comments) if agg else 0

    # ---- 3. Average completion rate from listening history ----
    history_agg = (
        db.query(
            func.count(models.ListeningHistory.id).label("total"),
            func.count(
                case((models.ListeningHistory.completed == True, 1))
            ).label("completed"),
        )
        .filter(models.ListeningHistory.podcast_id.in_(podcast_ids_subq))
        .first()
    )

    total_listens = int(history_agg.total) if history_agg and history_agg.total else 0
    completed_listens = int(history_agg.completed) if history_agg and history_agg.completed else 0
    avg_completion = round((completed_listens / total_listens) * 100, 1) if total_listens > 0 else 0.0

    # ---- 4. Top 5 podcasts by play count ----
    top_podcasts_q = (
        db.query(
            models.Podcast.id,
            models.Podcast.title,
            models.Podcast.category,
            models.Podcast.created_at,
            func.coalesce(models.PodcastStats.play_count, 0).label("play_count"),
            func.coalesce(models.PodcastStats.like_count, 0).label("like_count"),
            func.coalesce(models.PodcastStats.bookmark_count, 0).label("bookmark_count"),
        )
        .outerjoin(models.PodcastStats, models.PodcastStats.podcast_id == models.Podcast.id)
        .filter(*base_filter)
        .order_by(desc(func.coalesce(models.PodcastStats.play_count, 0)))
        .limit(5)
        .all()
    )

    top_podcasts = [
        {
            "id": row.id,
            "title": row.title,
            "category": row.category,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "play_count": row.play_count,
            "like_count": row.like_count,
            "bookmark_count": row.bookmark_count,
        }
        for row in top_podcasts_q
    ]

    # ---- 5. Recent engagement within the time window ----
    recent_likes = (
        db.query(func.count(models.PodcastLike.id))
        .filter(
            models.PodcastLike.podcast_id.in_(podcast_ids_subq),
            models.PodcastLike.created_at >= cutoff,
        )
        .scalar()
    ) or 0

    recent_bookmarks = (
        db.query(func.count(models.PodcastBookmark.id))
        .filter(
            models.PodcastBookmark.podcast_id.in_(podcast_ids_subq),
            models.PodcastBookmark.created_at >= cutoff,
        )
        .scalar()
    ) or 0

    recent_comments = (
        db.query(func.count(models.PodcastComment.id))
        .filter(
            models.PodcastComment.podcast_id.in_(podcast_ids_subq),
            models.PodcastComment.is_active == True,
            models.PodcastComment.created_at >= cutoff,
        )
        .scalar()
    ) or 0

    # ---- 6. Category distribution ----
    podcast_count_col = func.count(models.Podcast.id).label("count")
    category_dist = (
        db.query(
            models.Podcast.category,
            podcast_count_col,
        )
        .filter(*base_filter)
        .group_by(models.Podcast.category)
        .order_by(desc(podcast_count_col))
        .all()
    )

    category_distribution = [
        {"category": row.category, "count": row.count}
        for row in category_dist
    ]

    return {
        "total_podcasts": total_podcasts,
        "total_plays": total_plays,
        "total_likes": total_likes,
        "total_bookmarks": total_bookmarks,
        "total_comments": total_comments,
        "average_completion_rate": avg_completion,
        "top_podcasts": top_podcasts,
        "recent_likes": recent_likes,
        "recent_bookmarks": recent_bookmarks,
        "recent_comments": recent_comments,
        "category_distribution": category_distribution,
        "days": days,
    }


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
    sort_by: Literal["plays", "likes", "bookmarks"] = Query(
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

    plays_expr = func.coalesce(func.sum(models.PodcastStats.play_count), 0).label("plays")

    rows = (
        db.query(
            models.Podcast.category,
            func.count(models.Podcast.id).label("podcast_count"),
            plays_expr,
            func.coalesce(func.sum(models.PodcastStats.like_count), 0).label("likes"),
            func.coalesce(func.sum(models.PodcastStats.bookmark_count), 0).label("bookmarks"),
        )
        .outerjoin(models.PodcastStats, models.PodcastStats.podcast_id == models.Podcast.id)
        .filter(
            models.Podcast.owner_id == owner_id,
            models.Podcast.is_deleted == False,
        )
        .group_by(models.Podcast.category)
        .order_by(desc(plays_expr))
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


@router.get("/plays-over-time")
def get_plays_over_time(
    days: int = Query(
        30, ge=7, le=365,
        description="Number of days to look back (7–365)",
    ),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Return daily listening-session counts for the creator's podcasts.

    Each data point represents the number of unique user-podcast listening
    sessions that were active (created or updated) on that calendar day.
    Uses ListeningHistory.updated_at so that returning listeners count
    toward the day they most recently played, not just first-play.

    Works with both SQLite (func.date) and PostgreSQL (DATE cast).

    The response always contains exactly ``days`` data points: one for every
    calendar day in the window (oldest → today, UTC). Days with no listening
    activity are represented as ``{"date": ..., "plays": 0}``. This guarantees
    the frontend chart spans the full selected range without compressing gaps.
    The cutoff is anchored to start-of-day (midnight UTC) so the oldest day is
    always fully included regardless of the current time.
    """
    # Anchor to midnight UTC so every calendar day in the window is fully
    # included, regardless of the current time of day.
    today = datetime.datetime.now(timezone.utc).date()
    start_date = today - datetime.timedelta(days=days - 1)
    cutoff = datetime.datetime(
        start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc
    )

    podcast_ids_subq = (
        db.query(models.Podcast.id)
        .filter(
            models.Podcast.owner_id == current_user.id,
            models.Podcast.is_deleted == False,
        )
        .scalar_subquery()
    )

    rows = (
        db.query(
            func.date(models.ListeningHistory.updated_at).label("day"),
            func.count(models.ListeningHistory.id).label("plays"),
        )
        .filter(
            models.ListeningHistory.podcast_id.in_(podcast_ids_subq),
            models.ListeningHistory.updated_at >= cutoff,
        )
        .group_by(func.date(models.ListeningHistory.updated_at))
        .order_by(func.date(models.ListeningHistory.updated_at))
        .all()
    )

    # Build a sparse {date -> plays} map and project it onto the contiguous
    # day range so days with no activity show up as zero.
    plays_by_day = {str(r.day): int(r.plays) for r in rows}
    data = [
        {
            "date": (start_date + datetime.timedelta(days=i)).isoformat(),
            "plays": plays_by_day.get(
                (start_date + datetime.timedelta(days=i)).isoformat(), 0
            ),
        }
        for i in range(days)
    ]

    return {
        "data": data,
        "days": days,
    }
