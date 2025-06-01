from pydantic import BaseModel, EmailStr
from typing import Optional, List
import datetime


class PodcastBase(BaseModel):
    title: str
    description: Optional[str] = None


class PodcastCreate(PodcastBase):
    pass


class Podcast(PodcastBase):
    id: int
    audio_url: Optional[str] = None
    created_at: datetime.datetime
    owner_id: int

    class Config:
        orm_mode = True


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str


class User(UserBase):
    id: int
    created_at: datetime.datetime
    podcasts: List[Podcast] = []

    class Config:
        orm_mode = True
