# NOTE: imports converted from relative to absolute for uvicorn main:app
from __future__ import annotations

import math
from typing import Tuple

import numpy as np

from backend.pk.model import superposition_conc, auc_trapz


def choose_dose_interval(cl_map: float, v_map: float, target_mid: float, infusion_minutes: int) -> Tuple[int, int, float]:
    """Return (dose_mg, interval_h, auc24_est)
    Strategy per spec:
    - target daily dose ≈ target_mid * CL
    - Search tau in {8,12,24} and per-dose in 250 mg steps up to 4000 mg
    - For each candidate, simulate 0–24h AUC with tinf = 60 min if dose<=1000 else 90 min
    - Pick candidate minimizing |AUC24 - target_mid|
    """
    intervals = [8, 12, 24]
    doses = list(range(250, 4000 + 1, 250))

    best = None
    best_err = float("inf")
    for tau in intervals:
        for per_dose in doses:
            tinf_min = 60 if per_dose <= 1000 else 90
            t = np.arange(0.0, 24.0 + 1e-9, 0.05)
            conc = superposition_conc(t, per_dose, tau, tinf_min / 60.0, cl_map, v_map)
            auc24 = auc_trapz(t, conc, 0.0, 24.0)
            err = abs(auc24 - target_mid)
            if err < best_err:
                best_err = err
                best = (per_dose, tau, float(auc24))
    return best
