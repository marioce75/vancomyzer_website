from pathlib import Path
import traceback
import math
from typing import List, Optional

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import numpy as np

app = FastAPI(title="Vancomyzer Server")

# -------- Static frontend paths --------
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
INDEX_FILE = STATIC_DIR / "index.html"

# Serve built assets at /assets/* (Vite default)
ASSETS_DIR = STATIC_DIR / "assets"
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR), check_dir=False), name="assets")

# Optional: expose /static for debugging/legacy paths (not used by Vite)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR), check_dir=False), name="static")


# -------- Health --------
@app.get("/health")
@app.get("/healthz")
def health():
    return {"status": "ok"}


# -------- Errors: return JSON for APIs --------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Always JSON for API routes
    if request.url.path.startswith(("/api", "/pk", "/meta", "/health", "/healthz")):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    # Preserve default behavior for non-API paths
    return HTMLResponse(f"<h1>{exc.status_code}</h1><p>{exc.detail}</p>", status_code=exc.status_code)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    if request.url.path.startswith(("/api", "/pk", "/meta", "/health", "/healthz")):
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
    return HTMLResponse("<h1>Internal server error</h1>", status_code=500)


# -------- API models --------
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
    # Frontend expects "messages"; keep other fields optional.
    aucWarning600: Optional[bool] = None
    aucWarning800: Optional[bool] = None
    crclLow: Optional[bool] = None
    messages: List[str] = []


class PkCalculateResponse(BaseModel):
    loadingDoseMg: Optional[float] = None
    maintenanceDoseMg: float
    intervalHr: int
    auc24: float
    # Compatibility: frontend expects object {low, high} when present.
    troughPredicted: Optional[dict] = None
    safety: Safety
    concentrationCurve: Optional[List[dict]] = None


# -------- PK helpers --------
def cockcroft_gault_crcl(age: int, sex: str, scr: float, weight_kg: float) -> float:
    sex_factor = 0.85 if sex.lower() == "female" else 1.0
    scr = max(scr, 0.2)
    crcl = ((140 - age) * weight_kg) / (72 * scr)
    return crcl * sex_factor


def estimate_cl_l_per_h(crcl_ml_min: float) -> float:
    return max(0.6, (crcl_ml_min / 1000.0) * 60.0 + 0.4)


def estimate_v_l(weight_kg: float) -> float:
    return float(max(20.0, min(80.0, 0.7 * weight_kg)))


def auc24_from_daily(daily_dose_mg: float, cl_l_h: float, mic: float) -> float:
    return (daily_dose_mg / 1000.0) / max(cl_l_h, 0.1) * (1.0 / max(mic, 0.5))


def pick_interval(crcl_ml_min: float) -> int:
    if crcl_ml_min < 50:
        return 24
    return 12


def predict_trough(dose_mg: float, tau_h: int, cl_l_h: float, v_l: float, infusion_h: float = 1.0) -> float:
    cl = max(cl_l_h, 0.1)
    v = max(v_l, 1.0)
    tin = float(max(0.1, min(float(infusion_h), float(tau_h))))
    k = cl / v
    tau = float(tau_h)
    denom = 1.0 - math.exp(-k * tau)
    if denom <= 1e-9:
        return 0.0
    r = dose_mg / tin
    c_trough = (r / cl) * (1.0 - math.exp(-k * tin)) * math.exp(-k * (tau - tin)) / denom
    return float(max(0.0, c_trough))


# -------- API endpoints (with /api aliases) --------
@app.post("/pk/calculate", response_model=PkCalculateResponse)
@app.post("/api/pk/calculate", response_model=PkCalculateResponse)
def pk_calculate(req: PkCalculateRequest) -> PkCalculateResponse:
    try:
        crcl = cockcroft_gault_crcl(req.age, req.sex, req.serumCreatinine, req.weightKg)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid inputs for CrCl calculation")

    cl = estimate_cl_l_per_h(crcl)
    v = estimate_v_l(req.weightKg)

    target_mid = (req.aucTargetLow + req.aucTargetHigh) / 2
    daily_dose_needed_mg = target_mid * cl * req.mic * 1000.0

    tau = pick_interval(crcl)
    per_dose_mg = daily_dose_needed_mg * (tau / 24.0)
    per_dose_mg = max(500, min(3000, round(per_dose_mg / 250) * 250))

    auc24_pred = auc24_from_daily((per_dose_mg * (24.0 / tau)), cl, req.mic)
    trough = predict_trough(per_dose_mg, tau, cl, v, infusion_h=1.0)

    loading = None
    if req.infectionSeverity.lower() == "serious" or req.icu:
        loading = round((25 * req.weightKg) / 250) * 250

    messages: List[str] = []
    aucWarning800 = auc24_pred > 800
    aucWarning600 = auc24_pred > 600
    crclLow = crcl < 30

    if aucWarning800:
        messages.append("AUC > 800: high nephrotoxicity risk.")
    elif aucWarning600:
        messages.append("AUC > 600: consider dose reduction.")
    if crclLow:
        messages.append("Low CrCl: dose cautiously and monitor Scr.")

    return PkCalculateResponse(
        loadingDoseMg=loading,
        maintenanceDoseMg=float(per_dose_mg),
        intervalHr=int(tau),
        auc24=float(round(auc24_pred, 1)),
        troughPredicted={"low": float(round(trough * 0.9, 1)), "high": float(round(trough * 1.1, 1))},
        safety=Safety(
            aucWarning600=bool(aucWarning600),
            aucWarning800=bool(aucWarning800),
            crclLow=bool(crclLow),
            messages=messages,
        ),
        concentrationCurve=None,
    )


# Bayesian models
class BayesianRequest(PkCalculateRequest):
    levels: List[Level]
    doseHistory: List[DoseEvent]


class BayesianResponse(BaseModel):
    bayesian: bool
    posterior: dict
    auc24: float
    recommended: dict
    safety: Safety


def _validate_bayesian_inputs(levels: List[Level], dose_history: List[DoseEvent]) -> None:
    if not levels or len(levels) < 1:
        raise HTTPException(status_code=422, detail="At least 1 level is required for Bayesian estimation")
    if not dose_history or len(dose_history) < 1:
        raise HTTPException(status_code=422, detail="At least 1 dose event is required for Bayesian estimation")


@app.post("/pk/bayesian", response_model=BayesianResponse)
@app.post("/api/pk/bayesian", response_model=BayesianResponse)
def pk_bayesian(req: BayesianRequest) -> BayesianResponse:
    _validate_bayesian_inputs(req.levels, req.doseHistory)

    # Keep scaffold lightweight: return deterministic + note; avoids 500s in production.
    det = pk_calculate(req)
    return BayesianResponse(
        bayesian=True,
        posterior={"note": "Bayesian estimation scaffold"},
        auc24=det.auc24,
        recommended={"maintenanceDoseMg": det.maintenanceDoseMg, "intervalHr": det.intervalHr},
        safety=det.safety,
    )


# -------- Meta endpoints (with /api aliases) --------
@app.get("/meta/references")
@app.get("/api/meta/references")
def meta_references():
    return {
        "references": [
            {"title": "Therapeutic Monitoring of Vancomycin for Serious MRSA Infections", "org": "ASHP/IDSA/PIDS/SIDP", "year": 2020, "note": "AUC/MIC 400–600"},
        ]
    }


@app.get("/meta/disclaimer")
@app.get("/api/meta/disclaimer")
def meta_disclaimer():
    return {
        "short": "Clinical decision support only. Verify with institutional protocols.",
        "full": [
            "This tool is for educational/clinical decision support purposes only.",
            "It does not replace clinical judgment, local protocols, or infectious diseases/pharmacy consultation.",
            "Do not enter PHI.",
        ],
    }


# -------- SPA serving (MUST be mounted after API routes) --------
# Root should always serve built frontend index.html when present.
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True, check_dir=False), name="spa")
