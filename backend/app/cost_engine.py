import json
from pathlib import Path
from typing import Optional

MATERIALS_PATH = Path(__file__).parent / "materials.json"

OPENING_LABELS = {"window", "gate"}

_materials_cache: Optional[list[dict]] = None


def get_materials() -> list[dict]:
    global _materials_cache
    if _materials_cache is None:
        _materials_cache = json.loads(MATERIALS_PATH.read_text(encoding="utf-8"))
    return _materials_cache


def get_material(material_id: str) -> Optional[dict]:
    for m in get_materials():
        if m["id"] == material_id:
            return m
    return None


def shoelace_area(points: list[list[float]]) -> float:
    """Polygon area in pixel^2 (absolute value)."""
    n = len(points)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % n]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def point_in_poly(pt: list[float], poly: list[list[float]]) -> bool:
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > pt[1]) != (yj > pt[1]) and (
            pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi
        ):
            inside = not inside
        j = i
    return inside


def polygon_contains(inner: list[list[float]], outer: list[list[float]]) -> bool:
    """True if every vertex of `inner` lies inside `outer`."""
    if len(inner) < 3:
        return False
    return all(point_in_poly(pt, outer) for pt in inner)


def cutout_area_px(
    region: dict, all_regions: list[dict]
) -> float:
    """Total pixel area of other regions fully contained in this one."""
    total = 0.0
    for other in all_regions:
        if other is region:
            continue
        if polygon_contains(other["points"], region["points"]):
            total += shoelace_area(other["points"])
    return total


def ft_per_px(scale_ft: float, scale_px: float) -> float:
    """Feet represented by one pixel."""
    if not scale_px:
        return 0.0
    return scale_ft / scale_px


def estimate_region(
    label: str,
    points: list[list[float]],
    material_id: Optional[str],
    scale_ft: float,
    scale_px: float,
    cutout_area_px: float = 0.0,
) -> dict:
    """Quantity + material/labor cost for a single region."""
    material = get_material(material_id) if material_id else None
    area_px = max(0.0, shoelace_area(points) - cutout_area_px)
    fpp = ft_per_px(scale_ft, scale_px)
    area_ft = area_px * (fpp**2)

    result = {
        "label": label,
        "material_id": material_id,
        "material_name": material["name"] if material else None,
        "area_sqft": round(area_ft, 1),
        "area_px": round(area_px, 1),
        "quantity": 0.0,
        "unit": "",
        "rate": 0.0,
        "wastage": 0.0,
        "material_cost": 0.0,
        "labor_cost": 0.0,
        "total_cost": 0.0,
    }

    if material is None or fpp <= 0:
        return result

    if material["unit"] == "ft":
        quantity = round(area_ft**0.5, 2)  # running feet ~ square-side approx
    elif material["unit"] == "pieces":
        quantity = round(area_ft / material["coverage_sqft_per_unit"], 2)
    else:
        quantity = round(area_ft, 2)

    qty_wastage = quantity * (1 + material["wastage"])
    material_cost = qty_wastage * material["rate"]
    labor_cost = area_ft * material["labor_rate"]

    result.update(
        quantity=round(qty_wastage, 2),
        unit=material["unit"],
        rate=material["rate"],
        wastage=material["wastage"],
        material_cost=round(material_cost, 2),
        labor_cost=round(labor_cost, 2),
        total_cost=round(material_cost + labor_cost, 2),
    )
    return result


def estimate_project(
    regions: list[dict], scale_ft: float, scale_px: float
) -> dict:
    lines = [
        estimate_region(
            r["label"],
            r["points"],
            None if r["label"] in OPENING_LABELS else r.get("material_id"),
            scale_ft,
            scale_px,
            cutout_area_px(r, regions),
        )
        for r in regions
    ]
    total_material = round(sum(l["material_cost"] for l in lines), 2)
    total_labor = round(sum(l["labor_cost"] for l in lines), 2)
    return {
        "regions": lines,
        "totals": {
            "material": total_material,
            "labor": total_labor,
            "grand_total": round(total_material + total_labor, 2),
        },
    }
