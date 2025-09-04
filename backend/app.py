from __future__ import annotations

import math
import os
from typing import List, Optional, Tuple, Any, Dict

import numpy as np
from fastapi import FastAPI, Body, HTTPException
from fastapi.routing import APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel, Field
from scipy.optimize import minimize
from scipy.stats import multivariate_normal

# Robust imports to support running as `backend.app` (package) and `app` (module in Docker)
try:
    from pk.model import (
        crcl_cockcroft_gault,
        superposition_conc,
        auc_trapz,
        peak_trough_from_series,
    )
    from pk.optimize import choose_dose_interval
except Exception:  # pragma: no cover
    from backend.pk.model import (  # type: ignore
        crcl_cockcroft_gault,
        superposition_conc,
        auc_trapz,
        peak_trough_from_series,
    )
    from backend.pk.optimize import choose_dose_interval  # type: ignore


# App without root_path; we'll mount routes under '/api' via a router
app = FastAPI(default_response_class=ORJSONResponse)
router = APIRouter(prefix="/api")


# CORS from env or defaults
_default_origins = [
    "https://vancomyzer.com",
    "http://localhost:5173",
]
_env_origins = os.getenv("ALLOWED_ORIGINS", ",".join(_default_origins))
ALLOWED_ORIGINS = [o.strip() for o in _env_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Priors parameters
THETA_CL = 4.5  # L/h
THETA_CRCL = 0.65
SIG_CL = 0.25
THETA_V = 60.0  # L
SIG_V = 0.20
SIGMA_RESID = 2.0  # mg/L


def prior_means(age: float, sex: str, weight_kg: float, scr_mgdl: float) -> Tuple[float, float]:
    crcl = crcl_cockcroft_gault(age, weight_kg, scr_mgdl, sex)
    mu_cl = THETA_CL * (max(crcl, 5.0) / 100.0) ** THETA_CRCL * (max(weight_kg, 20.0) / 70.0) ** 0.75
    mu_v = THETA_V * (max(weight_kg, 20.0) / 70.0) ** 1.0
    return mu_cl, mu_v


def neg_log_posterior(x: np.ndarray, levels: List[Tuple[float, float]], mu_cl: float, mu_v: float,
                      dose_mg: float, tau_h: float, tinf_h: float) -> float:
    cl, v = float(x[0]), float(x[1])
    if cl <= 0 or v <= 0:
        return 1e9
    # Priors (log-normal)
    z_cl = (math.log(cl) - math.log(mu_cl)) / SIG_CL
    z_v = (math.log(v) - math.log(mu_v)) / SIG_V
    nlp = 0.5 * (z_cl ** 2 + z_v ** 2)
    if levels:
        t_array = np.array([lv[0] for lv in levels], dtype=float)
        c_pred = superposition_conc(t_array, dose_mg, tau_h, tinf_h, cl, v)
        resid = (c_pred - np.array([lv[1] for lv in levels], dtype=float)) / SIGMA_RESID
        nlp += 0.5 * float(np.dot(resid, resid))
    return nlp


def finite_diff_hessian(func, x0, eps=1e-4):
    x0 = np.asarray(x0, dtype=float)
    n = x0.size
    H = np.zeros((n, n), dtype=float)
    fx = func(x0)
    for i in range(n):
        dx_i = np.zeros_like(x0)
        dx_i[i] = eps
        f_ip = func(x0 + dx_i)
        f_im = func(x0 - dx_i)
        H[i, i] = (f_ip - 2 * fx + f_im) / (eps ** 2)
        for j in range(i + 1, n):
            dx_j = np.zeros_like(x0)
            dx_j[j] = eps
            f_pp = func(x0 + dx_i + dx_j)
            f_pm = func(x0 + dx_i - dx_j)
            f_mp = func(x0 - dx_i + dx_j)
            f_mm = func(x0 - dx_i - dx_j)
            H_ij = (f_pp - f_pm - f_mp + f_mm) / (4 * eps * eps)
            H[i, j] = H_ij
            H[j, i] = H_ij
    eig_min = np.min(np.linalg.eigvalsh(H))
    if not np.isfinite(eig_min) or eig_min <= 1e-8:
        H = H + np.eye(n) * (1e-6 - eig_min if np.isfinite(eig_min) else 1e-3)
    return H


# Schemas for documentation only
class Level(BaseModel):
    time_hours: float | None = Field(default=None, description="Time since first dose (h)")
    time_hr: float | None = Field(default=None, description="Alias of time_hours")
    concentration_mg_L: float
    tag: Optional[str] = None


class Regimen(BaseModel):
    dose_mg: int
    interval_hours: int
    infusion_minutes: int


class Patient(BaseModel):
    age: float
    sex: str | None = Field(default=None)
    gender: str | None = Field(default=None)
    weight_kg: float
    height_cm: float | None = None
    scr_mg_dl: float | None = None
    serum_creatinine_mg_dl: float | None = None
    mic: float | None = 1.0
    levels: Optional[List[Level]] = None


@app.get("/health")
def health():
    return {"status": "ok"}


@router.get("/health")
def api_health():
    return {"status": "ok"}


def _normalize_auc_payload(body: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any], List[Dict[str, Any]]]:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    if "patient" in body and "regimen" in body:
        patient = dict(body.get("patient") or {})
        regimen = dict(body.get("regimen") or {})
        levels = patient.get("levels") or body.get("levels") or []
    else:
        # flat
        patient = {k: body.get(k) for k in (
            "age", "gender", "sex", "weight_kg", "height_cm", "serum_creatinine_mg_dl", "scr_mg_dl", "mic", "levels"
        ) if k in body}
        regimen = dict(body.get("regimen") or {})
        levels = body.get("levels") or patient.get("levels") or []
    return patient, regimen, levels


@router.post("/interactive/auc")
def interactive_auc(body: Dict[str, Any] = Body(...)):
    p_raw, r_raw, levels_raw = _normalize_auc_payload(body)
    try:
        age = float(p_raw.get("age"))
        gender = str(p_raw.get("gender") or p_raw.get("sex") or "male")
        weight_kg = float(p_raw.get("weight_kg"))
        scr = float(p_raw.get("serum_creatinine_mg_dl") or p_raw.get("scr_mg_dl") or 1.0)
        dose_mg = int(r_raw.get("dose_mg"))
        interval_hours = int(r_raw.get("interval_hours"))
        infusion_minutes = int(r_raw.get("infusion_minutes"))
    except Exception:
        raise HTTPException(status_code=400, detail="Missing or invalid fields")

    mu_cl, mu_v = prior_means(age, gender, weight_kg, scr)

    levels_list: List[Tuple[float, float]] = []
    for lv in levels_raw or []:
        try:
            t = lv.get("time_hours")
            if t is None:
                t = lv.get("time_hr")
            t = float(t)
            c = float(lv.get("concentration_mg_L"))
            if np.isfinite(t) and np.isfinite(c):
                levels_list.append((t, c))
        except Exception:
            continue

    # If no levels, act like population prior
    have_levels = len(levels_list) > 0
    if not have_levels:
        cl_map, v_map = mu_cl, mu_v
        cov = np.diag([(SIG_CL * cl_map) ** 2, (SIG_V * v_map) ** 2])
    else:
        levels = sorted(levels_list, key=lambda x: x[0])

        def nlp_xy(x):
            cl = float(np.clip(x[0], 0.5, 15.0))
            v = float(np.clip(x[1], 20.0, 120.0))
            return neg_log_posterior(np.array([cl, v]), levels, mu_cl, mu_v, dose_mg, interval_hours, infusion_minutes / 60)

        x0 = np.array([mu_cl, mu_v], dtype=float)
        bounds = [(0.5, 15.0), (20.0, 120.0)]
        res = minimize(lambda x: nlp_xy(x), x0=x0, method="L-BFGS-B", bounds=bounds)
        cl_map, v_map = float(res.x[0]), float(res.x[1])
        H = finite_diff_hessian(nlp_xy, np.array([cl_map, v_map], dtype=float))
        try:
            cov = np.linalg.inv(H)
        except np.linalg.LinAlgError:
            cov = np.diag([(SIG_CL * cl_map) ** 2, (SIG_V * v_map) ** 2])

    # Simulate curve and uncertainty bands
    horizon = 48.0
    dt = 0.1
    times = np.arange(0.0, horizon + 1e-9, dt)
    conc = superposition_conc(times, dose_mg, interval_hours, infusion_minutes / 60, cl_map, v_map)

    # Posterior draws via Laplace approx
    n_draws = 200
    draws = multivariate_normal.rvs(mean=[cl_map, v_map], cov=cov, size=n_draws, random_state=42)
    draws = np.atleast_2d(draws)
    conc_draws = []
    for cl_d, v_d in draws:
        cl_d = float(np.clip(cl_d, 0.5, 15.0))
        v_d = float(np.clip(v_d, 20.0, 120.0))
        conc_draws.append(superposition_conc(times, dose_mg, interval_hours, infusion_minutes / 60, cl_d, v_d))
    conc_draws = np.array(conc_draws)
    lower = np.percentile(conc_draws, 5, axis=0)
    upper = np.percentile(conc_draws, 95, axis=0)

    auc24 = auc_trapz(times, conc, 0.0, 24.0)
    pt = peak_trough_from_series(times, conc, float(interval_hours))

    result = {
        "metrics": {
            "auc_24": float(auc24),
            "predicted_peak": float(pt["peak"]),
            "predicted_trough": float(pt["trough"]),
        },
        "series": {
            "time_hours": [float(t) for t in times],
            "concentration_mg_L": [float(c) for c in conc],
            "lower": [float(x) for x in lower],
            "upper": [float(x) for x in upper],
        },
        "posterior": {
            "cl_mean": float(cl_map),
            "v_mean": float(v_map),
            "sd": {
                "cl": float(math.sqrt(max(1e-12, cov[0, 0]))),
                "v": float(math.sqrt(max(1e-12, cov[1, 1]))),
            },
            "n_draws": int(n_draws),
        },
    }
    return {"ok": True, "result": result}


def _normalize_opt_payload(body: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any], List[Dict[str, Any]]]:
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    if "patient" in body and "regimen" in body and "target" in body:
        patient = dict(body.get("patient") or {})
        regimen = dict(body.get("regimen") or {})
        target = dict(body.get("target") or {})
        levels = patient.get("levels") or body.get("levels") or []
    else:
        patient = {k: body.get(k) for k in (
            "age", "gender", "sex", "weight_kg", "height_cm", "serum_creatinine_mg_dl", "scr_mg_dl", "mic", "levels"
        ) if k in body}
        regimen = dict(body.get("regimen") or {})
        target = dict(body.get("target") or {})
        levels = body.get("levels") or patient.get("levels") or []
    return patient, regimen, target, levels


@app.post("/optimize")
@router.post("/optimize")
def optimize(body: Dict[str, Any] = Body(...)):
    p_raw, r_raw, tgt_raw, levels_raw = _normalize_opt_payload(body)
    try:
        age = float(p_raw.get("age"))
        gender = str(p_raw.get("gender") or p_raw.get("sex") or "male")
        weight_kg = float(p_raw.get("weight_kg"))
        scr = float(p_raw.get("serum_creatinine_mg_dl") or p_raw.get("scr_mg_dl") or 1.0)
        dose_mg = int(r_raw.get("dose_mg"))
        interval_hours = int(r_raw.get("interval_hours"))
        infusion_minutes = int(r_raw.get("infusion_minutes"))
        auc_min = float(tgt_raw.get("auc_min", 400.0))
        auc_max = float(tgt_raw.get("auc_max", 600.0))
    except Exception:
        raise HTTPException(status_code=400, detail="Missing or invalid fields")

    mu_cl, mu_v = prior_means(age, gender, weight_kg, scr)

    levels_list: List[Tuple[float, float]] = []
    for lv in levels_raw or []:
        try:
            t = lv.get("time_hours")
            if t is None:
                t = lv.get("time_hr")
            t = float(t)
            c = float(lv.get("concentration_mg_L"))
            if np.isfinite(t) and np.isfinite(c):
                levels_list.append((t, c))
        except Exception:
            continue

    # Fit MAP if levels provided, else use prior means
    if len(levels_list) > 0:
        levels = sorted(levels_list, key=lambda x: x[0])

        def nlp_xy(x):
            cl = float(np.clip(x[0], 0.5, 15.0))
            v = float(np.clip(x[1], 20.0, 120.0))
            return neg_log_posterior(np.array([cl, v]), levels, mu_cl, mu_v, dose_mg, interval_hours, infusion_minutes / 60)

        x0 = np.array([mu_cl, mu_v], dtype=float)
        bounds = [(0.5, 15.0), (20.0, 120.0)]
        res = minimize(lambda x: nlp_xy(x), x0=x0, method="L-BFGS-B", bounds=bounds)
        cl_map, v_map = float(res.x[0]), float(res.x[1])
    else:
        cl_map, v_map = mu_cl, mu_v

    target_mid = float(np.clip((auc_min + auc_max) / 2.0, 350.0, 700.0))

    dose_mg_rec, interval_hours_rec, auc24_est = choose_dose_interval(cl_map, v_map, target_mid, infusion_minutes)
    infusion_minutes_rec = 60 if dose_mg_rec <= 1000 else 90

    return {
        "recommendation": {
            "dose_mg": int(dose_mg_rec),
            "interval_hours": int(interval_hours_rec),
            "infusion_minutes": int(infusion_minutes_rec),
            "expected_auc_24": float(auc24_est),
        }
    }


# Backward-compat GET wrapper for quick manual tests; returns stubbed compute if params are flat
try:
    from pydantic import ConfigDict  # type: ignore
    _HAS_CONFIGDICT = True
except Exception:
    ConfigDict = None  # type: ignore
    _HAS_CONFIGDICT = False

class AucRequest(BaseModel):
    age_years: Optional[float] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    scr_mg_dl: Optional[float] = None
    gender: Optional[str] = None
    dose_mg: Optional[float] = None
    interval_hr: Optional[float] = None
    infusion_minutes: Optional[float] = 60.0
    levels: Optional[List[Dict[str, Any]]] = None
    other: Optional[Dict[str, Any]] = None
    if _HAS_CONFIGDICT:
        model_config = ConfigDict(extra="allow")  # type: ignore
    else:
        class Config:
            extra = "allow"

def compute_auc_stub(req: AucRequest) -> Dict[str, Any]:
    return {"auc": 0, "note": "stub", "echo": req.dict() if hasattr(req, 'dict') else {}}

@router.get("/interactive/auc")
def interactive_auc_get(**params):
    # simple stubbed GET for compatibility
    try:
        req = AucRequest(**params)
    except Exception:
        req = AucRequest()
    return {"ok": True, "result": compute_auc_stub(req)}

# include the API router once
app.include_router(router)
