from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class Level(BaseModel):
    time_hr: float
    concentration_mg_L: float


class RegimenModel(BaseModel):
    dose_mg: float
    interval_hours: float
    infusion_minutes: float


class InteractiveRequest(BaseModel):
    # Patient covariates (flat)
    population_type: Optional[str] = None
    age_years: Optional[float] = Field(default=None, alias='age')
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None

    # Serum creatinine in mg/dL (accept multiple aliases)
    serum_creatinine_mg_dl: Optional[float] = None
    serum_creatinine: Optional[float] = None

    # Optionally, client-supplied creatinine clearance (mL/min)
    clcr_ml_min: Optional[float] = None

    levels: List[Level] = []
    regimen: RegimenModel

    class Config:
        populate_by_name = True


class Series(BaseModel):
    time_hours: List[float]
    concentration_mg_L: List[float]
    lower: Optional[List[float]] = None
    upper: Optional[List[float]] = None


class PosteriorInfo(BaseModel):
    n_draws: int


class DebugPredictedLevel(BaseModel):
    time_hr: float
    median: float
    p05: float
    p95: float


class InteractiveResponse(BaseModel):
    series: Series
    auc_24: float
    predicted_trough: float
    predicted_peak: float
    posterior: PosteriorInfo
    debug: Optional[dict] = None
