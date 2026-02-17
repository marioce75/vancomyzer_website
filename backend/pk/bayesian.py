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


def _neg_log_posterior_log(
    theta: np.ndarray,
    obs_t: np.ndarray,
    obs_c: np.ndarray,
    events: List[Event],
    cl_mean: float,
    v_mean: float,
    priors: Priors,
) -> float:
    cl = float(np.exp(theta[0]))
    v = float(np.exp(theta[1]))
    return _neg_log_posterior(cl, v, obs_t, obs_c, events, cl_mean, v_mean, priors)


def _hessian_2d(func, x: np.ndarray, eps: float = 1e-3) -> np.ndarray:
    h = np.zeros((2, 2), dtype=float)
    f0 = func(x)
    for i in range(2):
        x_ip = x.copy()
        x_im = x.copy()
        x_ip[i] += eps
        x_im[i] -= eps
        f_ip = func(x_ip)
        f_im = func(x_im)
        h[i, i] = (f_ip - 2 * f0 + f_im) / (eps * eps)
        for j in range(i + 1, 2):
            x_pp = x.copy()
            x_pm = x.copy()
            x_mp = x.copy()
            x_mm = x.copy()
            x_pp[i] += eps
            x_pp[j] += eps
            x_pm[i] += eps
            x_pm[j] -= eps
            x_mp[i] -= eps
            x_mp[j] += eps
            x_mm[i] -= eps
            x_mm[j] -= eps
            f_pp = func(x_pp)
            f_pm = func(x_pm)
            f_mp = func(x_mp)
            f_mm = func(x_mm)
            h_ij = (f_pp - f_pm - f_mp + f_mm) / (4 * eps * eps)
            h[i, j] = h_ij
            h[j, i] = h_ij
    return h


def posterior_samples(
    events: List[Event],
    levels: List[Tuple[float, float]],
    cl_mean: float,
    v_mean: float,
    priors: Optional[Priors] = None,
    n: int = 200,
) -> Tuple[float, float, np.ndarray]:
    """
    MAP fit + Laplace approximation in log-space.
    Returns MAP cl, MAP v, and samples of (cl, v).
    """
    priors = priors or load_priors()
    cl_map, v_map = map_fit(events, levels, cl_mean, v_mean, priors)

    obs_t = np.array([t for t, _ in levels], dtype=float)
    obs_c = np.array([c for _, c in levels], dtype=float)
    theta0 = np.log(np.array([cl_map, v_map]))

    def nlp(theta: np.ndarray) -> float:
        return _neg_log_posterior_log(theta, obs_t, obs_c, events, cl_mean, v_mean, priors)

    hess = _hessian_2d(nlp, theta0)
    try:
        cov = np.linalg.inv(hess)
    except np.linalg.LinAlgError:
        cov = np.diag([priors.sigma_log_cl ** 2, priors.sigma_log_v ** 2])

    rng = np.random.default_rng(42)
    draws = rng.multivariate_normal(mean=theta0, cov=cov, size=n)
    samples = np.exp(draws)
    return cl_map, v_map, samples


def predict_levels(
    events: List[Event],
    times_hr: List[float],
    cl_l_hr: float,
    v_l: float,
) -> np.ndarray:
    t = np.array(times_hr, dtype=float)
    return concentration_time_series(t, events, cl_l_hr=cl_l_hr, v_l=v_l)


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
