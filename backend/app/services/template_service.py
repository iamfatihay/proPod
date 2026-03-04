"""Template management service for dynamic quality selection.

✅ IMPLEMENTED: Phase 2-4 multi-template feature with single-template fallback.

FEATURES:
- Multiple quality tiers (free 480p, standard 720p, premium 1080p)
- Dynamic template selection based on user tier
- Storage estimation for recording planning
- API endpoints: GET /rtc/templates, POST /rtc/storage-estimate

DEPLOYMENT MODES:
1. **Single Template Mode** (Default):
   - All tiers use HMS_TEMPLATE_ID from .env
   - Simplest setup, works immediately
   - Good for MVP/testing

2. **Multi-Template Mode** (Optional):
   - Create 3 templates in 100ms dashboard (free/standard/premium)
   - Add HMS_TEMPLATE_ID_FREE, HMS_TEMPLATE_ID_STANDARD, HMS_TEMPLATE_ID_PREMIUM to .env
   - Automatic tier-based routing
   - Better quality differentiation

100ms SETUP (Required):
1. Go to 100ms Dashboard → Templates
2. Create template(s) with "Recording" enabled
3. Copy template ID(s) to .env
4. Recording config is template-level, not room-level

See: docs/project/RTC_IMPLEMENTATION_SUMMARY.md
"""
import logging
from typing import Dict, Optional
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)


class TemplateConfig(BaseModel):
    """Recording template configuration."""
    id: str
    name: str
    quality: str  # 480p, 720p, 1080p
    max_duration_minutes: int
    features: Dict[str, bool]  # noise_cancellation, background_blur, etc.
    storage_estimate_mb_per_hour: int
    tier_required: str  # free, standard, premium


def _resolve_template_id(tier_id: Optional[str], tier_name: str) -> str:
    """Resolve template ID for a tier, falling back to the default HMS_TEMPLATE_ID.

    Logs a warning if the final resolved ID is still empty so operators are
    notified of misconfiguration at startup rather than at request time.
    """
    resolved = (tier_id or "").strip() or (settings.HMS_TEMPLATE_ID or "").strip()
    if not resolved:
        logger.warning(
            "No HMS template ID configured for tier '%s' and HMS_TEMPLATE_ID is also "
            "empty. Room creation will fail until a template ID is set in .env.",
            tier_name,
        )
    return resolved


# Template definitions (sync with 100ms dashboard templates)
# Uses tier-specific IDs when set (HMS_TEMPLATE_ID_FREE/STANDARD/PREMIUM),
# otherwise falls back to the default HMS_TEMPLATE_ID for all tiers.
TEMPLATES = {
    "free": TemplateConfig(
        id=_resolve_template_id(settings.HMS_TEMPLATE_ID_FREE, "free"),
        name="Basic Quality",
        quality="480p",
        max_duration_minutes=30,
        features={
            "noise_cancellation": False,
            "background_blur": False,
            "recording": True,  # NOTE: Must be enabled in 100ms dashboard, not API
        },
        storage_estimate_mb_per_hour=150,
        tier_required="free",
    ),
    "standard": TemplateConfig(
        id=_resolve_template_id(settings.HMS_TEMPLATE_ID_STANDARD, "standard"),
        name="Standard Quality (Recommended)",
        quality="720p",
        max_duration_minutes=120,
        features={
            "noise_cancellation": True,
            "background_blur": False,
            "recording": True,  # NOTE: Must be enabled in 100ms dashboard, not API
        },
        storage_estimate_mb_per_hour=300,
        tier_required="free",
    ),
    "premium": TemplateConfig(
        id=_resolve_template_id(settings.HMS_TEMPLATE_ID_PREMIUM, "premium"),
        name="High Quality",
        quality="1080p",
        max_duration_minutes=0,  # unlimited
        features={
            "noise_cancellation": True,
            "background_blur": True,
            "recording": True,  # NOTE: Must be enabled in 100ms dashboard, not API
        },
        storage_estimate_mb_per_hour=700,
        tier_required="premium",
    ),
}


def get_template_for_user(user_is_premium: bool, quality: str = "standard") -> TemplateConfig:
    """Get appropriate template based on user tier and quality preference."""
    if quality == "premium" and not user_is_premium:
        # Fallback to standard for non-premium users
        quality = "standard"
    
    if quality == "free" or (quality == "standard" and not user_is_premium):
        # Free users limited to free/standard templates
        return TEMPLATES.get(quality, TEMPLATES["standard"])
    
    return TEMPLATES.get(quality, TEMPLATES["standard"])


def estimate_storage(
    quality: str,
    duration_minutes: int,
    participant_count: int = 1
) -> float:
    """Estimate storage size in MB."""
    template = TEMPLATES.get(quality, TEMPLATES["standard"])
    base_mb_per_hour = template.storage_estimate_mb_per_hour
    
    # Composite recording size grows with participants
    participant_multiplier = 1 + (participant_count - 1) * 0.15
    
    hours = duration_minutes / 60
    estimated_mb = base_mb_per_hour * hours * participant_multiplier
    
    return round(estimated_mb, 2)


def list_available_templates(user_is_premium: bool) -> list[TemplateConfig]:
    """List templates available to user based on tier."""
    available = [TEMPLATES["free"], TEMPLATES["standard"]]
    
    if user_is_premium:
        available.append(TEMPLATES["premium"])
    
    return available


# ==============================================================================
# 100ms INTEGRATION NOTES (Phase 2-4)
# ==============================================================================
#
# CRITICAL: Recording must be enabled in 100ms dashboard template settings.
# The "recording": True in features dict above is metadata-only, not sent to API.
#
# Setup Instructions:
# 1. Go to 100ms Dashboard → Templates
# 2. Create/edit template for your app
# 3. Enable "Recording" in template settings
# 4. Copy template ID to .env → HMS_TEMPLATE_ID
#
# API Limitation:
# - 100ms REST API does NOT support "enable_recording" parameter
# - Recording config is template-level (dashboard), not room-level (API)
# - This service provides metadata for frontend UI, not API config
#
# Phase 5+ Enhancement:
# - Add HMS_TEMPLATE_ID_FREE, HMS_TEMPLATE_ID_STANDARD, HMS_TEMPLATE_ID_PREMIUM to config
# - Integrate with rtc.py for dynamic template selection
# - Create separate 100ms templates per quality tier
#
# See: docs/project/RTC_SESSION_MEMORY.md (100ms webhook integration)
# ==============================================================================
