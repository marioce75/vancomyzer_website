from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

from backend.pk.sim import Event, concentration_time_series, simulate_regimen_0_48h, auc_trapz


DATA_DIR = Path(__file__).resolve().parents[2] / "data"
PRIORS_PATH = DATA_DIR / "priors.json"


@dataclass
class Priors:
    sigma_log_cl: float
    sigma_log_v: float
    sigma_add: float
    sigma_prop: float


def load_priors() -> Priors:
    if not PRIORS_PATH.exists():
        return Priors(sigma_log_cl=0.25, sigma_log_v=0.25, sigma_add=1.5, sigma_prop=0.15)
    payload = json.loads(PRIORS_PATH.read_text())
    return Priors(
        sigma_log_cl=float(payload.get("sigma_log_cl", 0.25)),
        sigma_log_v=float(payload.get("sigma_log_v", 0.25)),
        sigma_add=float(payload.get("sigma_add", 1.5)),
        sigma_prop=float(payload.get("sigma_prop", 0.15)),
    )


def _lognorm_logpdf(x: float, mean: float, sigma_log: float) -> float:
    x = max(float(x), 1e-9)
    mu = math.log(max(mean, 1e-9))
    s = max(float(sigma_log), 1e-6)
    return -math.log(x * s * math.sqrt(2 * math.pi)) - ((math.log(x) - mu) ** 2) / (2 * s * s)


def _log_likelihood(
    cl_l_hr: float,
    v_l: float,
    obs_t: np.ndarray,
    obs_c: np.ndarray,
    events: List[Event],
    sigma_add: float,
    sigma_prop: float,
) -> float:
    pred = concentration_time_series(obs_t, events, cl_l_hr=cl_l_hr, v_l=v_l)
    sigma = np.sqrt((sigma_add ** 2) + (sigma_prop * pred) ** 2)
    sigma = np.maximum(sigma, 1e-6)
    resid = obs_c - pred
    return -0.5 * float(np.sum((resid / sigma) ** 2 + np.log(2 * math.pi * sigma ** 2)))


def _neg_log_posterior(
    cl_l_hr: float,
    v_l: float,
    obs_t: np.ndarray,
    obs_c: np.ndarray,
    events: List[Event],
    cl_mean: float,
    v_mean: float,
    priors: Priors,
) -> float:
    lp = _lognorm_logpdf(cl_l_hr, cl_mean, priors.sigma_log_cl) + _lognorm_logpdf(v_l, v_mean, priors.sigma_log_v)
    ll = _log_likelihood(cl_l_hr, v_l, obs_t, obs_c, events, priors.sigma_add, priors.sigma_prop)
    return -(lp + ll)


def map_fit(
    events: List[Event],
    levels: List[Tuple[float, float]],
    cl_mean: float,
    v_mean: float,
    priors: Optional[Priors] = None,
) -> Tuple[float, float]:
    if not events:
        raise ValueError("dose history is required")
    if not levels:
        raise ValueError("at least 1 level is required")
    priors = priors or load_priors()

    obs_t = np.array([t for t, _ in levels], dtype=float)
    obs_c = np.array([c for _, c in levels], dtype=float)

    # Grid search around prior mean
    cl_grid = np.linspace(max(0.5, cl_mean * 0.3), cl_mean * 2.5, 48)
    v_grid = np.linspace(max(10.0, v_mean * 0.3), v_mean * 2.5, 48)
    best = (float("inf"), cl_mean, v_mean)
    for cl in cl_grid:
        for v in v_grid:
            nlp = _neg_log_posterior(cl, v, obs_t, obs_c, events, cl_mean, v_mean, priors)
            if nlp < best[0]:
                best = (nlp, cl, v)

    cl, v = float(best[1]), float(best[2])
    step_cl = max(cl_mean * 0.05, 0.2)
    step_v = max(v_mean * 0.05, 2.0)
    for _ in range(30):
        base = _neg_log_posterior(cl, v, obs_t, obs_c, events, cl_mean, v_mean, priors)
        improved = False
        for cl2, v2 in [
            (cl + step_cl, v),
            (max(0.2, cl - step_cl), v),
            (cl, v + step_v),
            (cl, max(5.0, v - step_v)),
        ]:
            nlp = _neg_log_posterior(cl2, v2, obs_t, obs_c, events, cl_mean, v_mean, priors)
            if nlp < base:
                cl, v, base = float(cl2), float(v2), nlp
                improved = True
        if not improved:
            step_cl *= 0.6
            step_v *= 0.6
            if step_cl < 0.05 and step_v < 0.5:
                break
    return cl, v


def estimate_auc24(events: List[Event], cl_l_hr: float, v_l: float) -> float:
    t, c = simulate_regimen_0_48h(
        cl_l_hr=cl_l_hr,
        v_l=v_l,
        dose_mg=events[0].dose_mg,
        interval_hr=events[1].start_hr - events[0].start_hr if len(events) > 1 else 12.0,
        infusion_hr=events[0].infusion_hr,
        dt_min=10.0,
    )
    return float(auc_trapz(t, c, 0.0, 24.0))


def curve_with_band(
    events: List[Event],
    cl_l_hr: float,
    v_l: float,
    priors: Priors,
    n: int = 80,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    t, c = simulate_regimen_0_48h(
        cl_l_hr=cl_l_hr,
        v_l=v_l,
        dose_mg=events[0].dose_mg,
        interval_hr=events[1].start_hr - events[0].start_hr if len(events) > 1 else 12.0,
        infusion_hr=events[0].infusion_hr,
        dt_min=10.0,
    )
    rng = np.random.default_rng(42)
    cl_draws = np.exp(np.log(cl_l_hr) + rng.normal(0, priors.sigma_log_cl, size=n))
    v_draws = np.exp(np.log(v_l) + rng.normal(0, priors.sigma_log_v, size=n))
    samples = []
    for cl_d, v_d in zip(cl_draws, v_draws):
        _, cc = simulate_regimen_0_48h(
            cl_l_hr=float(cl_d),
            v_l=float(v_d),
            dose_mg=events[0].dose_mg,
            interval_hr=events[1].start_hr - events[0].start_hr if len(events) > 1 else 12.0,
            infusion_hr=events[0].infusion_hr,
            dt_min=10.0,
        )
        samples.append(cc)
    stack = np.vstack(samples)
    lower = np.percentile(stack, 2.5, axis=0)
    upper = np.percentile(stack, 97.5, axis=0)
    return t, c, lower, upper


def recommended_dose_adjustment(
    cl_l_hr: float,
    interval_hr: float,
    weight_kg: float,
    target_low: float = 400.0,
    target_high: float = 600.0,
    mic: float = 1.0,
) -> Dict[str, float]:
    target = (target_low + target_high) / 2.0
    daily_dose = target * cl_l_hr * mic * 1000.0
    per_dose = daily_dose * (interval_hr / 24.0)

    # Guideline-aligned guardrails (educational)
    max_loading = min(3000.0, 25.0 * weight_kg)
    max_daily = min(4500.0, 100.0 * weight_kg)

    return {
        "target_auc": target,
        "daily_dose_mg": float(min(daily_dose, max_daily)),
        "per_dose_mg": float(min(per_dose, max_daily * (interval_hr / 24.0))),
        "interval_hr": float(interval_hr),
        "max_loading_mg": float(max_loading),
        "max_daily_mg": float(max_daily),
    }
