from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="Vancomyzer API", openapi_url="/api/openapi.json")

# CORS for static site
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/api/health")
def health():
    return {"status": "ok"}

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
