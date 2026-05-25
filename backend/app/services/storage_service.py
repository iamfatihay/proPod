"""Storage service for managing podcast audio files."""
import os
import shutil
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import httpx

from app.config import settings


class StorageService:
    """Abstraction layer for audio storage operations."""
    
    def __init__(self):
        self.media_root = settings.BACKEND_ROOT / settings.MEDIA_ROOT
        self.media_dir = self.media_root / "audio"
        os.makedirs(self.media_dir, exist_ok=True)
    
    def is_external_url(self, url: str) -> bool:
        """Check if URL is external (not local backend)."""
        return url.startswith("http://") or url.startswith("https://")
    
    def should_download_external(self, url: str) -> bool:
        """Determine if external URL should be downloaded to local storage."""
        return self.is_external_url(url)
    
    def get_playback_url(self, audio_url: str) -> str:
        """Get playback URL, prepending base URL for local paths."""
        if self.is_external_url(audio_url):
            return audio_url
        
        # Local path - prepend base URL
        base_url = settings.BASE_URL or "http://localhost:8000"
        if not audio_url.startswith("/"):
            audio_url = f"/{audio_url}"
        return f"{base_url}{audio_url}"

    def normalize_for_storage(self, media_url: str | None) -> str | None:
        """Store managed local media as relative paths so domain changes don't make old rows stale."""
        if not media_url:
            return media_url

        if not self.is_external_url(media_url):
            return media_url

        parsed = urlparse(media_url)
        base_url = settings.BASE_URL.rstrip("/")
        parsed_base = urlparse(base_url)
        allowed_hosts = {
            parsed_base.hostname,
            "localhost",
            "127.0.0.1",
        }

        if (
            parsed.hostname in allowed_hosts
            and parsed.path.startswith("/media/")
        ):
            return parsed.path

        return media_url

    def _resolve_local_media_path(self, path: str) -> Path | None:
        """Resolve a managed local media path under MEDIA_ROOT safely."""
        if self.is_external_url(path):
            return None

        relative_path = Path(path.lstrip("/"))
        media_root_name = Path(settings.MEDIA_ROOT).name
        if relative_path.parts and relative_path.parts[0] == media_root_name:
            relative_path = Path(*relative_path.parts[1:])

        candidate = (self.media_root / relative_path).resolve()
        media_root_resolved = self.media_root.resolve()
        if not str(candidate).startswith(str(media_root_resolved)):
            return None

        return candidate

    def _build_s3_key(self, filename: str) -> str:
        prefix = settings.MEDIA_S3_PREFIX.strip("/")
        return f"{prefix}/audio/{filename}" if prefix else f"audio/{filename}"

    def _get_s3_client(self):
        try:
            import boto3
        except ImportError as exc:  # pragma: no cover - only hit when S3 mode is enabled without dependency
            raise RuntimeError(
                "MEDIA_STORAGE_BACKEND=s3 requires boto3 to be installed in the backend environment"
            ) from exc

        client_kwargs = {}
        if settings.MEDIA_S3_REGION:
            client_kwargs["region_name"] = settings.MEDIA_S3_REGION
        if settings.MEDIA_S3_ENDPOINT_URL:
            client_kwargs["endpoint_url"] = settings.MEDIA_S3_ENDPOINT_URL
        if settings.MEDIA_S3_ACCESS_KEY_ID:
            client_kwargs["aws_access_key_id"] = settings.MEDIA_S3_ACCESS_KEY_ID
        if settings.MEDIA_S3_SECRET_ACCESS_KEY:
            client_kwargs["aws_secret_access_key"] = settings.MEDIA_S3_SECRET_ACCESS_KEY

        return boto3.client("s3", **client_kwargs)

    def _get_s3_public_url(self, key: str) -> str:
        if settings.MEDIA_S3_PUBLIC_BASE_URL:
            return f"{settings.MEDIA_S3_PUBLIC_BASE_URL.rstrip('/')}/{key}"
        if settings.MEDIA_S3_ENDPOINT_URL:
            return f"{settings.MEDIA_S3_ENDPOINT_URL.rstrip('/')}/{settings.MEDIA_S3_BUCKET}/{key}"
        if settings.MEDIA_S3_REGION:
            return f"https://{settings.MEDIA_S3_BUCKET}.s3.{settings.MEDIA_S3_REGION}.amazonaws.com/{key}"
        return f"https://{settings.MEDIA_S3_BUCKET}.s3.amazonaws.com/{key}"

    def _get_s3_extra_args(self, content_type: str | None = None) -> dict:
        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type
        return extra_args

    async def _download_remote_to_tempfile(self, url: str, suffix: str) -> str:
        fd, temp_path = tempfile.mkstemp(prefix="propod_media_", suffix=suffix)
        os.close(fd)

        try:
            async with httpx.AsyncClient(timeout=300.0, follow_redirects=True) as client:
                async with client.stream("GET", url) as response:
                    response.raise_for_status()

                    with open(temp_path, "wb") as temp_file:
                        async for chunk in response.aiter_bytes():
                            if chunk:
                                temp_file.write(chunk)
        except Exception:
            try:
                os.remove(temp_path)
            except OSError:
                pass
            raise

        return temp_path

    async def upload_to_s3(self, url: str, filename: str) -> str:
        """Download remote media and upload it into S3-compatible object storage."""
        if not settings.MEDIA_S3_BUCKET:
            raise RuntimeError("MEDIA_STORAGE_BACKEND=s3 requires MEDIA_S3_BUCKET to be configured")

        suffix = Path(filename).suffix or ".bin"
        temp_path = await self._download_remote_to_tempfile(url, suffix)
        key = self._build_s3_key(filename)
        client = self._get_s3_client()
        try:
            client.upload_file(temp_path, settings.MEDIA_S3_BUCKET, key)
        finally:
            try:
                os.remove(temp_path)
            except OSError:
                pass

        return self._get_s3_public_url(key)

    async def persist_bytes(self, contents: bytes, filename: str, content_type: str | None = None) -> str:
        """Persist in-memory media into the configured backend."""
        if settings.MEDIA_STORAGE_BACKEND == "s3":
            key = self._build_s3_key(filename)
            client = self._get_s3_client()
            put_kwargs = {
                "Bucket": settings.MEDIA_S3_BUCKET,
                "Key": key,
                "Body": contents,
                **self._get_s3_extra_args(content_type),
            }
            client.put_object(**put_kwargs)
            return self._get_s3_public_url(key)

        dest_path = self.media_dir / filename
        with open(dest_path, "wb") as file_handle:
            file_handle.write(contents)
        return f"/media/audio/{filename}"

    async def persist_file(self, source_path: str | Path, filename: str, content_type: str | None = None) -> str:
        """Persist an existing local file into the configured backend."""
        source_path = Path(source_path)
        if settings.MEDIA_STORAGE_BACKEND == "s3":
            key = self._build_s3_key(filename)
            client = self._get_s3_client()
            upload_kwargs = self._get_s3_extra_args(content_type)
            if upload_kwargs:
                client.upload_file(str(source_path), settings.MEDIA_S3_BUCKET, key, ExtraArgs=upload_kwargs)
            else:
                client.upload_file(str(source_path), settings.MEDIA_S3_BUCKET, key)
            return self._get_s3_public_url(key)

        dest_path = self.media_dir / filename
        if source_path.resolve() != dest_path.resolve():
            shutil.copyfile(source_path, dest_path)
        return f"/media/audio/{filename}"

    async def persist_remote_media(self, url: str, filename: str) -> str:
        """Persist remote media into the configured managed storage backend."""
        if settings.MEDIA_STORAGE_BACKEND == "s3":
            return await self.upload_to_s3(url, filename)
        return await self.download_to_local(url, filename)

    def _extract_s3_key(self, media_url: str) -> str | None:
        parsed = urlparse(media_url)
        if settings.MEDIA_S3_PUBLIC_BASE_URL:
            public_base = settings.MEDIA_S3_PUBLIC_BASE_URL.rstrip("/") + "/"
            if media_url.startswith(public_base):
                return media_url[len(public_base):]

        if settings.MEDIA_S3_ENDPOINT_URL:
            endpoint_prefix = settings.MEDIA_S3_ENDPOINT_URL.rstrip("/") + f"/{settings.MEDIA_S3_BUCKET}/"
            if media_url.startswith(endpoint_prefix):
                return media_url[len(endpoint_prefix):]

        virtual_hosts = {
            f"{settings.MEDIA_S3_BUCKET}.s3.amazonaws.com",
        }
        if settings.MEDIA_S3_REGION:
            virtual_hosts.add(f"{settings.MEDIA_S3_BUCKET}.s3.{settings.MEDIA_S3_REGION}.amazonaws.com")

        if parsed.netloc in virtual_hosts:
            return parsed.path.lstrip("/")

        return None

    def delete_managed(self, media_url: str | None) -> bool:
        """Delete an object from the configured managed storage backend when possible."""
        if not media_url:
            return False

        normalized_url = self.normalize_for_storage(media_url)
        if normalized_url and not self.is_external_url(normalized_url):
            return self.delete_local(normalized_url)

        if settings.MEDIA_STORAGE_BACKEND != "s3" or not media_url:
            return False

        key = self._extract_s3_key(media_url)
        if not key:
            return False

        client = self._get_s3_client()
        client.delete_object(Bucket=settings.MEDIA_S3_BUCKET, Key=key)
        return True
    
    async def download_to_local(self, url: str, filename: str) -> str:
        """Download external file to local storage."""
        dest_path = self.media_dir / filename

        async with httpx.AsyncClient(timeout=300.0, follow_redirects=True) as client:
            async with client.stream("GET", url) as response:
                response.raise_for_status()

                with open(dest_path, "wb") as f:
                    async for chunk in response.aiter_bytes():
                        if chunk:
                            f.write(chunk)

        return f"/media/audio/{filename}"
    
    def delete_local(self, path: str) -> bool:
        """Delete local file."""
        if self.is_external_url(path):
            return False

        file_path = self._resolve_local_media_path(path)
        if file_path is None:
            return False

        if file_path.exists():
            file_path.unlink()
            return True
        return False


# Singleton instance
storage_service = StorageService()
