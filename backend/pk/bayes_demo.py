from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, List, Optional, Tuple

import numpy as np

from backend.pk.sim import Event, concentration_time_series


@dataclass(frozen=True)
class Prior:
    # lognormal parameters for CL and V
    cl_median: float = 4.0  # L/hr
    cl_sigma: float = 0.35  # log-space std
    v_median: float = 50.0  # L
    v_sigma: float = 0.30


def _lognormal_logpdf(x: float, median: float, sigma: float) -> float:
    x = max(float(x), 1e-9)
    mu = math.log(float(median))
    s = float(sigma)
    return -math.log(x * s * math.sqrt(2 * math.pi)) - ((math.log(x) - mu) ** 2) / (2 * s * s)


def _neg_log_posterior(
    cl_l_hr: float,
    v_l: float,
    obs_t: np.ndarray,
    obs_c: np.ndarray,
    events: List[Event],
    prior: Prior,
    sigma_obs: float,
) -> float:
    # Prior
    lp = _lognormal_logpdf(cl_l_hr, prior.cl_median, prior.cl_sigma) + _lognormal_logpdf(v_l, prior.v_median, prior.v_sigma)

    # Likelihood (Gaussian)
    pred = concentration_time_series(obs_t, events, cl_l_hr=cl_l_hr, v_l=v_l)
    resid = obs_c - pred
    s = max(float(sigma_obs), 1e-6)
    ll = -0.5 * float(np.sum((resid / s) ** 2)) - obs_c.size * math.log(s * math.sqrt(2 * math.pi))

    # Negative log posterior
    return -(lp + ll)


def map_fit_demo(
    events: List[Event],
    levels: List[Tuple[float, float]],
    prior: Optional[Prior] = None,
    sigma_obs: float = 2.0,
) -> Tuple[float, float, float]:
    """Simple MAP 'Bayesian' demo.

    - Coarse grid search over CL and V
    - Local refinement around best cell

    Returns: (cl_l_hr, v_l, rmse)

    Educational demonstration only.
    """

    if prior is None:
        prior = Prior()

    if not events:
        raise ValueError("dose history is required")
    if not levels:
        raise ValueError("at least 1 level is required")

    obs_t = np.array([t for t, _ in levels], dtype=float)
    obs_c = np.array([c for _, c in levels], dtype=float)

    # Coarse grid
    cl_grid = np.linspace(1.0, 10.0, 46)  # 1..10 L/hr
    v_grid = np.linspace(20.0, 120.0, 51)  # 20..120 L

    best = (float("inf"), prior.cl_median, prior.v_median)
    for cl in cl_grid:
        for v in v_grid:
            nlp = _neg_log_posterior(cl, v, obs_t, obs_c, events, prior, sigma_obs)
            if nlp < best[0]:
                best = (nlp, cl, v)

    _, cl0, v0 = best

    # Local refinement: small coordinate search
    cl = float(cl0)
    v = float(v0)
    step_cl = 0.5
    step_v = 5.0

    for _ in range(20):
        improved = False
        base = _neg_log_posterior(cl, v, obs_t, obs_c, events, prior, sigma_obs)
        candidates = [
            (cl + step_cl, v),
            (max(0.5, cl - step_cl), v),
            (cl, v + step_v),
            (cl, max(5.0, v - step_v)),
        ]
        for cl2, v2 in candidates:
            nlp = _neg_log_posterior(cl2, v2, obs_t, obs_c, events, prior, sigma_obs)
            if nlp < base:
                cl, v, base = float(cl2), float(v2), nlp
                improved = True
        if not improved:
            step_cl *= 0.7
            step_v *= 0.7
            if step_cl < 0.05 and step_v < 0.5:
                break

    pred = concentration_time_series(obs_t, events, cl_l_hr=cl, v_l=v)
    rmse = float(np.sqrt(np.mean((obs_c - pred) ** 2)))
    return cl, v, rmse
