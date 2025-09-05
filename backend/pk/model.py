# NOTE: imports converted from relative to absolute for uvicorn main:app
from __future__ import annotations

import math
from typing import List, Tuple

import numpy as np

# Cockcroft–Gault creatinine clearance in mL/min

def crcl_cockcroft_gault(age: float, weight_kg: float, scr_mgdl: float, sex: str) -> float:
    scr = max(0.2, float(scr_mgdl))
    wt = max(20.0, float(weight_kg))
    age = max(14.0, float(age))
    sex = str(sex or "male").lower()
    sex_factor = 0.85 if sex.startswith("f") else 1.0
    crcl = ((140.0 - age) * wt) / (72.0 * scr)
    return float(crcl * sex_factor)


# One-compartment IV infusion model (zero-order in, first-order out)
# Returns concentration at time t (hours) after start of infusion

def infusion_conc_single(t_h: float | np.ndarray, dose_mg: float, tinf_h: float, cl_L_h: float, v_L: float) -> np.ndarray:
    t = np.array(t_h, dtype=float)
    k = max(1e-9, cl_L_h / max(v_L, 1e-9))
    tinf_h = max(1e-9, float(tinf_h))
    R0 = dose_mg / tinf_h  # mg/h
    conc = np.zeros_like(t, dtype=float)
    # During infusion: 0 <= t <= Tinf
    during = (t >= 0) & (t <= tinf_h)
    if np.any(during):
        conc[during] = (R0 / (k * v_L)) * (1.0 - np.exp(-k * t[during]))
    # After infusion: t > Tinf
    after = t > tinf_h
    if np.any(after):
        conc[after] = (R0 / (k * v_L)) * (1.0 - np.exp(-k * tinf_h)) * np.exp(-k * (t[after] - tinf_h))
    return conc


# Repeated dosing via superposition across times grid

def superposition_conc(t_array: np.ndarray, dose_mg: float, tau_h: float, tinf_h: float, cl_L_h: float, v_L: float) -> np.ndarray:
    t_array = np.array(t_array, dtype=float)
    tau_h = float(tau_h)
    assert tau_h > 0
    if len(t_array) == 0:
        return np.zeros((0,), dtype=float)
    conc = np.zeros_like(t_array, dtype=float)
    horizon = float(t_array[-1])
    n_doses = int(math.ceil((horizon + 1e-9) / tau_h)) + 1
    for n in range(n_doses):
        t0 = n * tau_h
        td = t_array - t0
        mask = td >= 0
        if not np.any(mask):
            continue
        conc[mask] += infusion_conc_single(td[mask], dose_mg, tinf_h, cl_L_h, v_L)
    return conc


def auc_trapz(t_array: np.ndarray, c_array: np.ndarray, t0: float = 0.0, t1: float = 24.0) -> float:
    if len(t_array) < 2:
        return 0.0
    t = np.array(t_array, dtype=float)
    y = np.array(c_array, dtype=float)
    # Clip to [t0, t1] with linear interpolation at boundaries
    mask = (t >= t0) & (t <= t1)
    if not np.any(mask):
        return 0.0
    # Ensure exact boundaries exist
    if t[mask][0] > t0:
        y0 = float(np.interp(t0, t, y))
        insert_at = np.argmax(mask)
        t = np.insert(t, insert_at, t0)
        y = np.insert(y, insert_at, y0)
        mask = (t >= t0) & (t <= t1)
    if t[mask][-1] < t1:
        y1 = float(np.interp(t1, t, y))
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
    # Peak within first 24h
    idx24 = np.searchsorted(t, 24.0, side="right")
    peak = float(np.max(y[: max(1, idx24)])) if len(y) else 0.0
    # Trough: value just before tau
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


# Spec-aligned helper aliases

def cockcroft_gault(age: float, weight_kg: float, scr_mgdl: float, sex: str) -> float:
    return crcl_cockcroft_gault(age, weight_kg, scr_mgdl, sex)


def infusion_superposition(times: np.ndarray, dose_mg: float, tau_h: float, tinf_h: float, cl_L_h: float, v_L: float, horizon_h: float = 48.0) -> np.ndarray:
    # horizon_h is unused here since times drives horizon, kept for signature compatibility
    return superposition_conc(times, dose_mg, tau_h, tinf_h, cl_L_h, v_L)


def trapezoid(x: np.ndarray, y: np.ndarray, a: float, b: float) -> float:
    return auc_trapz(x, y, a, b)


def peak_trough(times: np.ndarray, conc: np.ndarray, tau_h: float) -> tuple[float, float]:
    pt = peak_trough_from_series(times, conc, tau_h)
    return float(pt["peak"]), float(pt["trough"])  # (peak, trough)
