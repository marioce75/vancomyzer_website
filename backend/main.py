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

from .schemas import InteractiveRequest, InteractiveResponse, Series, PosteriorInfo
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
_POSTERIOR_CACHE: Dict[str, Tuple] = {}
_MAX_CACHE = 16


def get_or_fit_posterior(key: str, patient: PatientCovars, regimen: Regimen, levels: list):
    if key in _POSTERIOR_CACHE:
        return _POSTERIOR_CACHE[key]
    post = fit_posterior(patient, regimen, levels)
    _POSTERIOR_CACHE[key] = post
    # LRU eviction
    if len(_POSTERIOR_CACHE) > _MAX_CACHE:
        # pop arbitrary oldest by insertion order
        _POSTERIOR_CACHE.pop(next(iter(_POSTERIOR_CACHE)))
    return post


def _predicted_levels_debug(posterior, regimen: Regimen, levels: list):
    if not levels:
        return None
    times = [float(l.get('time_hr')) for l in levels if 'time_hr' in l]
    if not times:
        return None
    times_arr = np.array(times, dtype=float)
    # For each draw, predict at all times, then take quantiles
    preds = []
    for cl, v in zip(posterior.CL_draws, posterior.V_draws):
        preds.append(predict_at_times(float(cl), float(v), regimen.dose_mg, regimen.interval_hours, regimen.infusion_minutes, times_arr))
    M = np.vstack(preds) if preds else np.zeros((0, len(times_arr)))
    out = []
    for j, t in enumerate(times_arr):
        col = M[:, j] if M.size else np.array([np.nan])
        out.append({
            'time_hr': float(t),
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

    cache_key = _key_for_cache({
        'age_years': req.age_years,
        'gender': req.gender,
        'weight_kg': req.weight_kg,
        'height_cm': req.height_cm,
        'serum_creatinine': serum,
        'clcr_ml_min': clcr,
    }, [l.dict() for l in req.levels])

    posterior = get_or_fit_posterior(cache_key, patient, regimen, [l.dict() for l in req.levels])
    sim = simulate_from_posterior(posterior, regimen, horizon_h=48.0, dt=0.05)

    series = Series(
        time_hours=sim['time_hours'],
        concentration_mg_L=sim['median'],
        lower=sim['p05'],
        upper=sim['p95'],
    )

    resp = InteractiveResponse(
        series=series,
        auc_24=sim['auc24'],
        predicted_trough=sim['c_trough'],
        predicted_peak=sim['c_peak'],
        posterior=PosteriorInfo(n_draws=int(posterior.n)),
        debug={'predicted_levels': _predicted_levels_debug(posterior, regimen, [l.dict() for l in req.levels])},
    )

    return resp
