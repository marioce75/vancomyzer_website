from pathlib import Path
import traceback
import math
import os
import subprocess
import json
from datetime import datetime, timezone
from typing import List, Optional, Any

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
import numpy as np

from backend.models import CalculateRequest, CalculateResponse, CurvePoint, SafetyMessage
from backend.pk.sim import simulate_regimen_0_48h, auc_trapz, estimate_peak_trough_from_sim, Event, build_repeated_regimen_events, concentration_time_series
from backend.pk.bayes_demo import map_fit_demo


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


def _read_build_info() -> dict:
    build_info_path = STATIC_DIR / "build-info.json"
    if not build_info_path.exists():
        return {}
    try:
        return json.loads(build_info_path.read_text())
    except Exception:
        return {}


@app.middleware("http")
async def add_cache_headers(request: Request, call_next):
    response = await call_next(request)
    content_type = response.headers.get("content-type", "")
    if content_type.startswith("text/html"):
        response.headers["Cache-Control"] = "no-cache"
    return response


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


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(request: Request, exc: RequestValidationError):
    """Return rich validation errors for frontends.

    Render-safe: never crashes on non-serializable request bodies.
    """
    path = request.url.path
    if not path.startswith(("/api", "/pk")):
        return JSONResponse(status_code=422, content={"detail": "Validation error", "errors": exc.errors()})

    received_body: Any = None
    try:
        received_body = await request.json()
    except Exception:
        received_body = None

    return JSONResponse(
        status_code=422,
        content={
            "detail": "Validation error",
            "errors": exc.errors(),
            "received_body": received_body,
        },
    )


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


@app.get("/api/meta/version")
@app.get("/meta/version")
def meta_version():
    """Backward-compatible deploy/version info.

    Note: this endpoint is not shown in the clinician-facing footer.
    """
    build_info = _read_build_info()
    built_at = build_info.get("build_time") or datetime.now(timezone.utc).isoformat()

    # Prefer build info/env var, then try git.
    git_sha = build_info.get("git_sha") or os.environ.get("RENDER_GIT_COMMIT")
    if not git_sha:
        try:
            git_sha = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=str(BASE_DIR.parent)).decode().strip()
        except Exception:
            git_sha = None

    return {"git": git_sha, "built_at": built_at}


@app.get("/api/version")
@app.get("/version")
def api_version():
    """Dedicated version endpoint for support/audit.

    Uses env vars when available. Never includes PHI.
    """
    app_name = os.environ.get("APP_NAME", "Vancomyzer")
    app_version = os.environ.get("APP_VERSION", "v1")

    build_info = _read_build_info()

    # Build time: prefer build info/env var, otherwise fall back to request-time UTC.
    build_time = build_info.get("build_time") or os.environ.get("BUILD_TIME")
    if not build_time:
        build_time = datetime.now(timezone.utc).isoformat()

    git_sha = build_info.get("git_sha") or os.environ.get("GIT_SHA") or os.environ.get("RENDER_GIT_COMMIT") or None
    if not git_sha:
        try:
            git_sha = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=str(BASE_DIR.parent)).decode().strip()
        except Exception:
            git_sha = None

    environment = (
        os.environ.get("RENDER_SERVICE_NAME")
        or os.environ.get("ENVIRONMENT")
        or os.environ.get("RENDER")
        or "unknown"
    )

    return {
        "app": app_name,
        "version": app_version,
        "git_sha": git_sha,
        "build_time": build_time,
        "environment": environment,
    }


# -------- SPA serving (MUST be mounted after API routes) --------
# Root should always serve built frontend index.html when present.
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True, check_dir=False), name="spa")


def _default_pk_params_from_patient(age: int, sex: str, scr: float, weight_kg: float):
    """Very simple covariate-based defaults (educational).

    We reuse the existing CG CrCl -> CL heuristic already in this file.
    """
    crcl = cockcroft_gault_crcl(age, sex, scr, weight_kg)
    cl = estimate_cl_l_per_h(crcl)
    v = estimate_v_l(weight_kg)
    return crcl, cl, v


def _build_safety_messages(dose_mg: float, interval_hr: float, infusion_hr: float) -> List[SafetyMessage]:
    msgs: List[SafetyMessage] = [
        SafetyMessage(kind="warning", message="Educational PK estimates only — not medical advice. Verify with institutional protocols."),
        SafetyMessage(kind="info", message="Do not enter PHI. Times are relative hours for demonstration."),
    ]
    daily = float(dose_mg) * (24.0 / max(float(interval_hr), 1e-6))
    if dose_mg > 2500:
        msgs.append(SafetyMessage(kind="warning", message="High single dose entered (>2500 mg). Double-check inputs."))
    if daily > 4500:
        msgs.append(SafetyMessage(kind="warning", message="High total daily dose implied (>4500 mg/day). Double-check inputs."))
    if interval_hr < 6 or interval_hr > 48:
        msgs.append(SafetyMessage(kind="warning", message="Unusual dosing interval entered. Double-check interval and units."))
    if infusion_hr <= 0 or infusion_hr > 6:
        msgs.append(SafetyMessage(kind="warning", message="Unusual infusion duration entered. Double-check infusion hours."))
    return msgs


@app.post("/api/pk/calculate", response_model=CalculateResponse)
@app.post("/pk/calculate2", response_model=CalculateResponse)
def pk_calculate_educational(req: CalculateRequest) -> CalculateResponse:
    """Educational PK estimate endpoint.

    NOTE: This does not provide dosing recommendations.
    """

    # Build CL/V defaults
    crcl, cl_l_hr, v_l = _default_pk_params_from_patient(
        age=req.patient.age_yr,
        sex=req.patient.sex,
        scr=req.patient.serum_creatinine_mg_dl,
        weight_kg=req.patient.weight_kg,
    )

    dose_mg = float(req.regimen.dose_mg)
    interval_hr = float(req.regimen.interval_hr)
    infusion_hr = float(req.regimen.infusion_hr)

    # Empiric simulation for 0-48h
    t, c = simulate_regimen_0_48h(
        cl_l_hr=cl_l_hr,
        v_l=v_l,
        dose_mg=dose_mg,
        interval_hr=interval_hr,
        infusion_hr=infusion_hr,
        dt_min=10.0,
    )

    auc24 = auc_trapz(t, c, 0.0, 24.0)
    peak, trough = estimate_peak_trough_from_sim(t, c, interval_hr=interval_hr)

    safety_msgs = _build_safety_messages(dose_mg, interval_hr, infusion_hr)

    bayes_demo = None
    if req.mode == "bayes_demo":
        # Convert history + levels into events & observations
        if not req.dose_history or not req.levels:
            raise HTTPException(status_code=422, detail="bayes_demo requires dose_history[] and levels[]")

        events = [Event(dose_mg=e.dose_mg, start_hr=e.start_time_hr, infusion_hr=e.infusion_hr) for e in req.dose_history]
        levels = [(lv.time_hr, lv.concentration_mg_l) for lv in req.levels]
        try:
            cl_hat, v_hat, rmse = map_fit_demo(events=events, levels=levels)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

        cl_l_hr = float(cl_hat)
        v_l = float(v_hat)

        # Re-simulate with fitted params for 0-48h
        t, c = simulate_regimen_0_48h(
            cl_l_hr=cl_l_hr,
            v_l=v_l,
            dose_mg=dose_mg,
            interval_hr=interval_hr,
            infusion_hr=infusion_hr,
            dt_min=10.0,
        )
        auc24 = auc_trapz(t, c, 0.0, 24.0)
        peak, trough = estimate_peak_trough_from_sim(t, c, interval_hr=interval_hr)

        bayes_demo = {
            "label": "Educational demo",
            "cl_l_hr": float(cl_l_hr),
            "v_l": float(v_l),
            "ke_hr": float(cl_l_hr / max(v_l, 1e-6)),
            "rmse_mg_l": float(rmse),
        }

        safety_msgs.append(SafetyMessage(kind="info", message="Bayesian mode is an educational MAP-fit demo (not validated for clinical use)."))

    curve = [CurvePoint(t_hr=float(tt), conc_mg_l=float(cc)) for tt, cc in zip(t.tolist(), c.tolist())]

    return CalculateResponse(
        auc24_mg_h_l=float(auc24),
        trough_mg_l=float(trough),
        peak_mg_l=float(peak),
        concentration_curve=curve,
        safety=safety_msgs,
        bayes_demo=bayes_demo,
    )
