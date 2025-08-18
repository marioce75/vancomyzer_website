from __future__ import annotations

import numpy as np

from backend.pk import superposition_curve, auc_trapezoid, ss_peak_trough


def approx(a: float, b: float, rel: float = 0.05) -> bool:
    a = float(a); b = float(b)
    if a == 0 and b == 0:
        return True
    return abs(a - b) / max(abs(a), abs(b), 1e-12) <= rel


def test_auc_identity_within_5pct():
    CL = 4.0
    V = 60.0
    dose = 1000.0
    tau = 12.0
    tinf = 60.0
    t, c = superposition_curve(CL, V, dose, tau, tinf, horizon_h=24.0, dt=0.01, n_doses=16)
    auc24 = auc_trapezoid(t, c, 0.0, 24.0)
    daily_dose = (24.0 / tau) * dose
    identity = daily_dose / CL
    assert approx(auc24, identity, 0.05), f"AUC24={auc24:.2f}, identity={identity:.2f}"


def test_ss_peak_trough_relationship():
    CL = 4.0
    V = 60.0
    dose = 1000.0
    tau = 12.0
    tinf = 60.0
    cmax_ss, cmin_ss = ss_peak_trough(CL, V, dose, tau, tinf)
    # Verify relationship Cmin = Cmax * exp(-k*(tau - Tinf))
    k = CL / V
    Tinf = max(0.25, tinf/60.0)
    expected_cmin = cmax_ss * np.exp(-k * (tau - Tinf))
    assert approx(cmin_ss, expected_cmin, 0.03)


ess_params = dict(CL=4.0, V=60.0, tinf=60.0)

def test_monotonic_interval_and_dose_effects():
    # Baseline
    dose = 1000.0
    tau12 = 12.0
    cmax12, cmin12 = ss_peak_trough(ess_params['CL'], ess_params['V'], dose, tau12, ess_params['tinf'])
    t12, c12 = superposition_curve(ess_params['CL'], ess_params['V'], dose, tau12, ess_params['tinf'], horizon_h=24, dt=0.05, n_doses=16)
    auc12 = auc_trapezoid(t12, c12, 0, 24)

    # Increase interval → trough decreases, AUC decreases
    tau24 = 24.0
    cmax24, cmin24 = ss_peak_trough(ess_params['CL'], ess_params['V'], dose, tau24, ess_params['tinf'])
    t24, c24 = superposition_curve(ess_params['CL'], ess_params['V'], dose, tau24, ess_params['tinf'], horizon_h=24, dt=0.05, n_doses=16)
    auc24 = auc_trapezoid(t24, c24, 0, 24)
    assert cmin24 < cmin12
    assert auc24 < auc12

    # Increase dose → peak and AUC increase
    dose1500 = 1500.0
    cmaxD, cminD = ss_peak_trough(ess_params['CL'], ess_params['V'], dose1500, tau12, ess_params['tinf'])
    tD, cD = superposition_curve(ess_params['CL'], ess_params['V'], dose1500, tau12, ess_params['tinf'], horizon_h=24, dt=0.05, n_doses=16)
    aucD = auc_trapezoid(tD, cD, 0, 24)
    assert cmaxD > cmax12
    assert aucD > auc12
