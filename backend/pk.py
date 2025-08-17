"""
PK utilities for vancomycin
One-compartment model, zero-order infusion, first-order elimination.
Units: dose mg, time h, concentration mg/L, CL L/h, V L
"""
from __future__ import annotations

from typing import Iterable, Tuple
import numpy as np

# Numerical safety epsilon
_EPS = 1e-12


def _ensure_1d(a: Iterable[float]) -> np.ndarray:
    x = np.asarray(list(a), dtype=float)
    return x.reshape(-1)


def superposition_curve(
    CL: float,
    V: float,
    dose_mg: float,
    tau_h: float,
    tinf_min: float,
    horizon_h: float = 48.0,
    dt: float = 0.05,
    n_doses: int = 10,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Simulate concentration-time curve using superposition of multiple doses.

    Returns (t, c) with t in hours and c in mg/L.
    """
    tinf_h = max(0.25, float(tinf_min) / 60.0)
    R0 = float(dose_mg) / tinf_h
    k = float(CL) / float(V)

    t = np.arange(0.0, horizon_h + dt / 2, dt, dtype=float)
    c = np.zeros_like(t)

    tau = float(tau_h)
    dose_times = [i * tau for i in range(max(1, n_doses))]
    # Include dose times up to horizon + tinf
    dose_times = [tt for tt in dose_times if tt <= horizon_h + tinf_h + 1e-9]

    for tDose in dose_times:
        td = t - tDose
        mask_valid = td >= 0
        if not np.any(mask_valid):
            continue
        # During infusion
        mask_infusion = mask_valid & (td <= tinf_h)
        if np.any(mask_infusion):
            td_infusion = td[mask_infusion]
            c[mask_infusion] += (R0 / (k * V)) * (1.0 - np.exp(-k * td_infusion))
        # After infusion
        mask_post = mask_valid & (td > tinf_h)
        if np.any(mask_post):
            td_post = td[mask_post]
            c[mask_post] += (R0 / (k * V)) * (1.0 - np.exp(-k * tinf_h)) * np.exp(-k * (td_post - tinf_h))

    return t, c


def predict_at_times(
    CL: float,
    V: float,
    dose_mg: float,
    tau_h: float,
    tinf_min: float,
    times_hr: Iterable[float],
) -> np.ndarray:
    """Predict concentrations at arbitrary measurement times (hours since first infusion start)."""
    tinf_h = max(0.25, float(tinf_min) / 60.0)
    R0 = float(dose_mg) / tinf_h
    k = float(CL) / float(V)

    t = _ensure_1d(times_hr)
    c = np.zeros_like(t)

    tau = float(tau_h)
    # Enough doses to cover the largest time point
    t_max = float(t.max() if t.size else 0.0)
    n_doses = int(np.ceil((t_max + tinf_h + 1e-9) / tau)) + 1
    dose_times = [i * tau for i in range(max(1, n_doses))]

    for tDose in dose_times:
        td = t - tDose
        mask_valid = td >= 0
        if not np.any(mask_valid):
            continue
        mask_infusion = mask_valid & (td <= tinf_h)
        if np.any(mask_infusion):
            td_infusion = td[mask_infusion]
            c[mask_infusion] += (R0 / (k * V)) * (1.0 - np.exp(-k * td_infusion))
        mask_post = mask_valid & (td > tinf_h)
        if np.any(mask_post):
            td_post = td[mask_post]
            c[mask_post] += (R0 / (k * V)) * (1.0 - np.exp(-k * tinf_h)) * np.exp(-k * (td_post - tinf_h))

    return np.clip(c, _EPS, None)


def auc_trapezoid(t: np.ndarray, c: np.ndarray, t0: float = 0.0, t1: float = 24.0) -> float:
    """Trapezoidal AUC between t0 and t1 (hours)."""
    t = np.asarray(t, dtype=float)
    c = np.asarray(c, dtype=float)
    # Ensure within bounds
    if t.size == 0:
        return 0.0
    # Interpolate to include t0 and t1 if needed
    def _interp(x):
        return np.interp(x, t, c)

    # Build mask for segments overlapping [t0, t1]
    auc = 0.0
    for i in range(1, t.size):
        a, b = t[i - 1], t[i]
        if b <= t0:
            continue
        if a >= t1:
            break
        aa = max(a, t0)
        bb = min(b, t1)
        ya = _interp(aa)
        yb = _interp(bb)
        auc += 0.5 * (ya + yb) * (bb - aa)
    return float(auc)
