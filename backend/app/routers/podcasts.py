from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import schemas, crud
from ..database import SessionLocal

router = APIRouter(prefix="/podcasts", tags=["podcasts"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/create", response_model=schemas.Podcast)
def create_podcast(podcast: schemas.PodcastCreate, user_id: int, db: Session = Depends(get_db)):
    return crud.create_podcast(db, podcast, user_id)
