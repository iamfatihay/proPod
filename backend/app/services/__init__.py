# Services module
"""
Services package for Volo backend application.

This package contains all external service integrations including:
- Email services (SMTP, development logging)
- Future services (SMS, push notifications, AI integrations, etc.)
"""

from .email_service import email_service

__all__ = ['email_service'] 