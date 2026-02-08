from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import os
import json
from datetime import datetime, timezone

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
BUILD_INFO_PATH = STATIC_DIR / "build-info.json"

app = FastAPI(title="Vancomyzer API", openapi_url="/openapi.json")

# CORS for static site
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Serve static assets
app.mount("/static", StaticFiles(directory=str(STATIC_DIR), check_dir=False), name="static")

# Vite outputs asset URLs under /assets by default; expose them from the same build directory
app.mount(
    "/assets",
    StaticFiles(directory=str(STATIC_DIR / "assets"), check_dir=False),
    name="assets",
)

# Serve compiled index.html at root
@app.get("/", response_class=HTMLResponse)
async def serve_index():
    html = (STATIC_DIR / "index.html").read_text()
    # Fallback: if the frontend was built with absolute /assets paths, make it work under /static as well
    html = html.replace('src="/assets/', 'src="/static/assets/')
    html = html.replace('href="/assets/', 'href="/static/assets/')
    return HTMLResponse(html, headers={"Cache-Control": "no-store, no-cache, must-revalidate"})

@app.get("/build-info.json")
def build_info():
    if BUILD_INFO_PATH.exists():
        return json.loads(BUILD_INFO_PATH.read_text())
    return {"detail": "Not Found"}

# PK Models
class PKRequest(BaseModel):
    age: float
    sex: str
    weight: float
    height: float
    scr: float
    infusionH: float = 1.0

class PKResponse(BaseModel):
    crcl: float
    ke: float
    vd: float
    regimen: dict
    auc24: float
    warnings: List[str] = []

@app.post("/api/pk/calculate", response_model=PKResponse)
def pk_calculate(req: PKRequest):
    from backend.utils.pk import Patient as PKPatient, recommend_regimen, calc_crcl, calc_ke, calc_vd, calc_auc
    p = PKPatient(age=req.age, sex=req.sex, weight=req.weight, height=req.height, scr=req.scr)
    crcl = calc_crcl(p)
    ke = calc_ke(crcl)
    vd = calc_vd(p.weight)
    regimen = recommend_regimen(p)
    auc24 = calc_auc(regimen.doseMg, regimen.intervalH, ke, vd, req.infusionH)
    warnings: List[str] = []
    if auc24 > 800:
        warnings.append("Predicted AUC >800 mg·h/L: high nephrotoxicity risk.")
    elif auc24 > 600:
        warnings.append("Predicted AUC >600 mg·h/L: consider dose/interval reduction.")
    return PKResponse(
        crcl=crcl,
        ke=ke,
        vd=vd,
        regimen={"doseMg": regimen.doseMg, "intervalH": regimen.intervalH, "infusionH": regimen.infusionH},
        auc24=auc24,
        warnings=warnings,
    )

@app.get("/api/health")
def health():
    return {"status": "ok"}


def _read_build_info() -> dict:
    """Best-effort build metadata (git SHA + build time)."""
    git_sha = os.getenv("RENDER_GIT_COMMIT") or os.getenv("GIT_SHA")
    build_time = None

    if BUILD_INFO_PATH.exists():
        try:
            data = json.loads(BUILD_INFO_PATH.read_text())
            git_sha = git_sha or data.get("git_sha")
            build_time = data.get("build_time")
        except Exception:
            pass

    return {
        "git_sha": git_sha or "unknown",
        "build_time": build_time or datetime.now(timezone.utc).isoformat(),
    }


@app.get("/version")
@app.get("/api/version")
def version():
    info = _read_build_info()
    return {
        "app": "vancomyzer",
        "git_sha": info["git_sha"],
        "build_time": info["build_time"],
    }


@app.get("/meta/version")
@app.get("/api/meta/version")
def meta_version():
    # Keep this endpoint stable for automated checks.
    return _read_build_info()

# Schemas derived from original design
class Patient(BaseModel):
    age: float
    sex: str
    weight: float
    height: float
    scr: float

class Regimen(BaseModel):
    doseMg: float
    intervalH: float
    infusionH: float
    startTimeH: float = 0

class Level(BaseModel):
    time: float
    concentration: float

class OptimizeTarget(BaseModel):
    aucTarget: float
    minAuc: Optional[float] = None
    maxAuc: Optional[float] = None

class InteractiveRequest(BaseModel):
    patient: Patient
    regimen: Regimen
    levels: Optional[List[Level]] = []

class BayesianMetrics(BaseModel):
    auc24: float
    peak: float
    trough: float
    crcl: float
    weightUsed: float
    vd: float
    cl: float
    k: float
    clMean: Optional[float] = None
    clStd: Optional[float] = None
    vdMean: Optional[float] = None
    vdStd: Optional[float] = None

class TimePoint(BaseModel):
    time: float
    concentration: float
    ci95Lower: Optional[float] = None
    ci95Upper: Optional[float] = None

class BayesianResult(BaseModel):
    metrics: BayesianMetrics
    timeCourse: List[TimePoint]
    method: str = "bayesian"

class OptimizeRequest(BaseModel):
    patient: Patient
    regimen: Regimen
    target: OptimizeTarget
    levels: Optional[List[Level]] = []

class OptimizeResult(BaseModel):
    regimen: Regimen
    predicted: BayesianResult

@app.post("/api/interactive/auc", response_model=BayesianResult)
def interactive_auc(req: InteractiveRequest):
    # Placeholder calculation; in original, compute PK with Bayesian method
    metrics = BayesianMetrics(
        auc24=400.0,
        peak=30.0,
        trough=10.0,
        crcl=90.0,
        weightUsed=req.patient.weight,
        vd=0.7 * req.patient.weight,
        cl=3.5,
        k=0.1,
    )
    curve = [TimePoint(time=t, concentration=max(0.0, 30.0 * (2.71828 ** (-0.1 * t)))) for t in range(0, 24)]
    return BayesianResult(metrics=metrics, timeCourse=curve)

@app.post("/api/optimize", response_model=OptimizeResult)
def optimize(req: OptimizeRequest):
    # Return the same regimen for placeholder and predicted curve from interactive_auc
    predicted = interactive_auc(InteractiveRequest(patient=req.patient, regimen=req.regimen, levels=req.levels or []))
    return OptimizeResult(regimen=req.regimen, predicted=predicted)

@app.post("/api/calculate")
def calculate(req: InteractiveRequest):
    # Legacy non-bayesian calculation endpoint mirroring original
    return interactive_auc(req)

class PKBayesianRequest(BaseModel):
    patient: Patient
    regimen: Regimen
    levels: Optional[List[Level]] = []

@app.post("/api/pk/bayesian", response_model=BayesianResult)
def pk_bayesian(req: PKBayesianRequest):
    # Delegate to existing Bayesian interactive logic
    return interactive_auc(InteractiveRequest(patient=req.patient, regimen=req.regimen, levels=req.levels or []))
