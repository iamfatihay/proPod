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
    name: str
    provider: Optional[str] = "local"
    photo_url: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class User(UserBase):
    id: int
    is_active: bool = True
    created_at: datetime.datetime
    podcasts: List[Podcast] = []

    model_config = {'from_attributes': True}


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
