"""
Two-compartment IV infusion model with first-order elimination.

C1 (central): dose input, CL elimination, Q to/from peripheral
C2 (peripheral): Q to/from central only

All times in hours; concentrations in mg/L; doses in mg.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Sequence, Tuple

import numpy as np
from scipy.integrate import solve_ivp

# Minimum values to avoid division by zero / log(0)
_CL_MIN = 1e-6
_V_MIN = 1e-6
_Q_MIN = 1e-9


@dataclass(frozen=True)
class DoseEvent:
    """Single dose event: start_hr, infusion duration, amount (mg)."""
    dose_mg: float
    start_hr: float
    infusion_hr: float


def _infusion_rate_at(t: float, events: Sequence[DoseEvent]) -> float:
    """Rate (mg/h) into central at time t (superposition of all infusions)."""
    rate = 0.0
    for ev in events:
        if ev.start_hr <= t < ev.start_hr + ev.infusion_hr and ev.infusion_hr > 0:
            rate += ev.dose_mg / ev.infusion_hr
    return rate


def _ode(t: float, y: np.ndarray, cl: float, v1: float, q: float, v2: float, rate_fn) -> np.ndarray:
    """ODE: y = [C1, C2]. dC1/dt = R/V1 - (CL/V1)*C1 - (Q/V1)*C1 + (Q/V2)*C2; dC2/dt = (Q/V1)*C1 - (Q/V2)*C2."""
    c1, c2 = float(y[0]), float(y[1])
    cl = max(cl, _CL_MIN)
    v1 = max(v1, _V_MIN)
    v2 = max(v2, _V_MIN)
    q = max(q, _Q_MIN)
    r = rate_fn(t)
    dc1 = (r / v1) - (cl / v1) * c1 - (q / v1) * c1 + (q / v2) * c2
    dc2 = (q / v1) * c1 - (q / v2) * c2
    return np.array([dc1, dc2])


def concentration_timecourse(
    params: dict,
    regimen: Sequence[DoseEvent],
    times_h: np.ndarray,
) -> np.ndarray:
    """
    Simulate concentration (central compartment, mg/L) at times_h.

    params: dict with keys CL, V1, Q, V2 (L/h and L).
    regimen: list of DoseEvent.
    times_h: 1D array of time points (hours).
    Returns: 1D array of concentrations at times_h (same length).
    """
    cl = float(params.get("CL", 4.0))
    v1 = float(params.get("V1", 35.0))
    q = float(params.get("Q", 3.0))
    v2 = float(params.get("V2", 25.0))
    cl = max(cl, _CL_MIN)
    v1 = max(v1, _V_MIN)
    v2 = max(v2, _V_MIN)
    q = max(q, _Q_MIN)

    t_span = (float(np.min(times_h)), float(np.max(times_h)) + 0.01)
    t_eval = np.unique(np.clip(times_h, t_span[0], t_span[1]))
    if t_eval.size == 0:
        return np.zeros_like(times_h, dtype=float)

    def rate_fn(t: float) -> float:
        return _infusion_rate_at(t, regimen)

    def fun(t: float, y: np.ndarray) -> np.ndarray:
        return _ode(t, y, cl, v1, q, v2, rate_fn)

    try:
        sol = solve_ivp(
            fun,
            t_span,
            np.array([0.0, 0.0]),
            t_eval=t_eval,
            method="LSODA",
            rtol=1e-6,
            atol=1e-8,
        )
    except Exception as e:
        raise ValueError(f"ODE solver failed: {e}") from e

    if not sol.success:
        raise ValueError(f"ODE solver did not succeed: {sol.message}")

    c_central = sol.y[0]
    if np.any(np.isnan(c_central)) or np.any(c_central < -1e-6):
        raise ValueError("Concentration solution contains NaN or negative values")

    # Interpolate to requested times
    out = np.interp(times_h, t_eval, c_central)
    return np.maximum(out, 0.0)


def predict_levels(
    params: dict,
    events: Sequence[DoseEvent],
    sample_times_h: Sequence[float],
) -> np.ndarray:
    """
    Predict concentrations (mg/L) at sample_times_h given params and dose events.

    params: dict CL, V1, Q, V2.
    events: dose history.
    sample_times_h: list/array of sampling times (hours).
    """
    times = np.asarray(sample_times_h, dtype=float)
    if times.size == 0:
        return np.array([], dtype=float)
    return concentration_timecourse(params, list(events), times)
