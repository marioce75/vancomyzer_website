from pathlib import Path
import traceback
import math
from typing import List, Optional

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError
import numpy as np

app = FastAPI(title="Vancomyzer Server")

# -------- Static frontend serving (robust) --------
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
INDEX_FILE = STATIC_DIR / "index.html"
ASSETS_DIR = STATIC_DIR / "assets"

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

@app.get("/healthz")
def healthz():
    return {"status": "ok"}

@app.get("/")
def serve_root():
    if INDEX_FILE.exists():
        return FileResponse(str(INDEX_FILE))
    # Friendly fallback instead of 500
    html = """
    <!doctype html>
    <html><head><meta charset='utf-8'><title>Vancomyzer</title></head>
    <body style='font-family: system-ui, -apple-system, Segoe UI, Roboto;'>
      <div style='max-width:720px;margin:40px auto;padding:16px'>
        <h1>Frontend build missing</h1>
        <p>Copy Vite <code>dist/</code> into <code>backend/static/</code> during build.</p>
        <ul>
          <li><a href='/docs'>API Docs</a></li>
          <li><a href='/healthz'>Health</a></li>
        </ul>
      </div>
    </body></html>
    """
    return HTMLResponse(content=html, status_code=200)

# Global exception handler (log to stdout, JSON for API paths)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    path = request.url.path
    if path.startswith("/api") or path.startswith("/pk") or path.startswith("/meta"):
        return JSONResponse(status_code=500, content={"error": "Internal server error"})
    # For non-API, render a minimal error page
    return HTMLResponse("<h1>Internal server error</h1>", status_code=500)

# SPA fallback for non-API paths
@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    protected_prefixes = ("api", "pk", "docs", "openapi.json", "static", "assets")
    if full_path.startswith(protected_prefixes):
        raise HTTPException(status_code=404, detail="Not Found")
    if INDEX_FILE.exists():
        return FileResponse(str(INDEX_FILE))
    return HTMLResponse("<h1>Frontend build missing</h1>", status_code=200)

# -------- Deterministic PK endpoint --------
class Level(BaseModel):
    concentration: float = Field(gt=0)
    timeHoursFromDoseStart: float = Field(ge=0)

class DoseEvent(BaseModel):
    doseMg: float = Field(gt=0)
    startTimeHours: float = Field(ge=0)
    infusionHours: float = Field(gt=0)

class PkCalculateRequest(BaseModel):
    age: int
    sex: str
    heightCm: float
    weightKg: float
    serumCreatinine: float = Field(gt=0)
    icu: bool = False
    infectionSeverity: str = "standard"
    mic: float = 1.0
    aucTargetLow: int = 400
    aucTargetHigh: int = 600
    levels: Optional[List[Level]] = None
    doseHistory: Optional[List[DoseEvent]] = None

class Safety(BaseModel):
    warnings: List[str] = []
    messages: List[str] = []

class PkCalculateResponse(BaseModel):
    loadingDoseMg: Optional[float] = None
    maintenanceDoseMg: float
    intervalHours: int
    predictedAuc24: float
    predictedTrough: Optional[float] = None
    safety: Safety


def cockcroft_gault_crcl(age: int, sex: str, scr: float, weight_kg: float) -> float:
    # CG using actual body weight; conservative lower bound for Scr
    sex_factor = 0.85 if sex.lower() == "female" else 1.0
    scr = max(scr, 0.2)
    crcl = ((140 - age) * weight_kg) / (72 * scr)
    return crcl * sex_factor  # mL/min


def estimate_cl_l_per_h(crcl_ml_min: float) -> float:
    # CL roughly proportional to CrCl; add small intercept
    return max(0.6, (crcl_ml_min / 1000.0) * 60.0 + 0.4)


def estimate_v_l(weight_kg: float) -> float:
    # Vd ~0.7 L/kg, clamp between 20 and 80 L for practicality
    return float(max(20.0, min(80.0, 0.7 * weight_kg)))


def auc24_from_daily(daily_dose_mg: float, cl_l_h: float, mic: float) -> float:
    # AUC24 ≈ (daily_dose_mg / 1000) / CL * (1/MIC)
    return (daily_dose_mg / 1000.0) / max(cl_l_h, 0.1) * (1.0 / max(mic, 0.5))


def pick_interval(crcl_ml_min: float) -> int:
    if crcl_ml_min < 30:
        return 24
    if crcl_ml_min < 50:
        return 24
    if crcl_ml_min < 80:
        return 12
    return 12


def predict_trough(dose_mg: float, tau_h: int, cl_l_h: float, v_l: float) -> float:
    # One-compartment approximation
    k = cl_l_h / max(v_l, 1.0)
    infusion_rate = dose_mg / tau_h
    return (infusion_rate / max(cl_l_h, 0.1)) * math.exp(-k * tau_h)


@app.post("/pk/calculate", response_model=PkCalculateResponse)
def pk_calculate(req: PkCalculateRequest) -> PkCalculateResponse:
    try:
        crcl = cockcroft_gault_crcl(req.age, req.sex, req.serumCreatinine, req.weightKg)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid inputs for CrCl calculation")

    cl = estimate_cl_l_per_h(crcl)
    v = estimate_v_l(req.weightKg)

    target_mid = (req.aucTargetLow + req.aucTargetHigh) / 2
    daily_dose_needed_mg = target_mid * cl * req.mic  # reverse of auc24_from_daily without 1000 scaling
    daily_dose_needed_mg = daily_dose_needed_mg * 1000.0  # convert to mg/day

    tau = pick_interval(crcl)
    per_dose_mg = daily_dose_needed_mg * (tau / 24.0)
    per_dose_mg = max(500, min(3000, round(per_dose_mg / 250) * 250))

    auc24_pred = auc24_from_daily((per_dose_mg * (24.0 / tau)), cl, req.mic)
    trough_pred = predict_trough(per_dose_mg, tau, cl, v)

    loading = None
    if req.infectionSeverity.lower() == "serious" or req.icu:
        loading = round((25 * req.weightKg) / 250) * 250

    warnings: List[str] = []
    if auc24_pred > 800:
        warnings.append("High exposure; strongly consider dose reduction")
    elif auc24_pred > 600:
        warnings.append("Above recommended exposure range; nephrotoxicity risk increases")
    if crcl < 30:
        warnings.append("Renal impairment—use caution and frequent monitoring")

    return PkCalculateResponse(
        loadingDoseMg=loading,
        maintenanceDoseMg=per_dose_mg,
        intervalHours=tau,
        predictedAuc24=round(auc24_pred, 1),
        predictedTrough=round(trough_pred, 1),
        safety=Safety(warnings=warnings, messages=[]),
    )

# -------- Bayesian scaffolding (no SciPy) --------
class BayesianRequest(PkCalculateRequest):
    levels: List[Level] = Field(min_items=1)
    doseHistory: List[DoseEvent] = Field(min_items=1)

class BayesianResponse(BaseModel):
    bayesian: bool
    posterior: dict
    predictedAuc24: float
    recommended: dict
    safety: Safety


def predict_conc_grid(cl: float, v: float, levels: List[Level], dose_history: List[DoseEvent]) -> float:
    # Very simple score: sum squared error against observed levels using bolus approximation
    # C(t) ~ (Dose/V) * exp(-k * t), aggregate effects of past doses
    k = cl / max(v, 1.0)
    score = 0.0
    for obs in levels:
        t = obs.timeHoursFromDoseStart
        pred = 0.0
        for de in dose_history:
            # treat each dose as bolus at startTimeHours
            dt = max(0.0, t - de.startTimeHours)
            pred += (de.doseMg / max(v, 1.0)) * math.exp(-k * dt)
        err_sigma = max(0.5, 0.2 * obs.concentration)
        score += ((pred - obs.concentration) ** 2) / (err_sigma ** 2)
    return score

@app.post("/pk/bayesian", response_model=BayesianResponse)
def pk_bayesian(req: BayesianRequest) -> BayesianResponse:
    # Priors
    crcl = cockcroft_gault_crcl(req.age, req.sex, req.serumCreatinine, req.weightKg)
    cl_prior = estimate_cl_l_per_h(crcl)
    v_prior = estimate_v_l(req.weightKg)

    cl_grid = cl_prior * np.linspace(0.5, 1.5, 51)
    v_grid = v_prior * np.linspace(0.5, 1.5, 51)

    best = (cl_prior, v_prior, float("inf"))
    for clc in cl_grid:
        for vc in v_grid:
            sc = predict_conc_grid(float(clc), float(vc), req.levels, req.doseHistory)
            if sc < best[2]:
                best = (float(clc), float(vc), sc)

    cl_map, v_map = best[0], best[1]
    # Recommend maintenance to hit mid-target
    target_mid = (req.aucTargetLow + req.aucTargetHigh) / 2
    daily_mg = target_mid * cl_map * req.mic * 1000.0
    tau = pick_interval(crcl)
    per_dose = max(500, min(3000, round((daily_mg * (tau / 24.0)) / 250) * 250))
    auc24_pred = auc24_from_daily((per_dose * (24.0 / tau)), cl_map, req.mic)

    warnings: List[str] = []
    if auc24_pred > 800:
        warnings.append("High exposure; strongly consider dose reduction")
    elif auc24_pred > 600:
        warnings.append("Above recommended exposure range; nephrotoxicity risk increases")

    return BayesianResponse(
        bayesian=True,
        posterior={"CL_L_per_hr": round(cl_map, 3), "V_L": round(v_map, 1)},
        predictedAuc24=round(auc24_pred, 1),
        recommended={"maintenanceDoseMg": per_dose, "intervalHours": tau},
        safety=Safety(warnings=warnings, messages=[]),
    )

# -------- References + Disclaimer --------
@app.get("/meta/references")
def meta_references():
    return {
        "references": [
            {"title": "Vancomycin AUC-based monitoring guidance", "org": "ASHP/IDSA", "year": 2020, "note": "Target AUC/MIC 400–600"},
            {"title": "Consensus on therapeutic monitoring", "org": "Institutional", "year": 2024, "note": "Use Bayesian when feasible"},
        ]
    }

@app.get("/meta/disclaimer")
def meta_disclaimer():
    return {
        "short": "Clinical decision support only. Verify with institutional protocols.",
        "full": [
            "Not medical advice. For licensed professionals.",
            "No warranty; patient-specific factors may not be fully captured.",
            "Confirm per institutional policy.",
            "Bayesian estimates depend on accurate levels and timing.",
        ],
    }
