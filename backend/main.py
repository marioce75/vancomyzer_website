from __future__ import annotations

import hashlib
import json
from functools import lru_cache
from typing import Dict, Tuple

import numpy as np
import orjson
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from .schemas import InteractiveRequest, InteractiveResponse
from .bayes import PatientCovars, Regimen, fit_posterior, simulate_from_posterior
from .pk import predict_at_times

app = FastAPI(default_response_class=ORJSONResponse)

# Allow CORS for frontend dev and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get('/health')
def health():
    return {"status": "ok"}

# Alias to support clients configured with base '/api'
@app.get('/api/health')
def health_api():
    return {"status": "ok"}


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
        preds.append(predict_at_times(float(cl), float(v), regimen.dose_mg, regimen.interval_hours, regimen.infusion_minutes, times_arr))
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


@app.post('/api/dose/interactive', response_model=InteractiveResponse)
def interactive(req: InteractiveRequest):
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

    posterior = get_or_fit_posterior(cache_key, patient, regimen, levels_list)
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

# Alias to support new client path
@app.post('/api/interactive/auc', response_model=InteractiveResponse)
def interactive_auc(req: InteractiveRequest):
    return interactive(req)
