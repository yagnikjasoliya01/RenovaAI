import base64
import json
import uuid
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.cost_engine import get_material

MODEL_TEXT = "gemini-3.5-flash"
MODEL_IMAGE = "gemini-3.1-flash-image"
MODEL_IMAGE_FALLBACK = "gemini-2.5-flash-image"

CHAT_PROMPT = """You are "RenovaAI", a helpful assistant for planning home exterior renovation.
Use the project context below (image, tagged regions, chosen materials, measurements) to answer
the homeowner's question with practical advice on materials, colors, durability and rough cost.
If the user asks you to generate an image, tell them to press the "Generate renovated image" button.
Keep answers under 150 words.

PROJECT CONTEXT:
{context}

USER: {message}"""

GENERATE_PROMPT_TEMPLATE = """You are an expert architectural visualization AI. Transform this ENTIRE house exterior photo to show a complete, realistic renovation.

SELECTED MATERIALS FOR SPECIFIC AREAS:
{materials}

{user_preferences}

CRITICAL INSTRUCTIONS:
1. RENOVATE THE ENTIRE HOUSE - not just the areas with materials selected
   - The homeowner selected materials for some specific areas (walls, balconies, etc.)
   - Apply these materials to those areas as specified
   - For unmarked/untagged areas: intelligently extend the design to create a cohesive, beautiful whole-house renovation
   - Match colors, styles, and aesthetics across the entire building

2. PRESERVE exact building structure, dimensions, windows, doors, architectural features

3. CREATIVE INTELLIGENCE:
   - Use selected materials as the design foundation
   - Extend color palette and style to entire facade
   - Add complementary trim, accents, or finishing touches
   - Ensure visual harmony between tagged and untagged areas
   - Make the entire house look professionally designed and coordinated

4. REALISM:
   - Apply proper textures, lighting, shadows
   - Maintain original photo's perspective and lighting conditions
   - Create a professional architectural rendering quality result

5. RESULT: A complete, photorealistic whole-house renovation that looks achievable and impressive - ready to show contractors.

Generate the FULL HOUSE renovation now."""

COST_PROMPT = """You are the cost analyst for "RenovaAI", a home-exterior renovation planning tool.
The homeowner uploaded a photo, tagged regions (wall, window, balcony, ...) and our measurement engine
computed quantities, areas and costs from the reference measurement and our material catalog.

Below you get the ENGINE ESTIMATE (precise, based on tagged regions and measurements) and the raw
PROJECT DATA (regions, materials, areas).

YOUR JOB:
1. Review the plan for completeness and realism (e.g. missing windows, unusual areas).
2. Independently estimate an APPROXIMATE cost using realistic market rates.
3. In notes, give 2-4 concise practical tips (red flags, missing materials, savings).

Respond ONLY with JSON matching the response schema exactly:
- summary: 2-3 sentences a homeowner can understand (scope + approximate total).
- approx_material_cost: your material cost estimate in INR (number).
- approx_labor_cost: your labor cost estimate in INR (number).
- approx_total: approx_material_cost + approx_labor_cost (number).
- notes: array of 2-4 short strings.

PROJECT DATA:
{project_data}

ENGINE ESTIMATE:
{engine_estimate}"""


def _client():
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY not set in backend/.env")
    from google import genai

    return genai.Client(api_key=settings.gemini_api_key)


def build_project_context(project, regions) -> str:
    lines = [f"Project: {project.name or 'Untitled'}"]
    lines.append(f"Image file: {Path(project.original_image).name}")
    if project.scale_px:
        lines.append(
            f"Reference measurement: {project.scale_ft} ft drawn over {project.scale_px} px"
        )
    if regions:
        for r in regions:
            mat = get_material(r.material_id) if r.material_id else None
            mat_txt = f"material={mat['name']}" if mat else "no material selected"
            lines.append(f"- Region '{r.label}': {mat_txt}")
    else:
        lines.append("No regions tagged yet (user has not marked walls/windows/balconies).")
    return "\n".join(lines)


def chat(context: str, message: str) -> str:
    client = _client()
    prompt = CHAT_PROMPT.format(context=context, message=message)
    resp = client.models.generate_content(model=MODEL_TEXT, contents=prompt)
    return resp.text or ""


def chat_stream(context: str, message: str):
    """Yield text chunks from the model as they are generated."""
    client = _client()
    prompt = CHAT_PROMPT.format(context=context, message=message)
    resp = client.models.generate_content_stream(
        model=MODEL_TEXT, contents=prompt
    )
    for chunk in resp:
        text = chunk.text
        if text:
            yield text


def generate_renovation(image_path: str, materials_summary: str, user_preferences: str = "") -> Optional[str]:
    """Generate renovated image. Returns Supabase URL or local path."""
    from app.supabase_storage import storage
    import io
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

    ref = client.files.upload(file=path)
    
    # Add user preferences to prompt if provided
    preferences_text = ""
    if user_preferences and user_preferences.strip():
        preferences_text = f"\nUSER'S DESIGN PREFERENCES:\n{user_preferences.strip()}\n(Consider these preferences while maintaining the material selections above)"
    
    prompt = GENERATE_PROMPT_TEMPLATE.format(
        materials=materials_summary,
        user_preferences=preferences_text
    )

    from google.genai import types

    try:
        resp = client.models.generate_content(
            model=MODEL_IMAGE,
            contents=[ref, prompt],
            config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
        )
    except Exception:
        resp = client.models.generate_content(
            model=MODEL_IMAGE_FALLBACK,
            contents=[ref, prompt],
            config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
        )

    # Clean up temp file if created
    if image_path.startswith("http"):
        path.unlink(missing_ok=True)

    if not resp.candidates:
        return None
    part = resp.candidates[0].content.parts[0]
    data = getattr(part, "inline_data", None)
    if data is None:
        return None

    image_bytes = base64.b64decode(data.data)
    
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


def analyze_costs(project_data: dict, engine_estimate: dict) -> Optional[dict]:
    """Independent LLM cost analysis. Returns dict or None if unavailable."""
    client = _client()
    schema = {
        "type": "OBJECT",
        "properties": {
            "summary": {"type": "string"},
            "approx_material_cost": {"type": "number"},
            "approx_labor_cost": {"type": "number"},
            "approx_total": {"type": "number"},
            "notes": {"type": "ARRAY", "items": {"type": "string"}},
        },
        "required": [
            "summary",
            "approx_material_cost",
            "approx_labor_cost",
            "approx_total",
            "notes",
        ],
    }
    prompt = COST_PROMPT.format(
        project_data=json.dumps(project_data, indent=2),
        engine_estimate=json.dumps(engine_estimate, indent=2),
    )
    try:
        from google.genai import types

        resp = client.models.generate_content(
            model=MODEL_TEXT,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema,
                temperature=0.4,
            ),
        )
        data = json.loads(resp.text)
        return {
            "summary": str(data.get("summary", "")),
            "approx_material_cost": float(data.get("approx_material_cost", 0)),
            "approx_labor_cost": float(data.get("approx_labor_cost", 0)),
            "approx_total": float(data.get("approx_total", 0)),
            "notes": [str(n) for n in (data.get("notes") or [])],
        }
    except Exception:
        return None
