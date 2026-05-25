"""Focused tests for managed media storage helpers."""

import pytest

from app.services.storage_service import StorageService


def test_normalize_for_storage_strips_local_base_url(monkeypatch):
    monkeypatch.setattr("app.services.storage_service.settings.BASE_URL", "http://localhost:8000")
    service = StorageService()

    assert (
        service.normalize_for_storage("http://localhost:8000/media/audio/example.mp3")
        == "/media/audio/example.mp3"
    )


def test_normalize_for_storage_keeps_external_cdn_url(monkeypatch):
    monkeypatch.setattr("app.services.storage_service.settings.BASE_URL", "http://localhost:8000")
    service = StorageService()

    assert (
        service.normalize_for_storage("https://cdn.example.com/podcasts/audio/example.mp3")
        == "https://cdn.example.com/podcasts/audio/example.mp3"
    )


def test_get_playback_url_prepends_base_url(monkeypatch):
    monkeypatch.setattr("app.services.storage_service.settings.BASE_URL", "http://localhost:8000")
    service = StorageService()

    assert service.get_playback_url("/media/audio/example.mp3") == "http://localhost:8000/media/audio/example.mp3"


@pytest.mark.asyncio
async def test_persist_remote_media_routes_to_s3(monkeypatch):
    monkeypatch.setattr("app.services.storage_service.settings.MEDIA_STORAGE_BACKEND", "s3")
    service = StorageService()

    async def fake_upload(url, filename):
        return f"https://cdn.example.com/{filename}"

    monkeypatch.setattr(service, "upload_to_s3", fake_upload)

    result = await service.persist_remote_media("https://example.com/file.mp4", "file.mp4")

    assert result == "https://cdn.example.com/file.mp4"


def test_delete_managed_routes_s3_public_url(monkeypatch):
    monkeypatch.setattr("app.services.storage_service.settings.MEDIA_STORAGE_BACKEND", "s3")
    monkeypatch.setattr("app.services.storage_service.settings.MEDIA_S3_BUCKET", "propod-media")
    monkeypatch.setattr(
        "app.services.storage_service.settings.MEDIA_S3_PUBLIC_BASE_URL",
        "https://propod-media.fra1.cdn.digitaloceanspaces.com",
    )
    service = StorageService()
    deleted = {}

    class FakeClient:
        def delete_object(self, Bucket, Key):
            deleted["bucket"] = Bucket
            deleted["key"] = Key

    monkeypatch.setattr(service, "_get_s3_client", lambda: FakeClient())

    assert service.delete_managed(
        "https://propod-media.fra1.cdn.digitaloceanspaces.com/podcasts/audio/example.mp3"
    ) is True
    assert deleted == {"bucket": "propod-media", "key": "podcasts/audio/example.mp3"}


def test_delete_managed_deletes_non_audio_local_media(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.storage_service.settings.BACKEND_ROOT", tmp_path)
    monkeypatch.setattr("app.services.storage_service.settings.MEDIA_ROOT", "media")
    service = StorageService()
    thumbnail_path = tmp_path / "media" / "thumbnails" / "cover.png"
    thumbnail_path.parent.mkdir(parents=True, exist_ok=True)
    thumbnail_path.write_bytes(b"thumb")

    assert service.delete_managed("/media/thumbnails/cover.png") is True
    assert thumbnail_path.exists() is False


def test_resolve_local_media_path_rejects_sibling_escape(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.storage_service.settings.BACKEND_ROOT", tmp_path)
    monkeypatch.setattr("app.services.storage_service.settings.MEDIA_ROOT", "media")
    service = StorageService()

    assert service._resolve_local_media_path("/../media-evil/escape.png") is None