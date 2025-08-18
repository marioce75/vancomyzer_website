from __future__ import annotations

import math
from typing import List, Tuple

import numpy as np

# Helpers

def crcl_cockcroft_gault(age: float, weight_kg: float, scr_mgdl: float, sex: str) -> float:
    scr = max(0.2, float(scr_mgdl))
    wt = max(20.0, float(weight_kg))
    age = max(14.0, float(age))
    sex = str(sex or "male").lower()
    sex_factor = 0.85 if sex.startswith("f") else 1.0
    crcl = ((140.0 - age) * wt) / (72.0 * scr)
    return crcl * sex_factor


def superposition_conc(t_array: np.ndarray, dose_mg: float, tau_h: float, tinf_h: float, cl_L_h: float, v_L: float) -> np.ndarray:
    k = cl_L_h / v_L
    k = max(k, 1e-6)
    R0 = dose_mg / max(tinf_h, 1e-6)
    conc = np.zeros_like(t_array, dtype=float)
    max_k = int(math.ceil((t_array[-1] + 1e-9) / tau_h)) + 1
    dose_times = np.arange(0.0, max_k * tau_h + 1e-9, tau_h)
    for t0 in dose_times:
        td = t_array - t0
        during = (td >= 0) & (td <= tinf_h)
        after = td > tinf_h
        conc[during] += (R0 / (k * v_L)) * (1.0 - np.exp(-k * td[during]))
        conc[after] += (R0 / (k * v_L)) * (1.0 - np.exp(-k * tinf_h)) * np.exp(-k * (td[after] - tinf_h))
    return conc


def auc_trapz(t_array: np.ndarray, c_array: np.ndarray, t0: float = 0.0, t1: float = 24.0) -> float:
    if len(t_array) < 2:
        return 0.0
    t = np.array(t_array, dtype=float)
    y = np.array(c_array, dtype=float)
    mask = (t >= t0) & (t <= t1)
    if not np.any(mask):
        return 0.0
    if t[mask][0] > t0:
        y0 = np.interp(t0, t, y)
        t = np.insert(t, np.argmax(mask), t0)
        y = np.insert(y, np.argmax(mask), y0)
        mask = (t >= t0) & (t <= t1)
    if t[mask][-1] < t1:
        y1 = np.interp(t1, t, y)
        idx = np.where(mask)[0][-1] + 1
        t = np.insert(t, idx, t1)
        y = np.insert(y, idx, y1)
        mask = (t >= t0) & (t <= t1)
    t_clip = t[mask]
    y_clip = y[mask]
    return float(np.trapz(y_clip, t_clip))


def peak_trough_from_series(t_array: np.ndarray, c_array: np.ndarray, tau_h: float) -> dict:
    t = np.array(t_array, dtype=float)
    y = np.array(c_array, dtype=float)
    idx24 = np.searchsorted(t, 24.0, side="right")
    peak = float(np.max(y[: max(1, idx24)]))
    idx_tau = np.searchsorted(t, tau_h, side="left")
    trough = float(y[max(0, idx_tau - 1)]) if len(y) else 0.0
    return {"peak": peak, "trough": trough}


# Priors
THETA_CL = 4.5
THETA_CRCL = 0.65
SIG_CL = 0.25
THETA_V = 60.0
SIG_V = 0.20
SIGMA_RESID = 2.0


def prior_center(age: float, sex: str, weight_kg: float, scr_mgdl: float) -> Tuple[float, float]:
    crcl = crcl_cockcroft_gault(age, weight_kg, scr_mgdl, sex)
    mu_cl = THETA_CL * (max(crcl, 5.0) / 100.0) ** THETA_CRCL * (max(weight_kg, 20.0) / 70.0) ** 0.75
    mu_v = THETA_V * (max(weight_kg, 20.0) / 70.0) ** 1.0
    return mu_cl, mu_v


def neg_log_post(cl: float, v: float, levels: List[Tuple[float, float]], mu_cl: float, mu_v: float,
                 dose_mg: float, tau_h: float, tinf_h: float) -> float:
    if cl <= 0 or v <= 0:
        return 1e9
    z_cl = (math.log(cl) - math.log(mu_cl)) / SIG_CL
    z_v = (math.log(v) - math.log(mu_v)) / SIG_V
    nlp = 0.5 * (z_cl ** 2 + z_v ** 2)
    if levels:
        t = np.array([lv[0] for lv in levels], dtype=float)
        c_pred = superposition_conc(t, dose_mg, tau_h, tinf_h, cl, v)
        resid = (c_pred - np.array([lv[1] for lv in levels], dtype=float)) / SIGMA_RESID
        nlp += 0.5 * float(np.dot(resid, resid))
    return nlp
