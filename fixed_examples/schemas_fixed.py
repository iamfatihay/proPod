"""
FIXED VERSION: backend/app/schemas.py
This file includes the password validation fix for local users.
Apply these changes to PR #1's backend/app/schemas.py
"""

from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field, field_validator
import datetime
from typing import Optional, List, TYPE_CHECKING

if TYPE_CHECKING:
    from .models import User


# ==================== User Schemas ====================

class UserBase(BaseModel):
    """Base user schema with common fields."""
    email: EmailStr
    name: str


class UserCreate(UserBase):
    """
    Schema for user registration.
    
    Note: Password is optional for OAuth users (e.g., Google login)
    but REQUIRED for local users.
    """
    password: Optional[str] = None
    provider: str = Field(default="local", description="Authentication provider (local/google)")
    
    @field_validator('password')
    @classmethod
    def validate_password_for_local_users(cls, v, info):
        """
        Ensure local users provide a valid password.
        
        OAuth users (e.g., Google) don't need passwords, but local users must provide one.
        """
        # Get provider from validation context (Pydantic v2)
        data = info.data if hasattr(info, 'data') else {}
        provider = data.get('provider', 'local')
        
        # Validate password for local users
        if provider == 'local':
            if not v or not v.strip():
                raise ValueError('Password is required for local user registration')
        
        return v
