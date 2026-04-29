"""Direct messaging endpoints — 1-on-1 conversations between users."""
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("/", response_model=schemas.DirectMessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    payload: schemas.DirectMessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Send a direct message to another user.

    - Rejects messages to self.
    - Rejects messages to non-existent users.
    - `body` must be 1–2 000 characters.
    """
    if payload.recipient_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot send a message to yourself",
        )

    recipient = db.query(models.User).filter(
        models.User.id == payload.recipient_id,
        models.User.is_active == True,
    ).first()
    if recipient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found",
        )

    msg = crud.send_direct_message(
        db=db,
        sender_id=current_user.id,
        recipient_id=payload.recipient_id,
        body=payload.body,
    )

    # Attach convenience name fields for the response
    msg.sender_name = current_user.name
    msg.sender_photo_url = current_user.photo_url
    msg.recipient_name = recipient.name
    msg.recipient_photo_url = recipient.photo_url

    return msg


@router.get("/inbox", response_model=schemas.DMInboxResponse)
def get_inbox(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Return the DM inbox for the authenticated user.

    One thread entry per conversation partner, showing the most recent
    message and unread count, sorted by most-recent message first.
    """
    threads = crud.get_dm_inbox(db=db, user_id=current_user.id)
    return schemas.DMInboxResponse(threads=threads, total=len(threads))



@router.get("/unread-count", response_model=schemas.DMUnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Return the total number of unread direct messages for the authenticated user.

    Cheaper than fetching the full inbox — used by the frontend to poll and
    update the tab-bar badge without loading all thread data.
    """
    total = crud.get_total_unread_dm_count(db=db, user_id=current_user.id)
    return schemas.DMUnreadCountResponse(total_unread=total)


@router.get("/{partner_id}", response_model=schemas.ConversationResponse)
def get_conversation(
    partner_id: int = Path(..., description="ID of the conversation partner"),
    skip: int = Query(0, ge=0, description="Number of messages to skip (pagination)"),
    limit: int = Query(50, ge=1, le=100, description="Max messages to return"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Fetch the full conversation thread between the current user and a partner.

    Messages are returned newest-first so the client can easily append
    older messages when the user scrolls up.

    Also marks all unread messages from the partner as read.
    """
    partner = db.query(models.User).filter(
        models.User.id == partner_id,
        models.User.is_active == True,
    ).first()
    if partner is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Mark messages from partner as read
    crud.mark_conversation_read(
        db=db,
        reader_id=current_user.id,
        partner_id=partner_id,
    )

    messages, total = crud.get_conversation(
        db=db,
        user_a_id=current_user.id,
        user_b_id=partner_id,
        skip=skip,
        limit=limit,
    )
    return schemas.ConversationResponse(
        messages=messages,
        total=total,
        limit=limit,
        offset=skip,
        has_more=total > skip + limit,
    )
