# NOTE: imports converted from relative to absolute for uvicorn main:app
from __future__ import annotations

import numpy as np

from backend.pk.model import superposition_conc, auc_trapz


def superposition_curve(CL_L_per_h: float, V_L: float, dose_mg: float, tau_h: float, tinf_min: float,
                        horizon_h: float = 24.0, dt: float = 0.01, n_doses: int = 16):
    """Compatibility helper for tests: returns (t, c) arrays over horizon.
    tinf_min is minutes; convert to hours for the model.
    """
    t = np.arange(0.0, float(horizon_h) + 1e-9, float(dt))
    tinf_h = max(0.25, float(tinf_min) / 60.0)
    c = superposition_conc(t, float(dose_mg), float(tau_h), tinf_h, float(CL_L_per_h), float(V_L))
    return t, c


def auc_trapezoid(t_array, c_array, a: float, b: float) -> float:
    return float(auc_trapz(np.asarray(t_array, dtype=float), np.asarray(c_array, dtype=float), float(a), float(b)))


def ss_peak_trough(CL_L_per_h: float, V_L: float, dose_mg: float, tau_h: float, tinf_min: float):
    """Analytical steady-state peak at end of infusion and trough just before next dose.
    Cmax_ss = (R0/(kV)) * (1 - e^{-k Tinf}) / (1 - e^{-k tau})
    Cmin_ss = Cmax_ss * e^{-k (tau - Tinf)}
    """
    k = float(CL_L_per_h) / max(float(V_L), 1e-9)
    Tinf = max(0.25, float(tinf_min) / 60.0)
    R0 = float(dose_mg) / Tinf
    denom = 1.0 - np.exp(-k * float(tau_h))
    denom = float(denom) if abs(denom) > 1e-12 else 1e-12
    Cmax = (R0 / (k * float(V_L))) * (1.0 - np.exp(-k * Tinf)) / denom
    Cmin = Cmax * float(np.exp(-k * (float(tau_h) - Tinf)))
    return float(Cmax), float(Cmin)
