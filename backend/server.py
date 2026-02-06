from pathlib import Path
import traceback
import math
import os
import subprocess
from datetime import datetime, timezone
from typing import List, Optional, Any, Literal, Tuple

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
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


class RegimenOverride(BaseModel):
    doseMg: float = Field(gt=0)
    intervalHr: int = Field(gt=0)
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
    regimen: Optional[RegimenOverride] = None


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


def build_concentration_curve(
    dose_mg: float,
    tau_h: int,
    cl_l_h: float,
    v_l: float,
    infusion_h: float = 1.0,
    duration_h: float = 24.0,
    step_h: float = 0.5,
) -> List[dict]:
    cl = max(cl_l_h, 0.1)
    v = max(v_l, 1.0)
    tau = float(max(1.0, tau_h))
    tin = float(max(0.1, min(float(infusion_h), tau)))
    k = cl / v
    r = dose_mg / tin

    points: List[dict] = []
    n_doses = max(6, int(math.ceil(duration_h / tau)) + 6)
    steps = int(math.floor(duration_h / step_h))

    for i in range(steps + 1):
        t = i * step_h
        c = 0.0
        for n in range(n_doses):
            start = -n * tau
            dt = t - start
            if dt < 0:
                continue
            if dt <= tin:
                c += (r / cl) * (1.0 - math.exp(-k * dt))
            else:
                c += (r / cl) * (1.0 - math.exp(-k * tin)) * math.exp(-k * (dt - tin))
        points.append({"t": float(round(t, 2)), "c": float(round(max(c, 0.0), 3))})

    return points


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

    infusion_h = 1.0
    if req.regimen:
        tau = int(max(4, req.regimen.intervalHr))
        per_dose_mg = float(max(250, min(3000, req.regimen.doseMg)))
        infusion_h = float(max(0.5, min(req.regimen.infusionHours, tau)))
    else:
        target_mid = (req.aucTargetLow + req.aucTargetHigh) / 2
        daily_dose_needed_mg = target_mid * cl * req.mic * 1000.0

        tau = pick_interval(crcl)
        per_dose_mg = daily_dose_needed_mg * (tau / 24.0)
        per_dose_mg = max(500, min(3000, round(per_dose_mg / 250) * 250))

    auc24_pred = auc24_from_daily((per_dose_mg * (24.0 / tau)), cl, req.mic)
    trough = predict_trough(per_dose_mg, tau, cl, v, infusion_h=infusion_h)
    curve = build_concentration_curve(per_dose_mg, tau, cl, v, infusion_h=infusion_h)

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
        concentrationCurve=curve,
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


class BayesLevel(BaseModel):
    time_hr_from_start: float
    concentration_mg_l: float


class BayesRegimen(BaseModel):
    dose_mg: float
    interval_hr: float
    infusion_hr: float


class PriorParam(BaseModel):
    mean: float
    variance: float
    distribution: Literal["normal", "lognormal"] = "lognormal"


class PriorSet(BaseModel):
    cl: PriorParam
    v: PriorParam
    sigma: Optional[PriorParam] = None


class BayesSimulateRequest(BaseModel):
    age: float
    weight: float
    sex: Optional[str] = None
    scr: float
    regimen: BayesRegimen
    levels: Optional[List[BayesLevel]] = None
    priors: PriorSet


class PosteriorSummary(BaseModel):
    cl_mean: float
    cl_sd: float
    v_mean: float
    v_sd: float


class CurvePoint(BaseModel):
    time_hr: float
    concentration_mg_l: float


class SimulationMetrics(BaseModel):
    auc24_mg_h_l: float
    cmax_mg_l: float
    cmin_mg_l: float


class BayesSimulateResponse(BaseModel):
    posterior: PosteriorSummary
    curve: List[CurvePoint]
    metrics: SimulationMetrics
    warnings: List[str] = []
    method: str = "grid-map"
    educational_note: str = "Educational demonstration only."


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


@app.post("/pk/bayes_simulate", response_model=BayesSimulateResponse)
@app.post("/api/pk/bayes_simulate", response_model=BayesSimulateResponse)
def pk_bayes_simulate(req: BayesSimulateRequest) -> BayesSimulateResponse:
    warnings: List[str] = []
    dose_mg = float(req.regimen.dose_mg)
    interval_hr = float(req.regimen.interval_hr)
    infusion_hr = float(req.regimen.infusion_hr)

    if interval_hr <= 0:
        warnings.append("Interval must be positive; using 12 hours for simulation.")
        interval_hr = 12.0
    if infusion_hr <= 0:
        warnings.append("Infusion duration must be positive; using 1 hour for simulation.")
        infusion_hr = 1.0
    if dose_mg <= 0:
        warnings.append("Dose must be positive; using 1000 mg for simulation.")
        dose_mg = 1000.0

    if infusion_hr < 0.5 or infusion_hr > 4.0:
        warnings.append("Infusion duration outside 0.5–4 h; interpret simulations cautiously.")
    if interval_hr not in {6.0, 8.0, 12.0, 24.0}:
        warnings.append("Non-standard interval (typical: 6, 8, 12, 24 h).")
    if dose_mg < 250 or dose_mg > 6000:
        warnings.append("Dose outside typical 250–6000 mg range.")
    if infusion_hr > interval_hr:
        warnings.append("Infusion duration exceeds interval; using infusion = interval for simulation.")
        infusion_hr = interval_hr

    daily_dose = dose_mg * (24.0 / interval_hr)
    max_daily_display = 6000.0
    if daily_dose > max_daily_display:
        capped = max_daily_display * (interval_hr / 24.0)
        warnings.append(
            f"Daily dose capped at {max_daily_display:.0f} mg/day for educational display "
            f"(simulating {capped:.0f} mg q{interval_hr:g}h)."
        )
        dose_mg = capped

    valid_times: List[float] = []
    valid_concs: List[float] = []
    for level in req.levels or []:
        if level.time_hr_from_start < 0:
            warnings.append("Ignoring level with negative time.")
            continue
        if level.concentration_mg_l <= 0:
            warnings.append("Ignoring level with non-positive concentration.")
            continue
        valid_times.append(float(level.time_hr_from_start))
        valid_concs.append(float(level.concentration_mg_l))

    def _sanitize_prior(prior: PriorParam, name: str) -> dict:
        mean = float(prior.mean)
        variance = float(prior.variance)
        dist = prior.distribution.lower()
        if dist not in {"normal", "lognormal"}:
            warnings.append(f"{name} prior distribution not recognized; using lognormal.")
            dist = "lognormal"
        if dist == "lognormal" and mean <= 0:
            warnings.append(f"{name} prior mean must be positive for lognormal; using absolute value.")
            mean = max(abs(mean), 0.1)
        if variance <= 0:
            warnings.append(f"{name} prior variance must be positive; using 10% CV default.")
            variance = (0.1 * max(mean, 0.1)) ** 2
        return {"mean": mean, "variance": variance, "distribution": dist}

    prior_cl = _sanitize_prior(req.priors.cl, "CL")
    prior_v = _sanitize_prior(req.priors.v, "V")
    sigma_prior = req.priors.sigma or PriorParam(mean=0.25, variance=0.04, distribution="normal")
    prior_sigma = _sanitize_prior(sigma_prior, "Sigma")
    sigma = max(prior_sigma["mean"], 0.05)

    if not valid_times:
        warnings.append("No valid levels provided; posterior reflects prior information only.")

    cl_mean, cl_sd, v_mean, v_sd, map_cl, map_v = _posterior_grid(
        valid_times,
        valid_concs,
        dose_mg,
        interval_hr,
        infusion_hr,
        prior_cl,
        prior_v,
        sigma,
        grid_size=40,
    )

    sim_cl = cl_mean if cl_mean > 0 else map_cl
    sim_v = v_mean if v_mean > 0 else map_v
    times, concs = _simulate_curve(sim_cl, sim_v, dose_mg, interval_hr, infusion_hr, duration_h=24.0, step_h=0.25)
    auc24 = float(np.trapz(concs, times))
    cmax = float(_steady_state_concentration(infusion_hr, dose_mg, interval_hr, infusion_hr, sim_cl, sim_v))
    cmin = float(_steady_state_concentration(interval_hr - 1e-6, dose_mg, interval_hr, infusion_hr, sim_cl, sim_v))

    curve = [
        CurvePoint(time_hr=float(t), concentration_mg_l=float(c))
        for t, c in zip(times.tolist(), concs.tolist())
    ]

    return BayesSimulateResponse(
        posterior=PosteriorSummary(
            cl_mean=float(cl_mean),
            cl_sd=float(cl_sd),
            v_mean=float(v_mean),
            v_sd=float(v_sd),
        ),
        curve=curve,
        metrics=SimulationMetrics(
            auc24_mg_h_l=auc24,
            cmax_mg_l=cmax,
            cmin_mg_l=cmin,
        ),
        warnings=warnings,
        method="grid-map",
        educational_note="Educational demonstration only — not for clinical use.",
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
    built_at = datetime.now(timezone.utc).isoformat()

    # Prefer Render env var, then try git.
    git_sha = os.environ.get("RENDER_GIT_COMMIT")
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

    # Build time: prefer explicit BUILD_TIME, otherwise fall back to request-time UTC.
    build_time = os.environ.get("BUILD_TIME")
    if not build_time:
        build_time = datetime.now(timezone.utc).isoformat()

    git_sha = (
        os.environ.get("GIT_SHA")
        or os.environ.get("RENDER_GIT_COMMIT")
        or None
    )
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


# -------- SPA serving (MUST be declared after API routes) --------
@app.get("/", response_class=HTMLResponse)
@app.get("/{full_path:path}")
def serve_spa(full_path: str = ""):
    root_segment = full_path.split("/", 1)[0] if full_path else ""
    if root_segment in {"api", "pk", "meta", "health", "healthz"}:
        raise HTTPException(status_code=404, detail="Not found")

    if not INDEX_FILE.exists():
        return HTMLResponse("<h1>Frontend build not found</h1>", status_code=503)

    candidate = (STATIC_DIR / full_path).resolve()
    if full_path:
        if not str(candidate).startswith(str(STATIC_DIR.resolve())):
            raise HTTPException(status_code=404, detail="Not found")
        if candidate.is_file():
            return FileResponse(candidate)
        if candidate.suffix or full_path.startswith(("assets/", "static/")):
            raise HTTPException(status_code=404, detail="Not found")

    return FileResponse(INDEX_FILE)
