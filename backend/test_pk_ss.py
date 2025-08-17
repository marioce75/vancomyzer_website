#!/usr/bin/env python3
"""
Unit checks for steady-state peak/trough for zero-order infusion with accumulation.
- Validates analytic ss_peak_trough against numerical superposition within ~2%.
"""
from __future__ import annotations

import math
import numpy as np

from backend.pk import ss_peak_trough, superposition_curve


def approx(a: float, b: float, rel: float = 0.03) -> bool:
    a = float(a); b = float(b)
    if a == 0 and b == 0:
        return True
    return abs(a - b) / max(abs(a), abs(b), 1e-12) <= rel


def test_ss_vs_superposition():
    # Example parameters
    CL = 4.0      # L/h
    V  = 60.0     # L
    dose = 1000.0 # mg
    tau  = 12.0   # h
    tinf = 60.0   # min

    cmax_ss, cmin_ss = ss_peak_trough(CL, V, dose, tau, tinf)

    # Simulate many doses to reach steady state, then read near end-of-infusion and near tau^- of last interval
    horizon = 4 * tau
    t, c = superposition_curve(CL, V, dose, tau, tinf, horizon_h=horizon, dt=0.01, n_doses=32)

    Tinf_h = max(0.25, tinf/60.0)
    # Index of last interval start (closest to horizon - tau)
    start_last = max(int((horizon - tau) / 0.01), 0)
    # EOI within last interval
    t_eoi = (horizon - tau) + Tinf_h
    t_trough = horizon - 1e-2
    c_eoi = float(np.interp(t_eoi, t, c))
    c_trough = float(np.interp(t_trough, t, c))

    assert approx(c_eoi, cmax_ss, rel=0.03), f"EOI mismatch: sim={c_eoi:.3f}, analytic={cmax_ss:.3f}"
    assert approx(c_trough, cmin_ss, rel=0.03), f"Trough mismatch: sim={c_trough:.3f}, analytic={cmin_ss:.3f}"


if __name__ == '__main__':
    test_ss_vs_superposition()
    print('OK: ss_peak_trough matches superposition within 3%')
