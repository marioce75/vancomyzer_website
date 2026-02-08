from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class DoseEvent(BaseModel):
    """A single administered dose event.

    Times are relative hours from an arbitrary reference (e.g. "now" or first dose).
    This is for educational simulation only.
    """

    dose_mg: float = Field(gt=0, description="Dose amount (mg)")
    start_time_hr: float = Field(ge=0, description="Start time of infusion, hours")
    infusion_hr: float = Field(gt=0, le=12, description="Infusion duration in hours")


class LevelObservation(BaseModel):
    """Measured level observation (educational)."""

    time_hr: float = Field(ge=0, description="Time of sample in hours")
    concentration_mg_l: float = Field(gt=0, description="Measured concentration (mg/L)")


class PatientInputs(BaseModel):
    age_yr: int = Field(ge=0, le=120)
    sex: Literal["male", "female"]
    weight_kg: float = Field(gt=0)
    serum_creatinine_mg_dl: float = Field(gt=0)


class RegimenInputs(BaseModel):
    dose_mg: float = Field(gt=0)
    interval_hr: float = Field(gt=0)
    infusion_hr: float = Field(gt=0)


class CalculateRequest(BaseModel):
    """Canonical request contract for the calculator.

    - mode="empiric": uses simple covariate-based CL/V defaults to simulate concentrations.
    - mode="bayes_demo": does a MAP-fit demo against provided levels/dose history.

    This API is for educational PK estimates only (not medical advice).
    """

    mode: Literal["empiric", "bayes_demo"] = "empiric"
    patient: PatientInputs
    regimen: RegimenInputs
    dose_history: Optional[List[DoseEvent]] = None
    levels: Optional[List[LevelObservation]] = None


class SafetyMessage(BaseModel):
    kind: Literal["info", "warning"] = "info"
    message: str


class BayesDemoResult(BaseModel):
    label: str = "Educational demo"
    cl_l_hr: float
    v_l: float
    ke_hr: float
    rmse_mg_l: float


class CurvePoint(BaseModel):
    t_hr: float
    conc_mg_l: float


class CalculateResponse(BaseModel):
    auc24_mg_h_l: float
    trough_mg_l: float
    peak_mg_l: float
    concentration_curve: List[CurvePoint]
    safety: List[SafetyMessage] = []
    bayes_demo: Optional[BayesDemoResult] = None


class BasicPatient(BaseModel):
    age: int = Field(ge=0, le=120)
    sex: Literal["male", "female"]
    height_cm: float = Field(gt=0)
    weight_kg: float = Field(gt=0)
    serum_creatinine: float = Field(gt=0)


class BasicRegimen(BaseModel):
    dose_mg: float = Field(gt=0)
    interval_hr: float = Field(gt=0)
    infusion_hr: Optional[float] = Field(default=None, gt=0)


class BasicCalculateRequest(BaseModel):
    patient: BasicPatient
    regimen: BasicRegimen
    mic: float = Field(default=1.0, gt=0)
    icu: bool = False
    mrsa: bool = False
    crcl_method: Optional[int] = Field(default=None, ge=1, le=5)
    forced_crcl: Optional[float] = Field(default=None, gt=0)


class BasicCalculateResponse(BaseModel):
    crcl: dict
    regimen: dict
    predicted: dict
    breakdown: dict
    curve: Optional[List[CurvePoint]] = None


class PkDoseEvent(BaseModel):
    dose_mg: float = Field(gt=0)
    start_time_hr: float = Field(ge=0)
    infusion_hr: float = Field(gt=0)


class PkLevelObservation(BaseModel):
    time_hr: float = Field(ge=0)
    concentration_mg_l: float = Field(gt=0)


class PkBayesianRequest(BaseModel):
    patient: PatientInputs
    mic: float = Field(default=1.0, gt=0)
    dose_history: List[PkDoseEvent]
    levels: List[PkLevelObservation]
    target_low: float = Field(default=400.0, gt=0)
    target_high: float = Field(default=600.0, gt=0)


class PkBayesianResponse(BaseModel):
    auc24: float
    auc24_ci_low: float
    auc24_ci_high: float
    cl_l_hr: float
    v_l: float
    curve: List[CurvePoint]
    curve_ci_low: List[CurvePoint]
    curve_ci_high: List[CurvePoint]
    recommendation: dict
    warnings: List[str] = []
