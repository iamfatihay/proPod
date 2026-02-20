"""100ms server-side integration helpers."""
from __future__ import annotations

import time
from typing import Any, Dict, Optional
from uuid import uuid4

import httpx
from jose import jwt

from app.config import settings


HMS_API_BASE = "https://api.100ms.live/v2"


def _now_epoch() -> int:
    return int(time.time())


def generate_management_token(expires_in_seconds: int = 86400) -> str:
    """Generate a management token for 100ms REST API calls."""
    if not settings.HMS_APP_ACCESS_KEY or not settings.HMS_APP_SECRET:
        raise ValueError("Missing HMS_APP_ACCESS_KEY or HMS_APP_SECRET")

    now = _now_epoch()
    payload = {
        "access_key": settings.HMS_APP_ACCESS_KEY,
        "type": "management",
        "version": 2,
        "iat": now,
        "nbf": now,
        "exp": now + expires_in_seconds,
        "jti": str(uuid4()),
    }
    return jwt.encode(
        payload,
        settings.HMS_APP_SECRET,
        algorithm="HS256",
    )


def generate_auth_token(
    room_id: str,
    user_id: str,
    role: str,
    expires_in_seconds: int = 86400,
) -> str:
    """Generate a client auth token for 100ms SDKs."""
    if not settings.HMS_APP_ACCESS_KEY or not settings.HMS_APP_SECRET:
        raise ValueError("Missing HMS_APP_ACCESS_KEY or HMS_APP_SECRET")

    now = _now_epoch()
    payload = {
        "access_key": settings.HMS_APP_ACCESS_KEY,
        "room_id": room_id,
        "user_id": user_id,
        "role": role,
        "type": "app",
        "version": 2,
        "iat": now,
        "nbf": now,
        "exp": now + expires_in_seconds,
        "jti": str(uuid4()),
    }
    return jwt.encode(
        payload,
        settings.HMS_APP_SECRET,
        algorithm="HS256",
    )


def _build_room_payload(
    name: Optional[str],
    description: Optional[str],
    template_id: Optional[str],
    region: Optional[str],
    size: Optional[int],
    max_duration_seconds: Optional[int],
    webhook_url: Optional[str],
    webhook_headers: Optional[dict],
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {}

    if name:
        payload["name"] = name
    if description:
        payload["description"] = description
    if template_id:
        payload["template_id"] = template_id
    if region:
        payload["region"] = region
    if size is not None:
        payload["size"] = size
    if max_duration_seconds is not None:
        payload["max_duration_seconds"] = max_duration_seconds
    if webhook_url:
        payload["webhook"] = {"url": webhook_url}
        if webhook_headers:
            payload["webhook"]["headers"] = webhook_headers

    return payload


async def create_room(
    name: Optional[str],
    description: Optional[str],
    template_id: Optional[str],
    region: Optional[str],
    size: Optional[int],
    max_duration_seconds: Optional[int],
    webhook_url: Optional[str],
    webhook_headers: Optional[dict],
) -> Dict[str, Any]:
    """Create a room using 100ms REST API.
    
    Note: Recording must be enabled in the template settings on 100ms dashboard.
    Recording cannot be controlled via room creation API.
    """
    token = generate_management_token()
    payload = _build_room_payload(
        name=name,
        description=description,
        template_id=template_id,
        region=region,
        size=size,
        max_duration_seconds=max_duration_seconds,
        webhook_url=webhook_url,
        webhook_headers=webhook_headers,
    )

    print(f"[HMS] Creating room with payload: {payload}")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{HMS_API_BASE}/rooms",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if response.status_code >= 400:
        print(f"[HMS] API Error {response.status_code}: {response.text}")
    
    response.raise_for_status()
    return response.json()
