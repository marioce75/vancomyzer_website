import numpy as np

from backend.pk import deterministic
from utils import pk


def test_deterministic_metrics_match_curve():
    # Sample patient/regimen
    age = 25
    sex = "male"
    weight_kg = 65
    scr = 1.0
    height_cm = 175
    dose_mg = 1000
    interval_hr = 12
    infusion_hr = 1.0

    crcl = pk.cockcroft_gault(age, weight_kg, sex, scr, height_cm)
    k_e = pk.elimination_constant(crcl)
    vd = pk.volume_distribution(weight_kg)

    result = deterministic.compute_curve_and_metrics(
        cl_l_hr=k_e * vd,
        v_l=vd,
        dose_mg=dose_mg,
        interval_hr=interval_hr,
        infusion_hr=infusion_hr,
        dt_min=10.0,
    )
    curve = result["curve"]
    t = np.array([p["t_hr"] for p in curve])
    c = np.array([p["conc_mg_l"] for p in curve])

    # Validate peak/trough match curve at computed times
    peak_time = result["peak_time_hr"]
    trough_time = result["trough_time_hr"]
    peak_curve = float(np.interp(peak_time, t, c))
    trough_curve = float(np.interp(trough_time, t, c))

    assert abs(result["peak"] - peak_curve) < 0.01
    assert abs(result["trough"] - trough_curve) < 0.01

    # AUC consistency with curve integration
    auc_curve = float(np.trapz(c[(t >= 0) & (t <= 24)], t[(t >= 0) & (t <= 24)]))
    assert abs(result["auc24"] - auc_curve) < 0.05
