import pytest
import os
from pathlib import Path
from io import BytesIO
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User
from app import crud, schemas
from app.auth import create_access_token

client = TestClient(app)

# Test image creation helper (minimal JPEG bytes)
def create_test_image_bytes():
    """Create minimal valid JPEG bytes for testing"""
    # Minimal JPEG file header
    jpeg_header = bytes.fromhex('ffd8ffe000104a46494600010101006000600000ffdb004300')
    jpeg_footer = bytes.fromhex('ffd9')
    # Add some padding to make it a reasonable size
    jpeg_data = jpeg_header + b'\x00' * 500 + jpeg_footer
    return BytesIO(jpeg_data)

@pytest.fixture
def test_user():
    """Create a test user and return access token"""
    db = SessionLocal()
    try:
        # Clean up existing test user
        existing_user = db.query(User).filter(User.email == "phototest@test.com").first()
        if existing_user:
            db.delete(existing_user)
            db.commit()
        
        # Create test user
        user_create = schemas.UserCreate(
            email="phototest@test.com",
            name="Photo Test User",
            password="testpassword123"
        )
        user = crud.create_user(db, user_create)
        token = create_access_token(data={"sub": user.email})
        
        yield {"user": user, "token": token}
        
        # Cleanup
        db.delete(user)
        db.commit()
    finally:
        db.close()

class TestProfilePhotoUpload:
    """Test suite for profile photo upload endpoint"""
    
    def test_upload_valid_jpeg(self, test_user):
        """Test uploading a valid JPEG image"""
        token = test_user["token"]
        image_bytes = create_test_image_bytes()
        
        response = client.post(
            "/users/me/photo",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test.jpg", image_bytes, "image/jpeg")}
        )
        
        # Debug output
        if response.status_code != 200:
            print(f"\nError Response: {response.status_code}")
            print(f"Response Body: {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        assert "photo_url" in data
        assert data["photo_url"] is not None
        assert "/media/profile-photos/" in data["photo_url"]
    
    def test_upload_valid_png(self, test_user):
        """Test uploading a valid PNG image (simulated)"""
        token = test_user["token"]
        # Use same bytes but with PNG content type
        image_bytes = create_test_image_bytes()
        
        response = client.post(
            "/users/me/photo",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test.png", image_bytes, "image/png")}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "photo_url" in data
        assert "/media/profile-photos/" in data["photo_url"]
    
    def test_upload_invalid_file_type(self, test_user):
        """Test uploading an invalid file type"""
        token = test_user["token"]
        file_content = BytesIO(b"This is not an image")
        
        response = client.post(
            "/users/me/photo",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test.txt", file_content, "text/plain")}
        )
        
        assert response.status_code == 422
        assert "Unsupported file type" in response.json()["detail"]
    
    def test_upload_oversized_file(self, test_user):
        """Test uploading a file larger than 5MB"""
        token = test_user["token"]
        # Create a file larger than 5MB
        large_data = b'\x00' * (6 * 1024 * 1024)  # 6MB of zeros
        file_content = BytesIO(large_data)
        
        response = client.post(
            "/users/me/photo",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("large.jpg", file_content, "image/jpeg")}
        )
        
        # Should fail with 413 Request Entity Too Large
        assert response.status_code == 413
    
    def test_upload_without_authentication(self):
        """Test uploading without authentication token"""
        image_bytes = create_test_image_bytes()
        
        response = client.post(
            "/users/me/photo",
            files={"file": ("test.jpg", image_bytes, "image/jpeg")}
        )
        
        assert response.status_code == 401
    
    def test_upload_replaces_old_photo(self, test_user):
        """Test that uploading a new photo replaces the old one"""
        token = test_user["token"]
        
        # Upload first photo
        image_bytes1 = create_test_image_bytes()
        response1 = client.post(
            "/users/me/photo",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test1.jpg", image_bytes1, "image/jpeg")}
        )
        assert response1.status_code == 200
        old_photo_url = response1.json()["photo_url"]
        
        # Upload second photo
        image_bytes2 = create_test_image_bytes()
        response2 = client.post(
            "/users/me/photo",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test2.png", image_bytes2, "image/png")}
        )
        assert response2.status_code == 200
        new_photo_url = response2.json()["photo_url"]
        
        # URLs should be different
        assert old_photo_url != new_photo_url
    
    def test_file_saved_to_correct_directory(self, test_user):
        """Test that uploaded files are saved to media/profile-photos/"""
        token = test_user["token"]
        image_bytes = create_test_image_bytes()
        
        response = client.post(
            "/users/me/photo",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("test.jpg", image_bytes, "image/jpeg")}
        )
        
        assert response.status_code == 200
        photo_url = response.json()["photo_url"]
        
        # Extract filename from URL
        filename = photo_url.split("/")[-1]
        
        # Check file exists in expected directory
        media_dir = Path(__file__).parent.parent / "media" / "profile-photos"
        file_path = media_dir / filename
        
        assert file_path.exists(), f"File should exist at {file_path}"
        
        # Cleanup
        if file_path.exists():
            file_path.unlink()

if __name__ == "__main__":
    pytest.main([__file__, "-v"])

