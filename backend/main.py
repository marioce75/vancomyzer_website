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
    """Compute AUC and curve using Bayesian engine when available, with robust input normalization.

    Returns a dict with keys:
      - auc_24, predicted_peak, predicted_trough
      - series: { time_hours, concentration_mg_L, p05, p95 }
      - params_used: echo of normalized inputs
    """
    # Normalization helpers
    def _f(x):
        return None if x is None else float(x)

    age = _f(req.age_years)
    wt = _f(req.weight_kg)
    ht = _f(req.height_cm)
    scr = _f(req.scr_mg_dl)
    dose = _f(req.dose_mg)
    tau = _f(req.interval_hr)
    inf = _f(req.infusion_minutes) or 60.0
    gender = (req.gender or "").lower() or None
    levels = req.levels or None

    logger.info(
        "AUC normalized inputs: age=%s, weight_kg=%s, height_cm=%s, scr_mg_dl=%s, gender=%s, dose_mg=%s, interval_hr=%s, infusion_min=%s, levels=%s",
        age, wt, ht, scr, gender, dose, tau, inf, "yes" if levels else "no",
    )

    # Input checks
    if dose is None or tau is None:
        raise HTTPException(status_code=400, detail="dose_mg and interval_hr are required")
    if scr is None and not levels:
        raise HTTPException(status_code=400, detail="Provide scr_mg_dl or levels for Bayesian update")

    # Time grid per spec
    horizon = float(max(24.0, tau))
    dt = 0.25
    times = np.arange(0.0, horizon + 1e-9, dt, dtype=float)

    result_model: Dict[str, Any] | None = None

    # Try Bayesian path first
    try:
        try:
            from .bayes import PatientCovars as _PC, Regimen as _RG, fit_posterior as _fit, simulate_from_posterior as _sim
            bayes_ok = True
        except Exception:
            bayes_ok = False
            _PC = _RG = _fit = _sim = None  # type: ignore

        if bayes_ok:
            # Cockcroft–Gault for CrCl if available inputs; otherwise default
            clcr = cockcroft_gault(age or 60.0, wt or 70.0, scr or 1.0, gender or 'm')
            patient = _PC(clcr_ml_min=float(clcr), tbw_kg=float(wt or 70.0))
            regimen = _RG(dose_mg=float(dose), interval_hours=float(tau), infusion_minutes=float(inf))

            # Normalize levels to list[{time_hr, concentration_mg_L}]
            lvl_list: List[Dict[str, float]] = []
            if isinstance(levels, list):
                for lv in levels:
                    if isinstance(lv, dict):
                        t = lv.get('time_hr') or lv.get('time_hours')
                        c = lv.get('concentration_mg_L') or lv.get('conc') or lv.get('value')
                        try:
                            if t is not None and c is not None:
                                lvl_list.append({'time_hr': float(t), 'concentration_mg_L': float(c)})
                        except Exception:
                            continue
            logger.info("AUC path: bayesian (%s)", "with-levels" if len(lvl_list) > 0 else "prior-only")

            posterior = _fit(patient, regimen, lvl_list)
            sim = _sim(posterior, regimen, horizon_h=horizon, dt=min(dt, 0.05))
            # Resample onto 0.25 h grid per requirements
            t_src = np.asarray(sim.get('time_hours') or [], dtype=float)
            m_src = np.asarray(sim.get('median') or [], dtype=float)
            p05_src = np.asarray(sim.get('p05') or [], dtype=float) if sim.get('p05') is not None else None
            p95_src = np.asarray(sim.get('p95') or [], dtype=float) if sim.get('p95') is not None else None
            t_grid = np.arange(0.0, horizon + 1e-9, 0.25, dtype=float)
            if t_src.size and m_src.size:
                m_grid = np.interp(t_grid, t_src, m_src)
                p05_grid = np.interp(t_grid, t_src, p05_src) if p05_src is not None and p05_src.size else None
                p95_grid = np.interp(t_grid, t_src, p95_src) if p95_src is not None and p95_src.size else None
            else:
                m_grid = np.zeros_like(t_grid)
                p05_grid = None
                p95_grid = None
            result_model = {
                'auc_24': sim.get('auc24'),
                'peak': sim.get('c_peak'),
                'trough': sim.get('c_trough'),
                'time': t_grid.tolist(),
                'conc': m_grid.tolist(),
                'p05': p05_grid.tolist() if isinstance(p05_grid, np.ndarray) else None,
                'p95': p95_grid.tolist() if isinstance(p95_grid, np.ndarray) else None,
            }
    except HTTPException:
        raise
    except Exception as e:  # Log and continue to fallback
        logger.exception("Bayesian engine failed; falling back to CL estimate: %s", e)
        result_model = None

    # Fallback: deterministic PK using CL/V prior means
    if result_model is None:
        try:
            # Estimate CL and V from simple priors
            clcr = cockcroft_gault(age or 60.0, wt or 70.0, scr or 1.0, gender or 'm')
            mu_cl = 4.5 * (max(clcr, 5.0) / 100.0) ** 0.65 * (max(wt or 70.0, 20.0) / 70.0) ** 0.75
            mu_v = 60.0 * (max(wt or 70.0, 20.0) / 70.0) ** 1.0
            from .pk.model import auc_trapz as _auc_trapz, peak_trough_from_series as _pt
            conc = superposition_conc(times, float(dose), float(tau), float(inf) / 60.0, float(mu_cl), float(mu_v))
            auc24 = _auc_trapz(times, conc, 0.0, 24.0)
            pt = _pt(times, conc, float(tau))
            result_model = {
                'auc_24': float(auc24),
                'peak': float(pt.get('peak', np.nan)),
                'trough': float(pt.get('trough', np.nan)),
                'time': [float(x) for x in times.tolist()],
                'conc': [float(x) for x in conc.tolist()],
                'p05': None,
                'p95': None,
            }
            logger.info("AUC path: deterministic prior CL/V")
        except Exception as e:
            logger.exception("AUC fallback failed: %s", e)
            raise HTTPException(status_code=500, detail="Bayesian engine not available")

    # Output mapping per spec
    out = {
        'auc_24': float(result_model.get('auc_24')) if result_model.get('auc_24') is not None else None,
        'predicted_peak': float(result_model.get('peak')) if result_model.get('peak') is not None else None,
        'predicted_trough': float(result_model.get('trough')) if result_model.get('trough') is not None else None,
        'series': {
            'time_hours': [float(x) for x in (result_model.get('time') or [])],
            'concentration_mg_L': [float(x) for x in (result_model.get('conc') or [])],
            'p05': result_model.get('p05'),
            'p95': result_model.get('p95'),
        },
        'params_used': {
            'age_years': age,
            'weight_kg': wt,
            'height_cm': ht,
            'scr_mg_dl': scr,
            'gender': gender,
            'dose_mg': dose,
            'interval_hr': tau,
            'infusion_minutes': float(inf),
        },
    }
    return out


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
