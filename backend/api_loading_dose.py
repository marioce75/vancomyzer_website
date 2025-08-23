from fastapi import APIRouter
from pydantic import BaseModel, Field
from . import pk

router = APIRouter()

class LDRequest(BaseModel):
    weight_kg: float = Field(ge=0)
    per_kg_mg: float = 25.0
    max_mg: float = 3000.0
    round_to_mg: float = 250.0

@router.post("/loading-dose")
def loading_dose(req: LDRequest):
    if not hasattr(pk, 'calculate_loading_dose'):
        # Fallback to local implementation matching frontend util
        weight_kg = float(req.weight_kg)
        per_kg_mg = max(0.0, float(req.per_kg_mg))
        max_mg = float(req.max_mg)
        round_to_mg = float(req.round_to_mg)
        raw = weight_kg * per_kg_mg
        capped = min(max_mg, raw)
        rounded = round(capped / round_to_mg) * round_to_mg
        return {
            'ld_mg': float(rounded),
            'raw_mg': float(raw),
            'per_kg_mg': float(per_kg_mg),
            'max_mg': float(max_mg),
            'round_to_mg': float(round_to_mg),
            'warning': 'capped_at_max' if capped < raw else None,
        }
    return pk.calculate_loading_dose(
        weight_kg=req.weight_kg,
        per_kg_mg=req.per_kg_mg,
        max_mg=req.max_mg,
        round_to_mg=req.round_to_mg,
    )
