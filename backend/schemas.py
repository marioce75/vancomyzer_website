# NOTE: imports converted from relative to absolute for uvicorn main:app
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class Level(BaseModel):
    time_hr: float
    concentration_mg_L: float
    tag: Optional[str] = None


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

    # MIC (mg/L), default assumed 1.0
    mic_mg_L: Optional[float] = 1.0

    levels: List[Level] = []
    regimen: RegimenModel

    class Config:
        populate_by_name = True


class SeriesOut(BaseModel):
    time_hours: List[float]
    median: List[float]
    p05: List[float]
    p95: List[float]


class MetricsOut(BaseModel):
    auc_24: float
    predicted_peak: float
    predicted_trough: float
    auc24_over_mic: float


class PosteriorInfo(BaseModel):
    n_draws: int
    CL_median_L_per_h: Optional[float] = None
    V_median_L: Optional[float] = None


class DiagnosticPredictedLevel(BaseModel):
    t: float
    median: float
    p05: float
    p95: float


class DiagnosticsOut(BaseModel):
    predicted_levels: Optional[List[DiagnosticPredictedLevel]] = None
    rhat_ok: Optional[bool] = None


class InteractiveResponse(BaseModel):
    series: SeriesOut
    metrics: MetricsOut
    posterior: PosteriorInfo
    diagnostics: Optional[DiagnosticsOut] = None
