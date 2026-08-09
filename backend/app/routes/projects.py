from datetime import datetime, timezone
import io
import json
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from PIL import Image
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.core.config import settings
from app.models import Project, Region, ChatMessage, Report
from app.schemas import SaveProjectPayload, RenamePayload, ChatPayload
from app.cost_engine import OPENING_LABELS, estimate_project, get_material
from app import gemini_service, openai_service, llm_report_service
from app.supabase_storage import storage
from app.auth import get_current_user_id, get_user_project

router = APIRouter(prefix="/projects", tags=["projects"])

ALLOWED = {"jpg", "jpeg", "png", "webp"}


def _is_blurry(data: bytes) -> bool:
    """Return True if the photo is heavily out of focus (very low edge variance)."""
    try:
        with Image.open(io.BytesIO(data)) as im:
            im = im.convert("L")
            im.thumbnail((128, 128))
            w, h = im.size
            px = im.load()
        values = []
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                v = px[x - 1, y] + px[x + 1, y] + px[x, y - 1] + px[x, y + 1] - 4 * px[x, y]
                values.append(v)
        if not values:
            return False
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        return variance < 4
    except Exception:
        return False


def _save_upload(file: UploadFile) -> str:
    """Save uploaded file to Supabase Storage (production) or local (fallback)."""
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED:
        raise HTTPException(400, "Only jpg/png/webp images are allowed")
    data = file.file.read()
    if len(data) < 10_000:
        raise HTTPException(400, "Image is too small - upload a clear photo")
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(400, "Image is too large (max 15MB)")

    # Verify it's a valid image
    try:
        with Image.open(io.BytesIO(data)) as im:
            im.verify()
        with Image.open(io.BytesIO(data)) as im:
            width, height = im.size
    except Exception:
        raise HTTPException(400, "File is not a valid image")

    # Quality gate: reject low-resolution and blurry photos
    if min(width, height) < 480:
        raise HTTPException(
            400,
            f"This photo is too small ({width}x{height}px). Please upload a clearer, higher-resolution photo of your house exterior.",
        )
    if _is_blurry(data):
        raise HTTPException(
            400,
            "This photo looks blurry or out of focus. Please upload a sharp, clear photo of your house exterior.",
        )

    # Use Supabase Storage (production) or local filesystem (development)
    if storage:
        # Production: Upload to Supabase Storage
        try:
            content_type = f"image/{ext}" if ext != "jpg" else "image/jpeg"
            url = storage.upload_image(data, file.filename, content_type)
            return url
        except Exception as e:
            raise HTTPException(500, f"Failed to upload image: {str(e)}")
    else:
        # Development fallback: Local filesystem
        name = f"{uuid.uuid4().hex}.{ext}"
        path = settings.upload_path / name
        path.write_bytes(data)
        return path.as_posix()


def _materials_summary(p: Project) -> str:
    parts = []
    for r in p.regions:
        mat = get_material(r.material_id) if r.material_id else None
        parts.append(f"{r.label}: {mat['name'] if mat else 'no material'}")
    return ", ".join(parts)


def _persist_msg(db: Session, project_id: int, role: str, content: str):
    db.add(
        ChatMessage(
            project_id=project_id,
            role=role,
            content=content,
        )
    )
    db.commit()


@router.post("")
def create_project(
    file: UploadFile = File(...),
    name: str = Form(None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    path = _save_upload(file)
    project = Project(
        user_id=user_id,
        name=name or "Untitled Project",
        original_image=path,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return {"id": project.id, "original_image": path, "name": project.name}


@router.get("")
def list_projects(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    projects = (
        db.query(Project)
        .filter(Project.user_id == user_id)
        .order_by(Project.id.desc())
        .all()
    )
    return [
        {
            "id": p.id,
            "name": p.name or "Untitled Project",
            "created_at": p.created_at,
            "region_count": len(p.regions),
            "has_generated": bool(p.generated_image),
        }
        for p in projects
    ]


@router.get("/{project_id}")
def get_project(p: Project = Depends(get_user_project)):
    return {
        "id": p.id,
        "name": p.name or "Untitled Project",
        "original_image": p.original_image,
        "generated_image": p.generated_image,
        "scale_ft": p.scale_ft,
        "scale_px": p.scale_px,
        "reference_note": p.reference_note,
        "texture_scale": p.texture_scale,
        "regions": [
            {
                "id": r.id,
                "label": r.label,
                "points": r.points,
                "material_id": r.material_id,
            }
            for r in p.regions
        ],
    }


@router.patch("/{project_id}")
def rename_project(
    payload: RenamePayload,
    p: Project = Depends(get_user_project),
    db: Session = Depends(get_db),
):
    p.name = payload.name
    db.commit()
    return {"ok": True}


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    p: Project = Depends(get_user_project),
    db: Session = Depends(get_db),
):
    files = [p.original_image, p.generated_image]
    db.query(ChatMessage).filter(ChatMessage.project_id == project_id).delete()
    db.delete(p)
    db.commit()
    for f in files:
        if f:
            Path(f).unlink(missing_ok=True)
    return {"ok": True}


@router.put("/{project_id}")
def save_project(
    project_id: int,
    payload: SaveProjectPayload,
    p: Project = Depends(get_user_project),
    db: Session = Depends(get_db),
):
    # Lock the project row so concurrent save requests serialize. Without this,
    # two overlapping saves (autosave + manual save) each do DELETE+INSERT and
    # can leave BOTH batches in the DB, duplicating every region.
    locked = (
        db.query(Project)
        .filter(Project.id == p.id)
        .with_for_update()
        .one()
    )

    locked.scale_ft = payload.scale_ft
    locked.scale_px = payload.scale_px
    locked.reference_note = payload.reference_note
    locked.texture_scale = payload.texture_scale

    db.query(Region).filter(Region.project_id == project_id).delete()
    for r in payload.regions:
        db.add(
            Region(
                project_id=project_id,
                label=r.label,
                points=r.points,
                material_id=(
                    None if r.label in OPENING_LABELS else r.material_id
                ),
            )
        )
    db.commit()
    return {"ok": True}


@router.post("/{project_id}/estimate")
def estimate(
    payload: SaveProjectPayload,
    p: Project = Depends(get_user_project),
):
    if not payload.scale_px or not payload.scale_ft:
        raise HTTPException(400, "Set a reference measurement first")
    regions = [
        {
            "label": r.label,
            "points": r.points,
            "material_id": r.material_id,
        }
        for r in payload.regions
    ]
    return estimate_project(regions, payload.scale_ft, payload.scale_px)


@router.post("/{project_id}/report")
def report(
    payload: SaveProjectPayload,
    p: Project = Depends(get_user_project),
    db: Session = Depends(get_db),
):
    project_id = p.id
    
    # Save user request to chat
    _persist_msg(db, project_id, "user", "Generate detailed cost report with images")
    
    if not payload.scale_px or not payload.scale_ft:
        raise HTTPException(400, "Set a reference measurement first")
    regions = [
        {
            "label": r.label,
            "points": r.points,
            "material_id": r.material_id,
        }
        for r in payload.regions
    ]
    engine = estimate_project(regions, payload.scale_ft, payload.scale_px)

    project_data = {
        "project_name": p.name or "Untitled Project",
        "scale_ft": payload.scale_ft,
        "scale_px": payload.scale_px,
        "regions": [
            {
                "label": r["label"],
                "material_name": r["material_name"],
                "area_sqft": r["area_sqft"],
                "quantity": r["quantity"],
                "unit": r["unit"],
                "material_cost": r["material_cost"],
                "labor_cost": r["labor_cost"],
                "total_cost": r["total_cost"],
            }
            for r in engine["regions"]
        ],
        "totals": engine["totals"],
    }
    llm = gemini_service.analyze_costs(project_data, engine)
    if llm is None:
        llm = {
            "summary": (
                "AI cost analysis is temporarily unavailable, so this report shows "
                "the measurement-engine estimate only."
            ),
            "approx_material_cost": engine["totals"]["material"],
            "approx_labor_cost": engine["totals"]["labor"],
            "approx_total": engine["totals"]["grand_total"],
            "notes": [],
        }

    # Generate complete HTML report using LLM
    try:
        html = llm_report_service.generate_llm_report(
            project_name=p.name or "Untitled Project",
            scale_ft=payload.scale_ft,
            scale_px=payload.scale_px,
            regions=engine["regions"],
            totals=engine["totals"],
            original_image_path=p.original_image,
            generated_image_path=p.generated_image,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"⚠️ **Report Generation Failed**\n\n{str(e)}\n\nPlease check your API configuration and try again."
        )
    
    # Convert images to data URLs for frontend preview
    try:
        original_image_url = llm_report_service.image_to_data_url(p.original_image)
    except Exception:
        original_image_url = None
    generated_image_url = None
    if p.generated_image:
        try:
            generated_image_url = llm_report_service.image_to_data_url(p.generated_image)
        except Exception:
            pass
    
    # Save success message to chat
    has_generated = "✅" if generated_image_url else "📝"
    gen_status = "AI-generated realistic renovation" if generated_image_url else "Placeholder (generate AI image first)"
    success_msg = f"""✅ **Professional Report Generated!**

**📄 Your report includes:**
✅ Original house photo
{has_generated} {gen_status}
💰 ₹{engine['totals']['grand_total']:,.0f} total cost estimate
📊 Complete material & labor breakdown
🤖 AI-powered cost analysis
💡 Professional recommendations

**✨ Report is ready to download!**"""
    
    _persist_msg(db, project_id, "assistant", success_msg)
    
    # Save report to reports table (stores ALL reports)
    report_title = f"Report - {datetime.now(timezone.utc).strftime('%d %b %Y, %I:%M %p')}"
    new_report = Report(
        project_id=project_id,
        title=report_title,
        html_content=html,
        report_data={
            "engine": engine,
            "llm": llm,
            "original_image": original_image_url,
            "generated_image": generated_image_url,
        }
    )
    db.add(new_report)
    
    # Also update last_report fields for backward compatibility
    p.last_report_html = html
    p.last_report_data = json.dumps({
        "engine": engine,
        "llm": llm,
        "original_image": original_image_url,
        "generated_image": generated_image_url,
    })
    db.commit()
    
    return {
        "report_id": new_report.id,
        "engine": engine,
        "llm": llm,
        "original_image": original_image_url,
        "generated_image": generated_image_url,
        "html": html,
    }


@router.get("/{project_id}/reports")
def list_reports(
    p: Project = Depends(get_user_project),
    db: Session = Depends(get_db),
):
    """List all reports for a project (latest first)"""
    reports = db.query(Report).filter(
        Report.project_id == p.id
    ).order_by(Report.created_at.desc()).all()
    
    return {
        "reports": [
            {
                "id": r.id,
                "title": r.title,
                "created_at": r.created_at.isoformat(),
            }
            for r in reports
        ]
    }


@router.get("/{project_id}/reports/{report_id}")
def get_report(
    report_id: int,
    p: Project = Depends(get_user_project),
    db: Session = Depends(get_db),
):
    """Get a specific report by ID"""
    report = db.query(Report).filter(
        Report.id == report_id,
        Report.project_id == p.id
    ).first()
    
    if not report:
        raise HTTPException(404, "Report not found")
    
    return {
        "id": report.id,
        "title": report.title,
        "created_at": report.created_at.isoformat(),
        "engine": report.report_data.get("engine"),
        "llm": report.report_data.get("llm"),
        "original_image": report.report_data.get("original_image"),
        "generated_image": report.report_data.get("generated_image"),
        "html": report.html_content,
    }


@router.delete("/{project_id}/reports/{report_id}")
def delete_report(
    report_id: int,
    p: Project = Depends(get_user_project),
    db: Session = Depends(get_db),
):
    """Delete a specific report"""
    report = db.query(Report).filter(
        Report.id == report_id,
        Report.project_id == p.id
    ).first()
    
    if not report:
        raise HTTPException(404, "Report not found")
    
    db.delete(report)
    db.commit()
    
    return {"ok": True}


@router.get("/{project_id}/chat")
def chat_history(
    project_id: int,
    p: Project = Depends(get_user_project),
    db: Session = Depends(get_db),
):
    msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.project_id == project_id)
        .order_by(ChatMessage.id)
        .all()
    )
    return [{"role": m.role, "content": m.content} for m in msgs]


@router.post("/{project_id}/chat")
def chat(
    project_id: int,
    payload: ChatPayload,
    p: Project = Depends(get_user_project),
    db: Session = Depends(get_db),
):
    context = gemini_service.build_project_context(p, p.regions)
    _persist_msg(db, project_id, "user", payload.message)
    try:
        reply = gemini_service.chat(context, payload.message)
        llm_available = True
    except RuntimeError as e:
        reply, llm_available = f"AI chat unavailable: {e}", False
    except Exception as e:
        reply, llm_available = f"AI chat error: {e}", False
    _persist_msg(db, project_id, "assistant", reply)
    return {"reply": reply, "llm_available": llm_available}


def _sse(obj) -> str:
    return f"data: {json.dumps(obj)}\n\n"


@router.post("/{project_id}/chat/stream")
def chat_stream(
    project_id: int,
    payload: ChatPayload,
    p: Project = Depends(get_user_project),
    db: Session = Depends(get_db),
):
    context = gemini_service.build_project_context(p, p.regions)
    _persist_msg(db, project_id, "user", payload.message)

    def gen():
        full = []
        gemini_failed = False
        try:
            for piece in gemini_service.chat_stream(context, payload.message):
                full.append(piece)
                yield _sse({"type": "delta", "text": piece})
            yield _sse({"type": "done"})
        except RuntimeError as e:
            gemini_failed = True
            error_msg = str(e)
            # Try OpenAI as fallback
            try:
                fallback_response = openai_service.chat_fallback(context, payload.message)
                if fallback_response:
                    full = [fallback_response]
                    yield _sse({"type": "delta", "text": fallback_response})
                    yield _sse({"type": "done"})
                    gemini_failed = False
                else:
                    yield _sse({"type": "error", "text": "🤖 AI chat temporarily unavailable. Both Gemini and OpenAI are not configured."})
            except Exception:
                yield _sse({"type": "error", "text": "🤖 AI chat temporarily unavailable. Please try again in a few moments."})
        except Exception as e:
            gemini_failed = True
            error_str = str(e)
            
            # Parse user-friendly error message
            if "RESOURCE_EXHAUSTED" in error_str or "quota" in error_str.lower():
                user_msg = "⏱️ **API Rate Limit Reached**\n\nGemini API quota exceeded. Please wait a few minutes or add OpenAI API key as backup.\n\n💡 **Solutions:**\n- Wait 5-10 minutes and try again\n- Add `OPENAI_API_KEY` to `.env` for automatic fallback\n- Upgrade Gemini API quota at https://ai.google.dev"
            elif "429" in error_str:
                user_msg = "⏱️ **Too Many Requests**\n\nPlease wait a moment before sending another message."
            elif "401" in error_str or "unauthorized" in error_str.lower():
                user_msg = "🔑 **API Key Invalid**\n\nPlease check your Gemini API key configuration."
            else:
                user_msg = f"⚠️ **AI Error**\n\nSomething went wrong. Please try again.\n\n_Technical details: {error_str[:200]}_"
            
            # Try OpenAI fallback
            try:
                fallback_response = openai_service.chat_fallback(context, payload.message)
                if fallback_response:
                    full = [fallback_response]
                    yield _sse({"type": "delta", "text": fallback_response})
                    yield _sse({"type": "done"})
                    gemini_failed = False
            except Exception:
                pass
            
            if gemini_failed:
                yield _sse({"type": "error", "text": user_msg})
        finally:
            if full:
                session = SessionLocal()
                try:
                    session.add(
                        ChatMessage(
                            project_id=project_id,
                            role="assistant",
                            content="".join(full),
                        )
                    )
                    session.commit()
                finally:
                    session.close()

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/{project_id}/generate")
def generate(
    payload: Optional[schemas.GenerateImagePayload] = None,
    p: Project = Depends(get_user_project),
    db: Session = Depends(get_db),
):
    project_id = p.id
    # Tolerate requests without a body (older clients) and avoid parsing errors
    user_prefs = (payload.user_preferences if payload else "") or ""
    
    # Save user request to chat
    user_msg = "Generate realistic renovation image with my selected materials"
    if user_prefs.strip():
        user_msg += f"\n\nMy design preferences: {user_prefs.strip()}"
    _persist_msg(db, project_id, "user", user_msg)
    
    summary = _materials_summary(p)
    if not summary:
        raise HTTPException(400, "Tag regions and apply materials first")
    try:
        out = openai_service.generate_renovation(p.original_image, summary, user_prefs)
    except RuntimeError:
        out = None  # no OpenAI key configured - fall through to Gemini
    except Exception as e:
        raise HTTPException(503, f"OpenAI image generation failed: {e}")
    if out is None:
        try:
            out = gemini_service.generate_renovation(p.original_image, summary, user_prefs)
        except RuntimeError as e:
            raise HTTPException(503, f"Image generation unavailable: {e}")
        except Exception as e:
            raise HTTPException(503, f"Image generation failed: {e}")
    if out is None:
        raise HTTPException(502, "Image service returned no image")
    p.generated_image = out
    db.commit()
    
    # Save success message to chat
    success_msg = f"""✅ Renovation image generated successfully!

![Generated]({out})

**View options:**
- Click "AI Renovated" or "Compare" tab above
- Generate cost report to include this in your PDF"""
    
    _persist_msg(db, project_id, "assistant", success_msg)
    
    return {"generated_image": out}


@router.get("/{project_id}/image")
def serve_image(p: Project = Depends(get_user_project)):
    """Serve image - redirect to Supabase URL or serve local file."""
    from fastapi.responses import RedirectResponse
    
    image_path = p.generated_image or p.original_image
    
    # If it's a URL (Supabase Storage), redirect to it
    if image_path.startswith("http://") or image_path.startswith("https://"):
        return RedirectResponse(url=image_path)
    
    # Otherwise, serve from local filesystem (development only)
    return FileResponse(image_path)
