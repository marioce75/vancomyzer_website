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


def calculate_loading_dose(weight_kg: float, per_kg_mg: float = 25.0, max_mg: float = 3000.0, round_to_mg: float = 250.0) -> dict:
    """Calculate loading dose per TBW, capped and rounded.
    Returns dict with keys: ld_mg, raw_mg, per_kg_mg, max_mg, round_to_mg, warning
    """
    w = max(0.0, float(weight_kg or 0.0))
    perkg = max(0.0, float(per_kg_mg or 0.0))
    raw = float(w * perkg)
    capped = float(min(float(max_mg), raw))
    rounded = float(np.round(capped / float(round_to_mg)) * float(round_to_mg))
    return {
        'ld_mg': float(rounded),
        'raw_mg': float(raw),
        'per_kg_mg': float(perkg),
        'max_mg': float(max_mg),
        'round_to_mg': float(round_to_mg),
        'warning': 'capped_at_max' if capped < raw else None,
    }


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


def ss_peak_trough(CL: float, V: float, dose_mg: float, tau_h: float, tinf_min: float) -> Tuple[float, float]:
    """
    Steady-state peak and trough for zero-order infusion with accumulation.
    Returns (Cmax_ss, Cmin_ss) where Cmax_ss is end-of-infusion concentration at steady state,
    and Cmin_ss is immediately before the next dose (tau^-).
    """
    k = float(CL) / float(V)
    Tinf = max(0.25, float(tinf_min) / 60.0)
    R0 = float(dose_mg) / Tinf
    # Avoid division issues when k is tiny (very long half-life)
    denom = 1.0 - np.exp(-k * float(tau_h))
    denom = denom if abs(denom) > _EPS else _EPS
    Cmax_ss = (R0 / (k * float(V))) * (1.0 - np.exp(-k * Tinf)) / denom
    Cmin_ss = Cmax_ss * np.exp(-k * (float(tau_h) - Tinf))
    return float(Cmax_ss), float(Cmin_ss)


def auc24_ss(daily_dose_mg: float, CL_L_h: float) -> float:
    """
    Analytical steady-state AUC over 24 hours (mg*h/L).
    AUC24_ss = DailyDose_mg / CL_L_h
    """
    dose = float(daily_dose_mg)
    CL = float(CL_L_h)
    return float(dose / max(CL, _EPS))


def ss_auc_crosscheck(
    CL: float,
    V: float,
    dose_mg: float,
    tau_h: float,
    tinf_min: float,
) -> Tuple[float, float]:
    """
    Return (auc24_formula, auc24_numeric) at steady state.
      - auc24_formula = (dose_mg * 24 / tau_h) / CL
      - auc24_numeric = trapezoidal AUC over a 24 h window after warm-up using superposition_curve
    """
    CL = float(CL)
    V = float(V)
    tau = float(tau_h)

    daily_dose = float(dose_mg) * (24.0 / tau)
    auc_formula = auc24_ss(daily_dose, CL)

    # Numeric SS AUC over 24h after warm-up
    warmup_doses = 10
    t0 = warmup_doses * tau
    horizon = t0 + 24.0
    dt = 0.02
    n_doses = warmup_doses + int(np.ceil(24.0 / tau)) + 2

    t, c = superposition_curve(
        CL=CL,
        V=V,
        dose_mg=dose_mg,
        tau_h=tau,
        tinf_min=tinf_min,
        horizon_h=horizon,
        dt=dt,
        n_doses=n_doses,
    )
    auc_numeric = auc_trapezoid(t, c, t0=t0, t1=t0 + 24.0)
    return float(auc_formula), float(auc_numeric)
