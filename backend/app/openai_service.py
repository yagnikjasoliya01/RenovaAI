from pathlib import Path
from typing import Optional

from app.core.config import settings

MODEL_IMAGE_EDIT = "gpt-image-1"
MODEL_CHAT = "gpt-4o-mini"


def _client():
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY not set in backend/.env")
    from openai import OpenAI

    return OpenAI(api_key=settings.openai_api_key)


def generate_renovation(image_path: str, materials_summary: str, user_preferences: str = "") -> Optional[str]:
    """Edit the photo via OpenAI gpt-image-1. Returns Supabase URL or local path."""
    from app.supabase_storage import storage
    import base64
    import uuid
    import httpx
    
    client = _client()
    
    # Handle both URLs (Supabase) and local paths
    if image_path.startswith("http://") or image_path.startswith("https://"):
        # Download image from URL
        with httpx.Client() as http_client:
            response = http_client.get(image_path, timeout=30.0)
            image_bytes = response.content
            temp_path = settings.upload_path / f"temp_{uuid.uuid4().hex}.jpg"
            temp_path.write_bytes(image_bytes)
            path = temp_path
    else:
        # Local file
        path = Path(image_path)
        if not path.exists():
            return None

    prompt = (
        "Renovate the ENTIRE house exterior in this photo - not just specific areas. "
        "Apply the selected materials to tagged areas and intelligently extend the design to the whole house for a cohesive look. "
        "PRESERVE exact building structure, windows, doors. Materials selected:\n" + materials_summary
    )
    
    if user_preferences and user_preferences.strip():
        prompt += f"\n\nUser's design preferences: {user_preferences.strip()}"

    with path.open("rb") as f:
        resp = client.images.edit(
            model=MODEL_IMAGE_EDIT,
            image=f,
            prompt=prompt,
            n=1,
            size="auto",
            output_format="png",
        )

    # Clean up temp file if created
    if image_path.startswith("http"):
        path.unlink(missing_ok=True)

    if not resp.data:
        return None
    b64 = resp.data[0].b64_json
    if not b64:
        return None

    image_bytes = base64.b64decode(b64)
    
    # Upload to Supabase Storage (production) or save locally (development)
    if storage:
        try:
            url = storage.upload_image(
                image_bytes,
                f"generated_{uuid.uuid4().hex}.png",
                "image/png"
            )
            return url
        except Exception as e:
            print(f"Failed to upload to Supabase: {e}")
            # Fallback to local
            pass
    
    # Development fallback: Save locally
    out = settings.upload_path / f"generated_{path.stem}.png"
    out.write_bytes(image_bytes)
    return out.as_posix()


def chat_fallback(context: str, message: str) -> Optional[str]:
    """
    Fallback chat using OpenAI when Gemini fails.
    Returns response text or None if OpenAI is not available.
    """
    if not settings.openai_api_key:
        return None
    
    try:
        client = _client()
        
        response = client.chat.completions.create(
            model=MODEL_CHAT,
            messages=[
                {
                    "role": "system",
                    "content": f"You are RenovaAI, a helpful assistant for home exterior renovation planning.\n\nProject Context:\n{context}"
                },
                {
                    "role": "user",
                    "content": message
                }
            ],
            max_tokens=500,
            temperature=0.7
        )
        
        if response.choices and response.choices[0].message:
            return response.choices[0].message.content
        
        return None
    except Exception:
        return None
