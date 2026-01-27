from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import List, Optional
import math
from pathlib import Path

app = FastAPI(title="Vancomyzer Server")

# Serve built frontend from backend/static
app.mount("/static", StaticFiles(directory="backend/static"), name="static")
# Serve Vite assets under /assets
app.mount("/assets", StaticFiles(directory="backend/static/assets"), name="assets")

@app.get("/", response_class=FileResponse)
def serve_frontend():
    return Path("backend/static/index.html").read_text()

# ---- PK API: Deterministic AUC-based dosing ----
class Level(BaseModel):
    timeHr: float
    concentration: float

class DoseEvent(BaseModel):
    timeHr: float
    doseMg: float

class PkCalculateRequest(BaseModel):
    age: int
    sex: str
    height_cm: float
    weight_kg: float
    serum_creatinine: float
    icu: bool
    infection_severity: str
    mic: float
    auc_target_low: int = Field(default=400)
    auc_target_high: int = Field(default=600)
    levels: Optional[List[Level]] = None
    dose_history: Optional[List[DoseEvent]] = None

class Safety(BaseModel):
    warnings: List[str] = []

class PkCalculateResponse(BaseModel):
    loadingDoseMg: Optional[float] = None
    maintenanceDoseMg: float
    intervalHours: int
    predictedAuc24: float
    predictedTrough: Optional[float] = None
    safety: Safety


def cockcroft_gault_crcl(age: int, sex: str, scr_mg_dl: float, weight_kg: float) -> float:
    # Conservative CG using actual body weight
    sex_factor = 0.85 if sex.lower() == "female" else 1.0
    crcl = ((140 - age) * weight_kg) / (72 * max(scr_mg_dl, 0.2))
    return crcl * sex_factor


def estimate_clearance_l_per_h(crcl_ml_min: float) -> float:
    # Approximate relationship: vancomycin clearance ~ CrCl (scaled)
    # Convert CrCl (mL/min) to L/h and apply modest intercept
    return max(0.5, (crcl_ml_min / 1000.0) * 60.0 + 0.5)


def vd_l(weight_kg: float) -> float:
    # Volume of distribution ~0.7 L/kg
    return 0.7 * weight_kg


def predict_auc24(daily_dose_mg: float, mic: float, clearance_l_h: float) -> float:
    # AUC24 ≈ daily_dose / clearance (mg·h/L); MIC used for context but not scaling here
    return daily_dose_mg / max(clearance_l_h, 0.1)


def pick_interval_hours(crcl_ml_min: float) -> int:
    # Simple interval selection based on renal function
    if crcl_ml_min < 30:
        return 24
    if crcl_ml_min < 50:
        return 24
    if crcl_ml_min < 80:
        return 12
    return 12


def predict_trough(dose_mg: float, interval_h: int, clearance_l_h: float, weight_kg: float) -> float:
    # One-compartment steady-state trough estimate: C_ss,min ≈ (Dose/Interval)/Cl * (1 - e^{-k*Interval})/e^{k*Interval}
    k = clearance_l_h / max(vd_l(weight_kg), 1.0)
    tau = interval_h
    infusion_rate = dose_mg / tau
    # Simplified: trough ≈ (infusion_rate / Cl) * math.exp(-k * tau)
    return (infusion_rate / max(clearance_l_h, 0.1)) * math.exp(-k * tau)


@app.post("/pk/calculate", response_model=PkCalculateResponse)
def pk_calculate(req: PkCalculateRequest) -> PkCalculateResponse:
    crcl = cockcroft_gault_crcl(req.age, req.sex, req.serum_creatinine, req.weight_kg)
    cl = estimate_clearance_l_per_h(crcl)

    # Target midpoint AUC
    target_mid = (req.auc_target_low + req.auc_target_high) / 2
    daily_dose_needed = target_mid * cl  # mg/day

    # Interval selection and per-dose calculation
    interval_h = pick_interval_hours(crcl)
    dose_per_admin = daily_dose_needed * (interval_h / 24.0)

    # Round dose to nearest 250 mg, clamp within typical bounds
    dose_per_admin = max(500, min(3000, round(dose_per_admin / 250) * 250))

    auc24_pred = predict_auc24(daily_dose_needed, req.mic, cl)
    trough_pred = predict_trough(dose_per_admin, interval_h, cl, req.weight_kg)

    # Loading dose: consider if serious infection or ICU
    loading = None
    if req.infection_severity.lower() == "serious" or req.icu:
        loading = round((25 * req.weight_kg) / 250) * 250  # 20–25 mg/kg; use 25 mg/kg rounded

    # Safety flags
    warnings: List[str] = []
    if auc24_pred > 600:
        warnings.append("Predicted AUC > 600: consider dose reduction.")
    if crcl < 30:
        warnings.append("CrCl < 30 mL/min: extended interval and close monitoring.")
    if req.icu and dose_per_admin >= 2000:
        warnings.append("ICU + high dose: monitor nephrotoxicity risk.")

    return PkCalculateResponse(
        loadingDoseMg=loading,
        maintenanceDoseMg=dose_per_admin,
        intervalHours=interval_h,
        predictedAuc24=round(auc24_pred, 1),
        predictedTrough=round(trough_pred, 1),
        safety=Safety(warnings=warnings),
    )
