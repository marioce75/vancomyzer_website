from __future__ import annotations

from typing import Dict, List, Tuple

import numpy as np

from backend.pk.sim import auc_trapz, simulate_regimen_0_48h


def _interp_at_time(t: np.ndarray, c: np.ndarray, time_hr: float) -> float:
    """Linear interpolation of concentration at a timepoint."""
    if time_hr <= float(t[0]):
        return float(c[0])
    if time_hr >= float(t[-1]):
        return float(c[-1])
    return float(np.interp(time_hr, t, c))


def compute_curve_and_metrics(
    cl_l_hr: float,
    v_l: float,
    dose_mg: float,
    interval_hr: float,
    infusion_hr: float,
    dt_min: float = 10.0,
) -> Dict[str, object]:
    """
    Simulate 0–48h concentration-time curve and compute AUC/peak/trough
    directly from the simulated curve.
    """
    t, c = simulate_regimen_0_48h(
        cl_l_hr=cl_l_hr,
        v_l=v_l,
        dose_mg=dose_mg,
        interval_hr=interval_hr,
        infusion_hr=infusion_hr,
        dt_min=dt_min,
    )
    auc_0_24 = float(auc_trapz(t, c, 0.0, 24.0))

    horizon = float(t[-1])
    last_start = max(0.0, horizon - float(interval_hr))
    peak_time = last_start + float(infusion_hr)
    trough_time = last_start + float(interval_hr)

    peak = _interp_at_time(t, c, peak_time)
    trough = _interp_at_time(t, c, trough_time)

    curve = [{"t_hr": float(tt), "conc_mg_l": float(cc)} for tt, cc in zip(t, c)]

    return {
        "auc24": auc_0_24,
        "peak": peak,
        "trough": trough,
        "curve": curve,
        "peak_time_hr": peak_time,
        "trough_time_hr": trough_time,
        "dt_min": float(dt_min),
        "horizon_hr": horizon,
    }
