"""Tests for playlist CRUD endpoints."""
from fastapi.testclient import TestClient

from app.main import app
from app import crud, schemas

client = TestClient(app)


class TestCreatePlaylist:
    """Tests for POST /playlists/"""

    def test_create_playlist_success(self, test_user):
        user, token = test_user
        response = client.post(
            "/playlists/",
            json={"name": "My Favorites", "description": "Best episodes", "is_public": True},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "My Favorites"
        assert data["description"] == "Best episodes"
        assert data["is_public"] is True
        assert data["owner_id"] == user.id
        assert data["item_count"] == 0

    def test_create_playlist_minimal(self, test_user):
        """Creating a playlist with only the required name field."""
        _, token = test_user
        response = client.post(
            "/playlists/",
            json={"name": "Quick List"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Quick List"
        assert data["is_public"] is True  # default

    def test_create_playlist_private(self, test_user):
        _, token = test_user
        response = client.post(
            "/playlists/",
            json={"name": "Secret List", "is_public": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        assert response.json()["is_public"] is False

    def test_create_playlist_empty_name_rejected(self, test_user):
        _, token = test_user
        response = client.post(
            "/playlists/",
            json={"name": ""},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422

    def test_create_playlist_unauthenticated(self):
        response = client.post("/playlists/", json={"name": "Nope"})
        assert response.status_code == 401


class TestGetMyPlaylists:
    """Tests for GET /playlists/my"""

    def test_get_my_playlists_empty(self, test_user):
        _, token = test_user
        response = client.get(
            "/playlists/my",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 0
        assert isinstance(data["playlists"], list)

    def test_get_my_playlists_returns_own(self, test_user):
        _, token = test_user
        # Create a playlist
        client.post(
            "/playlists/",
            json={"name": "My Test Playlist"},
            headers={"Authorization": f"Bearer {token}"},
        )
        response = client.get(
            "/playlists/my",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        names = [p["name"] for p in response.json()["playlists"]]
        assert "My Test Playlist" in names

    def test_get_my_playlists_unauthenticated(self):
        response = client.get("/playlists/my")
        assert response.status_code == 401


class TestGetPublicPlaylists:
    """Tests for GET /playlists/public"""

    def test_get_public_playlists(self, test_user):
        _, token = test_user
        # Create a public playlist
        client.post(
            "/playlists/",
            json={"name": "Public Playlist", "is_public": True},
            headers={"Authorization": f"Bearer {token}"},
        )
        response = client.get("/playlists/public")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        # All returned playlists should be public
        for p in data["playlists"]:
            assert p["is_public"] is True

    def test_private_playlists_excluded(self, test_user):
        _, token = test_user
        create_resp = client.post(
            "/playlists/",
            json={"name": "Hidden Playlist", "is_public": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        hidden_id = create_resp.json()["id"]
        response = client.get("/playlists/public")
        ids = [p["id"] for p in response.json()["playlists"]]
        assert hidden_id not in ids

    def test_public_playlist_returns_preview_thumbnails(self, test_user, test_podcast):
        """Public playlist endpoint must populate preview_thumbnails (PR #86)."""
        _, token = test_user

        # Give the test podcast a thumbnail and add it to a public playlist.
        test_podcast.thumbnail_url = "http://example.com/public-thumb.jpg"
        from app.database import SessionLocal
        s = SessionLocal()
        try:
            db_pod = s.merge(test_podcast)
            s.commit()
        finally:
            s.close()

        create_resp = client.post(
            "/playlists/",
            json={"name": "Public Mosaic Playlist", "is_public": True},
            headers={"Authorization": f"Bearer {token}"},
        )
        pl_id = create_resp.json()["id"]
        client.post(
            f"/playlists/{pl_id}/items",
            json={"podcast_id": test_podcast.id},
            headers={"Authorization": f"Bearer {token}"},
        )

        resp = client.get("/playlists/public")
        assert resp.status_code == 200
        playlists = resp.json()["playlists"]
        target = next((p for p in playlists if p["id"] == pl_id), None)
        assert target is not None, "newly created public playlist should appear"
        assert "preview_thumbnails" in target
        assert "http://example.com/public-thumb.jpg" in target["preview_thumbnails"]

    def test_public_playlist_includes_owner_name(self, test_user):
        """GET /playlists/public must include owner_name on each playlist card."""
        user, token = test_user
        client.post(
            "/playlists/",
            json={"name": "Named Owner Playlist", "is_public": True},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.get("/playlists/public")
        assert resp.status_code == 200
        playlists = resp.json()["playlists"]
        target = next(
            (p for p in playlists if p["name"] == "Named Owner Playlist"), None
        )
        assert target is not None, "newly created public playlist should appear"
        assert "owner_name" in target, "owner_name field must be present"
        assert target["owner_name"] == user.name, (
            "owner_name should match the creating user's display name"
        )

    def test_public_playlist_includes_owner_username(self, test_user):
        """GET /playlists/public must include owner_username (email prefix) on each card."""
        user, token = test_user
        client.post(
            "/playlists/",
            json={"name": "Username Handle Playlist", "is_public": True},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.get("/playlists/public")
        assert resp.status_code == 200
        playlists = resp.json()["playlists"]
        target = next(
            (p for p in playlists if p["name"] == "Username Handle Playlist"), None
        )
        assert target is not None, "newly created public playlist should appear"
        assert "owner_username" in target, "owner_username field must be present"
        expected_username = user.email.split("@")[0]
        assert target["owner_username"] == expected_username, (
            "owner_username should be the email-prefix handle of the creating user"
        )


class TestGetPlaylistDetail:
    """Tests for GET /playlists/{playlist_id}"""

    def test_get_public_playlist_unauthenticated(self, test_user):
        _, token = test_user
        resp = client.post(
            "/playlists/",
            json={"name": "Open Playlist", "is_public": True},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        # Access without auth
        response = client.get(f"/playlists/{playlist_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Open Playlist"
        assert response.json()["items"] == []

    def test_get_private_playlist_owner(self, test_user):
        _, token = test_user
        resp = client.post(
            "/playlists/",
            json={"name": "Private Playlist", "is_public": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        response = client.get(
            f"/playlists/{playlist_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    def test_get_private_playlist_non_owner_returns_403(self, test_user, second_user):
        _, token = test_user
        _, second_token = second_user
        resp = client.post(
            "/playlists/",
            json={"name": "Owner Only", "is_public": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        response = client.get(
            f"/playlists/{playlist_id}",
            headers={"Authorization": f"Bearer {second_token}"},
        )
        assert response.status_code == 403

    def test_get_private_playlist_unauthenticated_returns_403(self, test_user):
        _, token = test_user
        resp = client.post(
            "/playlists/",
            json={"name": "Locked", "is_public": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        response = client.get(f"/playlists/{playlist_id}")
        assert response.status_code == 403

    def test_get_nonexistent_playlist_returns_404(self):
        response = client.get("/playlists/99999")
        assert response.status_code == 404


class TestUpdatePlaylist:
    """Tests for PUT /playlists/{playlist_id}"""

    def test_update_playlist_name(self, test_user):
        _, token = test_user
        resp = client.post(
            "/playlists/",
            json={"name": "Old Name"},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        response = client.put(
            f"/playlists/{playlist_id}",
            json={"name": "New Name"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "New Name"

    def test_update_playlist_non_owner_returns_403(self, test_user, second_user):
        _, token = test_user
        _, second_token = second_user
        resp = client.post(
            "/playlists/",
            json={"name": "Owned Playlist"},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        response = client.put(
            f"/playlists/{playlist_id}",
            json={"name": "Hijacked"},
            headers={"Authorization": f"Bearer {second_token}"},
        )
        assert response.status_code == 403

    def test_update_nonexistent_playlist_returns_404(self, test_user):
        _, token = test_user
        response = client.put(
            "/playlists/99999",
            json={"name": "Ghost"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404

    def test_update_playlist_unauthenticated(self, test_user):
        _, token = test_user
        resp = client.post(
            "/playlists/",
            json={"name": "Auth Test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        response = client.put(
            f"/playlists/{playlist_id}",
            json={"name": "No Auth"},
        )
        assert response.status_code == 401


class TestDeletePlaylist:
    """Tests for DELETE /playlists/{playlist_id}"""

    def test_delete_playlist_success(self, test_user):
        _, token = test_user
        resp = client.post(
            "/playlists/",
            json={"name": "To Delete"},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        response = client.delete(
            f"/playlists/{playlist_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Playlist deleted successfully"
        # Confirm it's gone
        get_resp = client.get(f"/playlists/{playlist_id}")
        assert get_resp.status_code == 404

    def test_delete_playlist_non_owner_returns_403(self, test_user, second_user):
        _, token = test_user
        _, second_token = second_user
        resp = client.post(
            "/playlists/",
            json={"name": "Not Yours"},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        response = client.delete(
            f"/playlists/{playlist_id}",
            headers={"Authorization": f"Bearer {second_token}"},
        )
        assert response.status_code == 403

    def test_delete_nonexistent_playlist_returns_404(self, test_user):
        _, token = test_user
        response = client.delete(
            "/playlists/99999",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404


class TestPlaylistItems:
    """Tests for POST/DELETE /playlists/{playlist_id}/items"""

    def test_add_podcast_to_playlist(self, test_user, test_podcast):
        _, token = test_user
        resp = client.post(
            "/playlists/",
            json={"name": "With Items"},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        response = client.post(
            f"/playlists/{playlist_id}/items",
            json={"podcast_id": test_podcast.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["podcast_id"] == test_podcast.id
        assert data["position"] == 0

    def test_add_duplicate_podcast_returns_400(self, test_user, test_podcast):
        _, token = test_user
        resp = client.post(
            "/playlists/",
            json={"name": "Dup Test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        client.post(
            f"/playlists/{playlist_id}/items",
            json={"podcast_id": test_podcast.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        response = client.post(
            f"/playlists/{playlist_id}/items",
            json={"podcast_id": test_podcast.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 400

    def test_add_nonexistent_podcast_returns_404(self, test_user):
        _, token = test_user
        resp = client.post(
            "/playlists/",
            json={"name": "Ghost Podcast"},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        response = client.post(
            f"/playlists/{playlist_id}/items",
            json={"podcast_id": 99999},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404

    def test_add_item_non_owner_returns_403(self, test_user, second_user, test_podcast):
        _, token = test_user
        _, second_token = second_user
        resp = client.post(
            "/playlists/",
            json={"name": "Owner Only Items"},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        response = client.post(
            f"/playlists/{playlist_id}/items",
            json={"podcast_id": test_podcast.id},
            headers={"Authorization": f"Bearer {second_token}"},
        )
        assert response.status_code == 403

    def test_remove_podcast_from_playlist(self, test_user, test_podcast):
        _, token = test_user
        resp = client.post(
            "/playlists/",
            json={"name": "Remove Test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        client.post(
            f"/playlists/{playlist_id}/items",
            json={"podcast_id": test_podcast.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        response = client.delete(
            f"/playlists/{playlist_id}/items/{test_podcast.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Podcast removed from playlist"

    def test_remove_nonexistent_item_returns_404(self, test_user):
        _, token = test_user
        resp = client.post(
            "/playlists/",
            json={"name": "Empty Playlist"},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        response = client.delete(
            f"/playlists/{playlist_id}/items/99999",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404

    def test_remove_item_non_owner_returns_403(self, test_user, second_user, test_podcast):
        _, token = test_user
        _, second_token = second_user
        resp = client.post(
            "/playlists/",
            json={"name": "Guarded"},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        client.post(
            f"/playlists/{playlist_id}/items",
            json={"podcast_id": test_podcast.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        response = client.delete(
            f"/playlists/{playlist_id}/items/{test_podcast.id}",
            headers={"Authorization": f"Bearer {second_token}"},
        )
        assert response.status_code == 403


class TestPlaylistItemOrdering:
    """Tests for item ordering within playlists."""

    def test_items_ordered_by_position(self, test_user, db_session):
        user, token = test_user
        # Create playlist
        resp = client.post(
            "/playlists/",
            json={"name": "Ordered Playlist"},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]

        # Create two additional podcasts
        podcast_a = crud.create_podcast(
            db_session,
            schemas.PodcastCreate(
                title="Podcast A", category="Tech", is_public=True,
                duration=100, audio_url="http://localhost:8000/media/audio/a.mp3",
            ),
            owner_id=user.id,
        )
        podcast_b = crud.create_podcast(
            db_session,
            schemas.PodcastCreate(
                title="Podcast B", category="Tech", is_public=True,
                duration=200, audio_url="http://localhost:8000/media/audio/b.mp3",
            ),
            owner_id=user.id,
        )

        # Add podcasts in order
        client.post(
            f"/playlists/{playlist_id}/items",
            json={"podcast_id": podcast_a.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        client.post(
            f"/playlists/{playlist_id}/items",
            json={"podcast_id": podcast_b.id},
            headers={"Authorization": f"Bearer {token}"},
        )

        # Fetch and verify order
        detail = client.get(
            f"/playlists/{playlist_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert detail.status_code == 200
        items = detail.json()["items"]
        assert len(items) == 2
        assert items[0]["podcast_id"] == podcast_a.id
        assert items[0]["position"] == 0
        assert items[1]["podcast_id"] == podcast_b.id
        assert items[1]["position"] == 1

    def test_remove_item_reorders_remaining(self, test_user, db_session):
        user, token = test_user
        resp = client.post(
            "/playlists/",
            json={"name": "Reorder Test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]

        # Create three podcasts
        podcasts = []
        for i in range(3):
            p = crud.create_podcast(
                db_session,
                schemas.PodcastCreate(
                    title=f"Reorder Pod {i}", category="Tech", is_public=True,
                    duration=60, audio_url=f"http://localhost:8000/media/audio/r{i}.mp3",
                ),
                owner_id=user.id,
            )
            podcasts.append(p)
            client.post(
                f"/playlists/{playlist_id}/items",
                json={"podcast_id": p.id},
                headers={"Authorization": f"Bearer {token}"},
            )

        # Remove the middle item (position 1)
        client.delete(
            f"/playlists/{playlist_id}/items/{podcasts[1].id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        # Verify remaining items re-ordered
        detail = client.get(
            f"/playlists/{playlist_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        items = detail.json()["items"]
        assert len(items) == 2
        assert items[0]["podcast_id"] == podcasts[0].id
        assert items[0]["position"] == 0
        assert items[1]["podcast_id"] == podcasts[2].id
        assert items[1]["position"] == 1


class TestPlaylistDetailWithPodcasts:
    """Tests verifying that playlist detail includes podcast data."""

    def test_detail_includes_podcast_info(self, test_user, test_podcast):
        _, token = test_user
        resp = client.post(
            "/playlists/",
            json={"name": "Detail Test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        client.post(
            f"/playlists/{playlist_id}/items",
            json={"podcast_id": test_podcast.id},
            headers={"Authorization": f"Bearer {token}"},
        )

        detail = client.get(
            f"/playlists/{playlist_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert detail.status_code == 200
        data = detail.json()
        assert data["item_count"] == 1
        assert len(data["items"]) == 1
        podcast_data = data["items"][0]["podcast"]
        assert podcast_data["title"] == "Test Podcast"
        assert podcast_data["id"] == test_podcast.id


class TestPlaylistPreviewThumbnails:
    """Tests for preview_thumbnails field in playlist list responses."""

    def test_empty_playlist_has_no_thumbnails(self, test_user):
        """A playlist with no items returns an empty preview_thumbnails list."""
        _, token = test_user
        resp = client.post(
            "/playlists/",
            json={"name": "Empty Playlist"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201

        listing = client.get(
            "/playlists/my",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert listing.status_code == 200
        playlists = listing.json()["playlists"]
        assert any(p["name"] == "Empty Playlist" for p in playlists)
        for p in playlists:
            if p["name"] == "Empty Playlist":
                assert p["preview_thumbnails"] == []

    def test_playlist_with_items_returns_thumbnails(self, test_user, test_podcast):
        """A playlist with podcasts that have thumbnails returns them in preview_thumbnails."""
        _, token = test_user

        # Give the podcast a thumbnail URL
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            from app import models as m
            pod = db.query(m.Podcast).filter(m.Podcast.id == test_podcast.id).first()
            pod.thumbnail_url = "http://example.com/thumb1.jpg"
            db.commit()
        finally:
            db.close()

        resp = client.post(
            "/playlists/",
            json={"name": "Mosaic Test Playlist"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        playlist_id = resp.json()["id"]

        client.post(
            f"/playlists/{playlist_id}/items",
            json={"podcast_id": test_podcast.id},
            headers={"Authorization": f"Bearer {token}"},
        )

        listing = client.get(
            "/playlists/my",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert listing.status_code == 200
        playlists = listing.json()["playlists"]
        target = next((p for p in playlists if p["name"] == "Mosaic Test Playlist"), None)
        assert target is not None
        assert "preview_thumbnails" in target
        assert "http://example.com/thumb1.jpg" in target["preview_thumbnails"]

    def test_preview_thumbnails_capped_at_four(self, test_user, db_session):
        """preview_thumbnails returns at most 4 URLs even if the playlist has more items."""
        user, token = test_user
        from app import crud as c, schemas as s, models as m

        # Create 6 podcasts with distinct thumbnails
        podcast_ids = []
        for i in range(6):
            pd = c.create_podcast(
                db_session,
                s.PodcastCreate(
                    title=f"Thumb Podcast {i}",
                    description="desc",
                    category="Technology",
                    is_public=True,
                    duration=60,
                    audio_url=f"http://localhost/audio/{i}.mp3",
                ),
                owner_id=user.id,
            )
            pd.thumbnail_url = f"http://example.com/img{i}.jpg"
            db_session.commit()
            podcast_ids.append(pd.id)

        resp = client.post(
            "/playlists/",
            json={"name": "Big Playlist"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        playlist_id = resp.json()["id"]

        for pid in podcast_ids:
            client.post(
                f"/playlists/{playlist_id}/items",
                json={"podcast_id": pid},
                headers={"Authorization": f"Bearer {token}"},
            )

        listing = client.get(
            "/playlists/my",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert listing.status_code == 200
        playlists = listing.json()["playlists"]
        target = next((p for p in playlists if p["name"] == "Big Playlist"), None)
        assert target is not None
        assert len(target["preview_thumbnails"]) == 4

    def test_podcasts_without_thumbnails_excluded(self, test_user, test_podcast):
        """Items whose podcast has no thumbnail_url are excluded from preview_thumbnails."""
        _, token = test_user

        # Ensure podcast has no thumbnail
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            from app import models as m
            pod = db.query(m.Podcast).filter(m.Podcast.id == test_podcast.id).first()
            pod.thumbnail_url = None
            db.commit()
        finally:
            db.close()

        resp = client.post(
            "/playlists/",
            json={"name": "No Thumb Playlist"},
            headers={"Authorization": f"Bearer {token}"},
        )
        playlist_id = resp.json()["id"]
        client.post(
            f"/playlists/{playlist_id}/items",
            json={"podcast_id": test_podcast.id},
            headers={"Authorization": f"Bearer {token}"},
        )

        listing = client.get(
            "/playlists/my",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert listing.status_code == 200
        playlists = listing.json()["playlists"]
        target = next((p for p in playlists if p["name"] == "No Thumb Playlist"), None)
        assert target is not None
        assert target["preview_thumbnails"] == []
