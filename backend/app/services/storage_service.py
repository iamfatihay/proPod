"""Storage service for managing podcast audio files."""
import os
from typing import Optional
from pathlib import Path
import httpx

from app.config import settings


class StorageService:
    """Abstraction layer for audio storage operations."""
    
    def __init__(self):
        self.media_dir = Path(__file__).parent.parent.parent / "media" / "audio"
        os.makedirs(self.media_dir, exist_ok=True)
    
    def is_external_url(self, url: str) -> bool:
        """Check if URL is external (not local backend)."""
        return url.startswith("http://") or url.startswith("https://")
    
    def should_download_external(self, url: str) -> bool:
        """Determine if external URL should be downloaded to local storage."""
        # Keep 100ms recordings on their CDN (don't download)
        if "100ms" in url or "hms" in url:
            return False
        
        # Other external URLs: download for consistency
        return True
    
    def get_playback_url(self, audio_url: str) -> str:
        """Get playback URL, prepending base URL for local paths."""
        if self.is_external_url(audio_url):
            return audio_url
        
        # Local path - prepend base URL
        base_url = settings.BASE_URL or "http://localhost:8000"
        if not audio_url.startswith("/"):
            audio_url = f"/{audio_url}"
        return f"{base_url}{audio_url}"
    
    async def download_to_local(self, url: str, filename: str) -> str:
        """Download external file to local storage."""
        dest_path = self.media_dir / filename
        
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            with open(dest_path, "wb") as f:
                f.write(response.content)
        
        return f"/media/audio/{filename}"
    
    def delete_local(self, path: str) -> bool:
        """Delete local file."""
        if self.is_external_url(path):
            return False
        
        file_path = self.media_dir / Path(path).name
        if file_path.exists():
            file_path.unlink()
            return True
        return False


# Singleton instance
storage_service = StorageService()
