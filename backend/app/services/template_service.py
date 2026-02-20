"""Template management service for dynamic quality selection."""
from typing import Dict, Optional
from pydantic import BaseModel

from app.config import settings


class TemplateConfig(BaseModel):
    """Recording template configuration."""
    id: str
    name: str
    quality: str  # 480p, 720p, 1080p
    max_duration_minutes: int
    features: Dict[str, bool]  # noise_cancellation, background_blur, etc.
    storage_estimate_mb_per_hour: int
    tier_required: str  # free, standard, premium


# Template definitions (sync with 100ms dashboard templates)
TEMPLATES = {
    "free": TemplateConfig(
        id=settings.HMS_TEMPLATE_ID_FREE or "",
        name="Basic Quality",
        quality="480p",
        max_duration_minutes=30,
        features={
            "noise_cancellation": False,
            "background_blur": False,
            "recording": True,
        },
        storage_estimate_mb_per_hour=150,
        tier_required="free",
    ),
    "standard": TemplateConfig(
        id=settings.HMS_TEMPLATE_ID_STANDARD or settings.HMS_TEMPLATE_ID or "",
        name="Standard Quality (Recommended)",
        quality="720p",
        max_duration_minutes=120,
        features={
            "noise_cancellation": True,
            "background_blur": False,
            "recording": True,
        },
        storage_estimate_mb_per_hour=300,
        tier_required="free",
    ),
    "premium": TemplateConfig(
        id=settings.HMS_TEMPLATE_ID_PREMIUM or "",
        name="High Quality",
        quality="1080p",
        max_duration_minutes=0,  # unlimited
        features={
            "noise_cancellation": True,
            "background_blur": True,
            "recording": True,
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
