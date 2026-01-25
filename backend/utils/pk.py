"""
PK utilities based on first principles for vancomycin dosing.
References:
- 2020 ASHP/IDSA/PIDS/SIDP consensus guideline: AUC/MIC 400–600 (MIC=1), avoid >800 mg·h/L.
- Use trough 15–20 mg/L when AUC monitoring unavailable.
- Loading 20–25 mg/kg for serious infections; maintenance 15–20 mg/kg. Round to nearest 250 mg.
- Interval by CrCl: q8h if ≥100 mL/min, q12h if 60–100, q24h if <60.
- ke ≈ 0.00083*CrCl + 0.0044, Vd ≈ 0.7 L/kg.
"""
from __future__ import annotations
import math
from dataclasses import dataclass
from typing import Optional, List

# Simple patient/regimen mirrors of Pydantic models
@dataclass
class Patient:
    age: float
    sex: str
    weight: float
    height: float
    scr: float

@dataclass
class Regimen:
    doseMg: float
    intervalH: float
    infusionH: float
    startTimeH: float = 0.0

def calc_crcl(patient: Patient) -> float:
    """Cockcroft–Gault using actual body weight.
    CrCl (mL/min) = ((140 - age) * weight) / (72 * Scr); multiply by 0.85 if female.
    """
    base = ((140.0 - patient.age) * patient.weight) / (72.0 * max(patient.scr, 0.1))
    factor = 0.85 if patient.sex.lower().startswith("f") else 1.0
    return max(base * factor, 0.0)

def calc_ke(crcl: float) -> float:
    """Elimination rate constant (h^-1): ke = 0.00083 * CrCl + 0.0044."""
    return 0.00083 * max(crcl, 0.0) + 0.0044

def calc_vd(weight: float) -> float:
    """Volume of distribution (L): Vd ≈ 0.7 L/kg * weight."""
    return 0.7 * max(weight, 0.0)

def calc_auc(dose_mg: float, interval_h: float, ke: float, vd: float, infusion_h: float) -> float:
    """Approximate 24-h AUC for intermittent dosing under first-order elimination.
    For repeated dosing at steady-state, AUC over one dose interval ≈ (Dose/VD)/ke adjusted for infusion time and accumulation.
    We apply infusion correction (1 - e^{-ke*inf}) and accumulation term 1/(1 - e^{-ke*tau}).
    Returns mg·h/L assuming MIC=1 mg/L.
    """
    dose = max(dose_mg, 0.0)
    tau = max(interval_h, 0.1)
    k = max(ke, 1e-6)
    V = max(vd, 1e-6)
    inf = max(infusion_h, 0.1)
    peak_approx = (dose / V) * (1.0 - math.exp(-k * inf))
    auc_per_dose = peak_approx / k
    accumulation = 1.0 / max(1.0 - math.exp(-k * tau), 1e-6)
    auc24 = auc_per_dose * accumulation * (24.0 / tau)
    return auc24

def round_to_250(mg: float) -> float:
    return round(mg / 250.0) * 250.0

def recommend_regimen(patient: Patient) -> Regimen:
    """Recommend loading and maintenance targeting AUC 400–600 mg·h/L.
    - Interval by CrCl thresholds.
    - Maintenance 15–20 mg/kg; check total daily dose ≤ 100 mg/kg to minimize AUC >800 risk.
    - Round doses to nearest 250 mg.
    """
    crcl = calc_crcl(patient)
    ke = calc_ke(crcl)
    vd = calc_vd(patient.weight)

    # Interval rules
    if crcl >= 100:
        tau = 8.0
    elif crcl >= 60:
        tau = 12.0
    else:
        tau = 24.0

    # Start with 15–20 mg/kg maintenance; try mid-point 17.5 mg/kg
    maint = round_to_250(17.5 * patient.weight)
    infusion_h = 1.0

    # Cap daily dose ≤ 100 mg/kg
    max_daily = 100.0 * patient.weight
    daily = maint * (24.0 / tau)
    if daily > max_daily:
        maint = round_to_250(max_daily * (tau / 24.0))

    # Adjust to hit AUC 400–600 by simple search around maint
    target_min, target_max = 400.0, 600.0
    best = maint
    best_auc = calc_auc(best, tau, ke, vd, infusion_h)
    for factor in [0.75, 0.85, 0.95, 1.0, 1.05, 1.15, 1.25]:
        dose_try = round_to_250(best * factor)
        auc_try = calc_auc(dose_try, tau, ke, vd, infusion_h)
        if target_min <= auc_try <= target_max:
            best = dose_try
            best_auc = auc_try
            break
        # choose closer to midpoint 500
        if abs(auc_try - 500.0) < abs(best_auc - 500.0):
            best = dose_try
            best_auc = auc_try

    return Regimen(doseMg=best, intervalH=tau, infusionH=infusion_h, startTimeH=0.0)

# Optional Excel load (placeholder; requires full base64 string provided externally)
def initialize_excel_from_base64(encoded_zip: str):
    import base64, zipfile, io, pathlib
    data = base64.b64decode(encoded_zip)
    zf = zipfile.ZipFile(io.BytesIO(data))
    out_dir = pathlib.Path(__file__).resolve().parent / 'data'
    out_dir.mkdir(parents=True, exist_ok=True)
    zf.extractall(out_dir)
    zf.close()
