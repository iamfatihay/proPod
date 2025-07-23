# Services module
"""
Services package for Volo backend application.

This package contains all external service integrations including:
- Email services (SMTP, development logging)
- AI services (audio processing, transcription, content analysis)
- Future services (SMS, push notifications, etc.)
"""

from .email_service import email_service
from .ai_service import ai_service

__all__ = ['email_service', 'ai_service'] 