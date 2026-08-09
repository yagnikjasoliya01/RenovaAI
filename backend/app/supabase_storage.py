"""
Supabase Storage integration for production-ready image storage.
Replaces local filesystem storage with cloud storage.
"""
import os
import uuid
from typing import Optional
from pathlib import Path
import httpx
from app.core.config import settings


class SupabaseStorage:
    """Handle image uploads to Supabase Storage."""
    
    def __init__(self):
        self.url = settings.supabase_url
        self.service_key = settings.supabase_service_key
        self.bucket_name = "renovaai-images"
        
        if not self.url or not self.service_key:
            raise RuntimeError("Supabase credentials not configured")
        
        # Clean URL (remove trailing slash)
        self.url = self.url.rstrip('/')
        self.storage_url = f"{self.url}/storage/v1"
    
    def upload_image(self, file_bytes: bytes, filename: str, content_type: str = "image/jpeg") -> str:
        """
        Upload image to Supabase Storage.
        
        Args:
            file_bytes: Image file bytes
            filename: Original filename
            content_type: MIME type
            
        Returns:
            Public URL of uploaded image
        """
        # Generate unique filename
        ext = Path(filename).suffix or '.jpg'
        unique_filename = f"{uuid.uuid4()}{ext}"
        
        # Upload to Supabase Storage
        upload_url = f"{self.storage_url}/object/{self.bucket_name}/{unique_filename}"
        
        headers = {
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": content_type,
        }
        
        with httpx.Client() as client:
            response = client.post(
                upload_url,
                content=file_bytes,
                headers=headers,
                timeout=30.0
            )
            
            if response.status_code not in [200, 201]:
                raise Exception(f"Failed to upload to Supabase: {response.text}")
        
        # Return public URL using /render/image/ endpoint (has CORS enabled by default)
        # This endpoint is better for images as it:
        # 1. Has CORS enabled automatically
        # 2. Optimizes image delivery
        # 3. Works with Canvas without CORS configuration
        # format=origin & quality=100 force original quality (no WebP re-encode/loss)
        public_url = f"{self.url}/storage/v1/render/image/public/{self.bucket_name}/{unique_filename}?format=origin&quality=100"
        return public_url
    
    def delete_image(self, url: str) -> bool:
        """
        Delete image from Supabase Storage.
        
        Args:
            url: Full public URL of image
            
        Returns:
            True if successful
        """
        try:
            # Extract filename from URL
            # URL format: https://xxx.supabase.co/storage/v1/object/public/bucket/filename.jpg
            parts = url.split(f"/{self.bucket_name}/")
            if len(parts) != 2:
                return False
            
            filename = parts[1]
            
            delete_url = f"{self.storage_url}/object/{self.bucket_name}/{filename}"
            
            headers = {
                "Authorization": f"Bearer {self.service_key}",
            }
            
            with httpx.Client() as client:
                response = client.delete(delete_url, headers=headers, timeout=10.0)
                return response.status_code in [200, 204]
                
        except Exception as e:
            print(f"Failed to delete image: {e}")
            return False


# Global instance
try:
    storage = SupabaseStorage()
except RuntimeError:
    # Fallback to local storage if Supabase not configured (development only)
    storage = None
    print("WARNING: Supabase Storage not configured, using local storage (development only)")
