from pathlib import Path
from typing import List

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.cost_engine import get_materials
from app.database import get_db
from app.models import UserMaterialRate
from app.auth import get_current_user_id

router = APIRouter(prefix="/materials", tags=["materials"])


class MaterialRateUpdate(BaseModel):
    material_id: str
    rate: float
    labor_rate: float

MATERIALS_DIR = Path(__file__).resolve().parents[1]


@router.get("")
def list_materials(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Get all materials with user's custom rates if available"""
    base_materials = get_materials()
    
    # Get user's custom rates
    custom_rates = db.query(UserMaterialRate).filter(
        UserMaterialRate.user_id == user_id
    ).all()
    
    # Create a map of custom rates
    custom_rate_map = {
        rate.material_id: {"rate": rate.rate, "labor_rate": rate.labor_rate}
        for rate in custom_rates
    }
    
    # Merge custom rates with base materials
    for material in base_materials:
        if material["id"] in custom_rate_map:
            material["rate"] = custom_rate_map[material["id"]]["rate"]
            material["labor_rate"] = custom_rate_map[material["id"]]["labor_rate"]
            material["is_custom"] = True
        else:
            material["is_custom"] = False
    
    return base_materials


@router.get("/thumb/{filename}")
def thumbnail(filename: str):
    path = MATERIALS_DIR / "materials" / "thumbs" / filename
    if not path.exists():
        raise HTTPException(404, "thumbnail not found")
    return FileResponse(path, media_type="image/png")


@router.get("/texture/{filename}")
def texture(filename: str):
    path = MATERIALS_DIR / "materials" / "textures" / filename
    if not path.exists():
        raise HTTPException(404, "texture not found")
    return FileResponse(path, media_type="image/png")


@router.put("/rates")
def update_material_rates(
    updates: List[MaterialRateUpdate],
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Update custom material rates for the current user"""
    # Validate all material IDs exist
    base_materials = get_materials()
    valid_ids = {m["id"] for m in base_materials}
    
    for update in updates:
        if update.material_id not in valid_ids:
            raise HTTPException(400, f"Invalid material_id: {update.material_id}")
        if update.rate < 0 or update.labor_rate < 0:
            raise HTTPException(400, "Rates must be positive numbers")
    
    # Update or insert custom rates
    for update in updates:
        existing = db.query(UserMaterialRate).filter(
            UserMaterialRate.user_id == user_id,
            UserMaterialRate.material_id == update.material_id
        ).first()
        
        if existing:
            existing.rate = update.rate
            existing.labor_rate = update.labor_rate
        else:
            db.add(UserMaterialRate(
                user_id=user_id,
                material_id=update.material_id,
                rate=update.rate,
                labor_rate=update.labor_rate
            ))
    
    db.commit()
    return {"ok": True, "updated": len(updates)}


@router.delete("/rates")
def reset_material_rates(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """Reset all material rates to defaults for the current user"""
    deleted = db.query(UserMaterialRate).filter(
        UserMaterialRate.user_id == user_id
    ).delete()
    db.commit()
    return {"ok": True, "reset": deleted}
