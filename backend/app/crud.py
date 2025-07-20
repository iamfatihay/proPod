from sqlalchemy.orm import Session
from . import models, schemas
from passlib.context import CryptContext
from fastapi import HTTPException
import secrets
import datetime
from datetime import timezone

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def get_user_by_reset_token(db: Session, token: str):
    """Get user by reset token if token is valid and not expired"""
    return db.query(models.User).filter(
        models.User.reset_token == token,
        models.User.reset_token_expires > datetime.datetime.now(timezone.utc)
    ).first()


def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = pwd_context.hash(user.password)
    db_user = models.User(
        email=user.email, name=user.name, hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user: models.User, update: schemas.UserBase):
    user.name = update.name
    user.photo_url = update.photo_url
    db.commit()
    db.refresh(user)
    return user


def set_reset_token(db: Session, user: models.User):
    """Generate and set reset token for user"""
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires = datetime.datetime.now(timezone.utc) + datetime.timedelta(hours=1)
    db.commit()
    db.refresh(user)
    return token


def reset_user_password(db: Session, user: models.User, new_password: str):
    """Reset user password and clear reset token"""
    user.hashed_password = pwd_context.hash(new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    db.refresh(user)
    return user


def change_user_password(db: Session, user: models.User, old_password: str, new_password: str):
    if not pwd_context.verify(old_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Old password is incorrect")
    user.hashed_password = pwd_context.hash(new_password)
    db.commit()
    db.refresh(user)
    return user


def soft_delete_user(db: Session, user: models.User):
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


def create_podcast(db: Session, podcast: schemas.PodcastCreate, user_id: int):
    db_podcast = models.Podcast(**podcast.dict(), owner_id=user_id)
    db.add(db_podcast)
    db.commit()
    db.refresh(db_podcast)
    return db_podcast
