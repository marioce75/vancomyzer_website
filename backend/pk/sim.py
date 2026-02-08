from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, List, Tuple

import numpy as np


@dataclass(frozen=True)
class Event:
    dose_mg: float
    start_hr: float
    infusion_hr: float


def _concentration_one_event(
    t: np.ndarray,
    event: Event,
    cl_l_hr: float,
    v_l: float,
) -> np.ndarray:
    """1-compartment: zero-order infusion, first-order elimination (superposition).

    Returns concentration contribution (mg/L) at each time in `t`.

    Model:
      k = CL / V
      During infusion (0<=u<=Tin):
        C(u) = (R/CL) * (1 - exp(-k*u))
      After infusion (u>Tin):
        C(u) = (R/CL) * (1 - exp(-k*Tin)) * exp(-k*(u-Tin))

    where R is infusion rate in mg/hr.

    Educational simulation only.
    """

    cl = max(float(cl_l_hr), 1e-6)
    v = max(float(v_l), 1e-6)
    k = cl / v

    tin = max(float(event.infusion_hr), 1e-6)
    r = float(event.dose_mg) / tin  # mg/hr

    u = t - float(event.start_hr)
    out = np.zeros_like(t, dtype=float)

    during = (u >= 0) & (u <= tin)
    after = u > tin

    if np.any(during):
        ud = u[during]
        out[during] = (r / cl) * (1.0 - np.exp(-k * ud))

    if np.any(after):
        ua = u[after]
        out[after] = (r / cl) * (1.0 - np.exp(-k * tin)) * np.exp(-k * (ua - tin))

    return out


def concentration_time_series(
    t: np.ndarray,
    events: Iterable[Event],
    cl_l_hr: float,
    v_l: float,
) -> np.ndarray:
    total = np.zeros_like(t, dtype=float)
    for ev in events:
        total += _concentration_one_event(t, ev, cl_l_hr=cl_l_hr, v_l=v_l)
    return total


def auc_trapz(t: np.ndarray, c: np.ndarray, start_hr: float, end_hr: float) -> float:
    """Trapezoidal AUC between start and end (hours)."""
    start_hr = float(start_hr)
    end_hr = float(end_hr)
    if end_hr <= start_hr:
        return 0.0

    mask = (t >= start_hr) & (t <= end_hr)
    tt = t[mask]
    cc = c[mask]
    if tt.size < 2:
        return 0.0
    return float(np.trapz(cc, tt))


def build_repeated_regimen_events(
    dose_mg: float,
    interval_hr: float,
    infusion_hr: float,
    horizon_hr: float,
    start_hr: float = 0.0,
) -> List[Event]:
    interval_hr = float(interval_hr)
    if interval_hr <= 0:
        return []
    n = int(math.floor((horizon_hr - start_hr) / interval_hr)) + 1
    return [
        Event(dose_mg=float(dose_mg), start_hr=float(start_hr) + i * interval_hr, infusion_hr=float(infusion_hr))
        for i in range(max(0, n))
    ]


def simulate_regimen_0_48h(
    cl_l_hr: float,
    v_l: float,
    dose_mg: float,
    interval_hr: float,
    infusion_hr: float,
    dt_min: float = 10.0,
) -> Tuple[np.ndarray, np.ndarray]:
    horizon = 48.0
    dt_hr = float(dt_min) / 60.0
    t = np.arange(0.0, horizon + 1e-9, dt_hr)
    events = build_repeated_regimen_events(dose_mg, interval_hr, infusion_hr, horizon_hr=horizon)
    c = concentration_time_series(t, events, cl_l_hr=cl_l_hr, v_l=v_l)
    return t, c


def estimate_peak_trough_from_sim(
    t: np.ndarray,
    c: np.ndarray,
    interval_hr: float,
    window_start_hr: float = 24.0,
) -> Tuple[float, float]:
    """Estimate peak/trough using the last interval window (default 24-48h) as a stand-in.

    Educational: approximates steady-state by sampling later in the simulation.
    """
    interval_hr = float(interval_hr)
    if interval_hr <= 0:
        return 0.0, 0.0

    # analyze last interval in the horizon
    end = float(t.max())
    start = max(0.0, end - interval_hr)
    mask = (t >= start) & (t <= end)
    cc = c[mask]
    if cc.size == 0:
        return 0.0, 0.0
    return float(np.max(cc)), float(np.min(cc))
