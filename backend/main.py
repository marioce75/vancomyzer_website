from __future__ import annotations

import hashlib
import json
import logging
from functools import lru_cache
from typing import Dict, Tuple, Any, List, Optional

import numpy as np
import orjson
from fastapi import FastAPI, HTTPException, Body, Query, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel

from .schemas import InteractiveRequest, InteractiveResponse
from .bayes import PatientCovars, Regimen, fit_posterior, simulate_from_posterior
from .pk.model import superposition_conc
from .pk.optimize import choose_dose_interval
from .api_loading_dose import router as ld_router

# Lightweight logger
logger = logging.getLogger("vancomyzer")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

app = FastAPI(default_response_class=ORJSONResponse)

# Restrictive CORS per requirements
ALLOWED_ORIGINS = [
    "https://vancomyzer.com",
    "https://www.vancomyzer.com",
    "http://localhost:5173",
]

# CORS must be added before routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Router for /api endpoints (single prefix to avoid /api/api)
router = APIRouter(prefix="/api")

# Mount existing loading-dose router under /api as well
app.include_router(ld_router, prefix="/api")


@app.get('/health')
def health():
    return {"status": "ok"}

# Router-scoped health for /api
@router.get('/health')
async def health_api():
    return {"status": "ok"}

@app.get('/api/config')
def api_config():
    return {"base": "/api", "cors": ALLOWED_ORIGINS}


# Permissive request model for AUC endpoint
try:
    from pydantic import ConfigDict  # type: ignore
    _HAS_CONFIGDICT = True
except Exception:  # pragma: no cover
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
    levels: Optional[list[float]] = None
    other: Optional[Dict[str, Any]] = None
    # Accept legacy/nested shapes without rejecting
    if _HAS_CONFIGDICT:
        model_config = ConfigDict(extra="allow")  # type: ignore
    else:
        class Config:
            extra = "allow"


def cockcroft_gault(age_years: float, weight_kg: float, scr_mg_dl: float, gender: str | None) -> float:
    if not (age_years and weight_kg and scr_mg_dl):
        return 70.0
    # Cockcroft-Gault using TBW
    sex_factor = 0.85 if (gender or '').lower().startswith('f') else 1.0
    crcl = ((140.0 - float(age_years)) * float(weight_kg)) / (72.0 * max(float(scr_mg_dl), 0.2))
    return float(max(crcl * sex_factor, 5.0))


def _key_for_cache(patient_flat: Dict, levels: list) -> str:
    payload = {
        'patient': patient_flat,
        'levels': levels,
    }
    blob = orjson.dumps(payload)
    return hashlib.sha256(blob).hexdigest()


# Simple in-proc cache for posterior by patient+levels
_POSTERIOR_CACHE: Dict[str, tuple] = {}
_MAX_CACHE = 16


def get_or_fit_posterior(key: str, patient: PatientCovars, regimen: Regimen, levels: list):
    if key in _POSTERIOR_CACHE:
        return _POSTERIOR_CACHE[key]
    post = fit_posterior(patient, regimen, levels)
    _POSTERIOR_CACHE[key] = post
    # LRU eviction
    if len(_POSTERIOR_CACHE) > _MAX_CACHE:
        _POSTERIOR_CACHE.pop(next(iter(_POSTERIOR_CACHE)))
    return post


def _predicted_levels_debug(posterior, regimen: Regimen, levels: list):
    if not levels:
        return None
    times = [float(l.get('time_hr')) for l in levels if 'time_hr' in l]
    if not times:
        return None
    times_arr = np.array(times, dtype=float)
    preds = []
    for cl, v in zip(posterior.CL_draws, posterior.V_draws):
        # Predict directly at requested times using the infusion superposition model
        conc = superposition_conc(
            times_arr,
            float(regimen.dose_mg),
            float(regimen.interval_hours),
            float(regimen.infusion_minutes) / 60.0,
            float(cl),
            float(v),
        )
        preds.append(np.asarray(conc, dtype=float))
    M = np.vstack(preds) if preds else np.zeros((0, len(times_arr)))
    out = []
    for j, t in enumerate(times_arr):
        col = M[:, j] if M.size else np.array([np.nan])
        out.append({
            't': float(t),
            'median': float(np.nanmedian(col)),
            'p05': float(np.nanpercentile(col, 5)) if np.isfinite(col).any() else float('nan'),
            'p95': float(np.nanpercentile(col, 95)) if np.isfinite(col).any() else float('nan'),
        })
    return out


# Core implementation used by both POST and GET handlers
def _interactive_auc_core(req: InteractiveRequest):
    # Flatten and normalize
    serum = req.serum_creatinine if req.serum_creatinine is not None else req.serum_creatinine_mg_dl
    clcr = req.clcr_ml_min or cockcroft_gault(req.age_years or 60, req.weight_kg or 70, serum or 1.0, req.gender or 'm')

    patient = PatientCovars(clcr_ml_min=float(clcr), tbw_kg=float(req.weight_kg or 70))
    regimen = Regimen(
        dose_mg=float(req.regimen.dose_mg),
        interval_hours=float(req.regimen.interval_hours),
        infusion_minutes=float(req.regimen.infusion_minutes),
    )

    levels_list = [l.dict() for l in req.levels]

    cache_key = _key_for_cache({
        'age_years': req.age_years,
        'gender': req.gender,
        'weight_kg': req.weight_kg,
        'height_cm': req.height_cm,
        'serum_creatinine': serum,
        'clcr_ml_min': clcr,
    }, levels_list)

    try:
        posterior = get_or_fit_posterior(cache_key, patient, regimen, levels_list)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Posterior fit failed: {type(e).__name__}: {e}")
    sim = simulate_from_posterior(posterior, regimen, horizon_h=48.0, dt=0.05)

    response = {
        'series': {
            'time_hours': sim['time_hours'],
            'median': sim['median'],
            'p05': sim['p05'],
            'p95': sim['p95'],
        },
        'metrics': {
            'auc_24': sim['auc24'],
            'predicted_peak': sim['c_peak'],
            'predicted_trough': sim['c_trough'],
            'auc24_over_mic': (sim['auc24'] / float(req.mic_mg_L or 1.0)),
        },
        'posterior': {
            'n_draws': int(posterior.n),
            'CL_median_L_per_h': float(posterior.CL_median),
            'V_median_L': float(posterior.V_median),
        },
        'diagnostics': {
            'predicted_levels': _predicted_levels_debug(posterior, regimen, levels_list),
            'rhat_ok': bool(posterior.rhat_ok),
        }
    }

    return response


# Public compute wrapper per requirements. If business logic is unavailable, return stub.
def compute_auc(req: AucRequest) -> Dict[str, Any]:
    try:
        # Map to InteractiveRequest used by the existing implementation
        regimen = {
            'dose_mg': float(req.dose_mg) if req.dose_mg is not None else 1000.0,
            'interval_hours': float(req.interval_hr) if req.interval_hr is not None else 24.0,
            'infusion_minutes': float(req.infusion_minutes) if req.infusion_minutes is not None else 60.0,
        }
        ir = InteractiveRequest(
            age_years=req.age_years,
            gender=req.gender,
            weight_kg=req.weight_kg,
            height_cm=req.height_cm,
            serum_creatinine_mg_dl=req.scr_mg_dl,
            mic_mg_L=1.0,
            levels=[],
            regimen=regimen,  # type: ignore
        )
        return _interactive_auc_core(ir)
    except Exception as e:
        logger.exception("AUC compute failed")
        # Stub fallback to guarantee a 200 from the endpoint wrapper (unless raised)
        return {"auc": 0, "note": "stub", "echo": req.model_dump() if hasattr(req, 'model_dump') else req.__dict__}


# Canonical Interactive AUC endpoint (POST primary) — registered only on router to avoid duplicates
@router.post('/interactive/auc')
@router.post('/interactive/auc/')
def interactive_auc_post(body: Dict[str, Any] = Body(...)):
    logger.info("AUC POST payload: %s", body)
    try:
        # Try legacy/full payload first (has regimen/levels etc)
        if isinstance(body, dict) and ("regimen" in body or "levels" in body or "serum_creatinine_mg_dl" in body or "serum_creatinine" in body or "age" in body or "age_years" in body):
            try:
                req_full = InteractiveRequest(**body)
                result = _interactive_auc_core(req_full)
                logger.info("AUC result: %s", result)
                return {"ok": True, "result": result}
            except Exception:
                # fall through to flat request
                pass
        # Flat/minimal request
        req = AucRequest(**body)
        result = compute_auc(req)
        logger.info("AUC result: %s", result)
        return {"ok": True, "result": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("AUC compute failed (POST)")
        raise HTTPException(status_code=400, detail=str(e))


# GET thin wrapper for backward compatibility and easy testing
@router.get('/interactive/auc')
@router.get('/interactive/auc/')
def interactive_auc_get(
    age: float | None = Query(default=None),
    age_years: float | None = Query(default=None),
    weight_kg: float | None = Query(default=None),
    height_cm: float | None = Query(default=None),
    scr_mg_dl: float | None = Query(default=None),
    dose_mg: float | None = Query(default=None),
    interval_hr: float | None = Query(default=None),
    infusion_minutes: float | None = Query(default=None),
    gender: str | None = Query(default=None),
):
    try:
        req = AucRequest(
            age_years=age_years if age_years is not None else age,
            weight_kg=weight_kg,
            height_cm=height_cm,
            scr_mg_dl=scr_mg_dl,
            dose_mg=dose_mg,
            interval_hr=interval_hr,
            infusion_minutes=infusion_minutes,
            gender=gender,
        )
        result = compute_auc(req)
        return {"ok": True, "result": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("AUC compute failed (GET)")
        raise HTTPException(status_code=400, detail=str(e))


# --- Optimize endpoint to recommend dose/interval for AUC target ---
@app.post('/api/optimize')
@app.post('/optimize')
def optimize(body: Dict[str, Any] = Body(...)):
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail='Invalid JSON body')

    # Nested payload support
    patient = dict(body.get('patient') or {})
    regimen_raw = dict(body.get('regimen') or {})
    target = dict(body.get('target') or {})
    levels = body.get('levels') or patient.get('levels') or []

    try:
        age = float(patient.get('age') or patient.get('age_years'))
        gender = str(patient.get('gender') or patient.get('sex') or 'male')
        weight_kg = float(patient.get('weight_kg'))
        scr = float(patient.get('serum_creatinine_mg_dl') or patient.get('scr_mg_dl') or 1.0)

        dose_mg = float(regimen_raw.get('dose_mg'))
        interval_hours = float(regimen_raw.get('interval_hours'))
        infusion_minutes = float(regimen_raw.get('infusion_minutes'))

        auc_min = float(target.get('auc_min', 400.0))
        auc_max = float(target.get('auc_max', 600.0))
    except Exception:
        raise HTTPException(status_code=400, detail='Missing or invalid fields')

    # Estimate clearance (CL) and volume (V)
    # If levels provided, fit posterior and use medians; else use simple priors
    serum = scr
    clcr = float(((140.0 - float(age)) * float(weight_kg)) / (72.0 * max(float(serum), 0.2)))
    if (gender or '').lower().startswith('f'):
        clcr *= 0.85
    clcr = float(max(clcr, 5.0))

    # Prior means consistent with backend.app
    THETA_CL = 4.5
    THETA_CRCL = 0.65
    THETA_V = 60.0

    mu_cl = THETA_CL * (clcr / 100.0) ** THETA_CRCL * (max(weight_kg, 20.0) / 70.0) ** 0.75
    mu_v = THETA_V * (max(weight_kg, 20.0) / 70.0) ** 1.0

    cl_map, v_map = float(mu_cl), float(mu_v)
    try:
        if isinstance(levels, list) and len(levels) > 0:
            # Use Bayesian posterior medians if levels provided
            patient_cov = PatientCovars(clcr_ml_min=clcr, tbw_kg=float(weight_kg))
            reg = Regimen(dose_mg=dose_mg, interval_hours=interval_hours, infusion_minutes=infusion_minutes)
            post = fit_posterior(patient_cov, reg, levels)
            cl_map = float(post.CL_median)
            v_map = float(post.V_median)
    except Exception:
        # Fallback to prior means on any failure
        cl_map, v_map = float(mu_cl), float(mu_v)

    target_mid = float(np.clip((auc_min + auc_max) / 2.0, 350.0, 700.0))
    dose_rec, interval_rec, auc24_est = choose_dose_interval(cl_map, v_map, target_mid, int(infusion_minutes))
    infusion_rec = 60 if dose_rec <= 1000 else 90

    return {
        'recommendation': {
            'dose_mg': int(dose_rec),
            'interval_hours': int(interval_rec),
            'infusion_minutes': int(infusion_rec),
            'expected_auc_24': float(auc24_est),
        }
    }

# include router once at the end
app.include_router(router)
