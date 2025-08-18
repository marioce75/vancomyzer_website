from __future__ import annotations

import numpy as np
from typing import Tuple

from .model import superposition_conc, auc_trapz


def choose_dose_interval(cl_map: float, v_map: float, target_mid: float, infusion_minutes: int) -> Tuple[int, int, float]:
    """Return (dose_mg, interval_h, auc24_est)
    Uses daily_dose = target_mid * CL, search tau in {8,12,24}, dose step 250 mg.
    """
    daily_dose = target_mid * cl_map
    intervals = [8, 12, 24]
    best = None
    best_err = float("inf")
    for tau in intervals:
        per_dose = daily_dose * (tau / 24.0)
        per_dose = int(max(250, round(per_dose / 250.0) * 250))
        times = np.arange(0.0, 24.0 + 1e-9, 0.05)
        conc = superposition_conc(times, per_dose, tau, max(0.25, infusion_minutes/60), cl_map, v_map)
        auc24 = auc_trapz(times, conc, 0.0, 24.0)
        err = abs(auc24 - target_mid)
        if err < best_err:
            best_err = err
            best = (per_dose, tau, auc24)
    return best
