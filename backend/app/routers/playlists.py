"""Playlist management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session
from typing import List, Optional

from .. import schemas, crud, models, auth
from ..database import get_db

router = APIRouter(prefix="/playlists", tags=["playlists"])


@router.post("/", response_model=schemas.PlaylistResponse, status_code=status.HTTP_201_CREATED)
def create_playlist(
    playlist: schemas.PlaylistCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Create a new playlist."""
    db_playlist = crud.create_playlist(db=db, playlist=playlist, owner_id=current_user.id)
    return _playlist_to_response(db_playlist)


@router.get("/my", response_model=schemas.PlaylistListResponse)
def get_my_playlists(
    skip: int = Query(0, ge=0, description="Number of playlists to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of playlists to return"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Get the current user's playlists."""
    rows, total = crud.get_user_playlists(
        db=db, user_id=current_user.id, skip=skip, limit=limit,
    )
    return schemas.PlaylistListResponse(
        playlists=[_playlist_to_response(p, count, thumbs) for p, count, thumbs in rows],
        total=total,
        limit=limit,
        offset=skip,
        has_more=total > skip + limit,
    )


@router.get("/public", response_model=schemas.PlaylistListResponse)
def get_public_playlists(
    skip: int = Query(0, ge=0, description="Number of playlists to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of playlists to return"),
    db: Session = Depends(get_db),
):
    """Get all public playlists."""
    rows, total = crud.get_public_playlists(db=db, skip=skip, limit=limit)
    return schemas.PlaylistListResponse(
        playlists=[_playlist_to_response(p, count, thumbs, owner_name) for p, count, thumbs, owner_name in rows],
        total=total,
        limit=limit,
        offset=skip,
        has_more=total > skip + limit,
    )


@router.get("/{playlist_id}", response_model=schemas.PlaylistDetailResponse)
def get_playlist(
    playlist_id: int = Path(..., description="The ID of the playlist"),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional),
):
    """
    Get a playlist by ID with its items.

    Public playlists are accessible to everyone.
    Private playlists are only accessible to their owner.
    """
    playlist = crud.get_playlist(db=db, playlist_id=playlist_id)
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found",
        )

    # Access control: private playlists are owner-only
    if not playlist.is_public:
        if not current_user or playlist.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this playlist",
            )

    # Build response with enriched podcast data
    # Non-owners should only see public podcasts within the playlist
    is_owner = current_user and playlist.owner_id == current_user.id
    items = []
    for item in playlist.items:
        podcast = item.podcast
        if podcast and not podcast.is_deleted and (is_owner or podcast.is_public):
            crud.enrich_podcast_with_stats(podcast)
            items.append(schemas.PlaylistItemResponse(
                id=item.id,
                podcast_id=item.podcast_id,
                position=item.position,
                added_at=item.added_at,
                podcast=podcast,
            ))

    return schemas.PlaylistDetailResponse(
        id=playlist.id,
        name=playlist.name,
        description=playlist.description,
        is_public=playlist.is_public,
        owner_id=playlist.owner_id,
        item_count=len(items),
        created_at=playlist.created_at,
        updated_at=playlist.updated_at,
        items=items,
    )


@router.put("/{playlist_id}", response_model=schemas.PlaylistResponse)
def update_playlist(
    playlist_id: int = Path(..., description="The ID of the playlist to update"),
    playlist_update: schemas.PlaylistUpdate = ...,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Update a playlist (owner only)."""
    playlist = crud.get_playlist(db=db, playlist_id=playlist_id)
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found",
        )

    if playlist.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this playlist",
        )

    updated = crud.update_playlist(db=db, playlist=playlist, playlist_update=playlist_update)
    return _playlist_to_response(updated)


@router.delete("/{playlist_id}", response_model=schemas.SuccessMessage)
def delete_playlist(
    playlist_id: int = Path(..., description="The ID of the playlist to delete"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Delete a playlist (owner only)."""
    playlist = crud.get_playlist(db=db, playlist_id=playlist_id)
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found",
        )

    if playlist.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this playlist",
        )

    crud.delete_playlist(db=db, playlist=playlist)
    return schemas.SuccessMessage(message="Playlist deleted successfully")


@router.post("/{playlist_id}/items", response_model=schemas.PlaylistItemResponse,
             status_code=status.HTTP_201_CREATED)
def add_item_to_playlist(
    playlist_id: int = Path(..., description="The ID of the playlist"),
    item: schemas.PlaylistItemAdd = ...,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Add a podcast to a playlist (owner only)."""
    playlist = crud.get_playlist(db=db, playlist_id=playlist_id)
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found",
        )

    if playlist.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this playlist",
        )

    # Verify podcast exists and is not deleted
    podcast = crud.get_podcast(db=db, podcast_id=item.podcast_id, increment_play_count=False)
    if not podcast:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Podcast not found",
        )

    playlist_item = crud.add_podcast_to_playlist(
        db=db, playlist_id=playlist_id, podcast_id=item.podcast_id,
    )
    return schemas.PlaylistItemResponse(
        id=playlist_item.id,
        podcast_id=playlist_item.podcast_id,
        position=playlist_item.position,
        added_at=playlist_item.added_at,
    )


@router.delete("/{playlist_id}/items/{podcast_id}", response_model=schemas.SuccessMessage)
def remove_item_from_playlist(
    playlist_id: int = Path(..., description="The ID of the playlist"),
    podcast_id: int = Path(..., description="The ID of the podcast to remove"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Remove a podcast from a playlist (owner only)."""
    playlist = crud.get_playlist(db=db, playlist_id=playlist_id)
    if not playlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist not found",
        )

    if playlist.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this playlist",
        )

    crud.remove_podcast_from_playlist(db=db, playlist_id=playlist_id, podcast_id=podcast_id)
    return schemas.SuccessMessage(message="Podcast removed from playlist")


def _playlist_to_response(
    playlist: models.Playlist,
    item_count: Optional[int] = None,
    preview_thumbnails: Optional[List[str]] = None,
    owner_name: Optional[str] = None,
) -> schemas.PlaylistResponse:
    """Convert a Playlist model to a PlaylistResponse schema.

    Pass ``item_count`` explicitly when building responses from a list query
    that does not eager-load items, to avoid triggering a lazy SELECT per row.
    Pass ``preview_thumbnails`` (up to 4 URLs) for the mosaic art in list views.
    Pass ``owner_name`` to surface the creator display name on public listing cards.
    """
    if item_count is None:
        # items are already in identity map (e.g. detail view); safe to use
        item_count = len(playlist.items) if playlist.items is not None else 0
    return schemas.PlaylistResponse(
        id=playlist.id,
        name=playlist.name,
        description=playlist.description,
        is_public=playlist.is_public,
        owner_id=playlist.owner_id,
        owner_name=owner_name,
        item_count=item_count,
        preview_thumbnails=preview_thumbnails or [],
        created_at=playlist.created_at,
        updated_at=playlist.updated_at,
    )
