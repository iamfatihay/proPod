"""Google authentication helpers."""

from __future__ import annotations

import json
from typing import Any, Dict

import httpx

from fastapi import HTTPException, status


GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def fetch_google_user_profile(access_token: str) -> Dict[str, Any]:
    """Fetch and validate the Google profile for a bearer access token."""
    try:
        response = httpx.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=5.0,
        )
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google access token",
        ) from exc
    except (httpx.RequestError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Invalid response from Google authentication service",
        ) from exc

    email = payload.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account email is missing",
        )

    if payload.get("email_verified") is not True:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account email is not verified",
        )

    return {
        "email": email,
        "name": payload.get("name") or email.split("@")[0],
        "photo_url": payload.get("picture"),
        "provider": "google",
    }