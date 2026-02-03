import math
from typing import Dict, List, Optional, Tuple

# Guideline-informed targets:
# - AUC/MIC >= 400 mg·h/L (MIC assumed 1 mg/L)
# - Avoid AUC > 800 mg·h/L to reduce nephrotoxicity
# - Loading dose 20-25 mg/kg ABW (max 3000 mg) for serious infections
# - Maintenance 15-20 mg/kg with interval by CrCl


def _round_to_increment(value: float, increment: int = 250) -> int:
    return int(round(value / increment) * increment)


def _ibw_kg(height_cm: float, sex: str) -> Optional[float]:
    if not height_cm:
        return None
    height_in = height_cm / 2.54
    if height_in <= 0:
        return None
    if sex.lower() == "female":
        return 45.5 + 2.3 * max(0.0, height_in - 60.0)
    return 50.0 + 2.3 * max(0.0, height_in - 60.0)


def cockcroft_gault(
    age_years: float,
    weight_kg: float,
    sex: str,
    serum_creatinine: float,
    height_cm: Optional[float] = None,
) -> float:
    """Estimate CrCl (mL/min) using Cockcroft–Gault with ABW/AdjBW."""
    if age_years <= 0 or weight_kg <= 0 or serum_creatinine <= 0:
        return 0.0

    weight_used = weight_kg
    ibw = _ibw_kg(height_cm, sex) if height_cm else None
    if ibw and weight_kg > 1.3 * ibw:
        weight_used = ibw + 0.4 * (weight_kg - ibw)

    crcl = ((140.0 - age_years) * weight_used) / (72.0 * serum_creatinine)
    if sex.lower() == "female":
        crcl *= 0.85

    return max(crcl, 10.0)


def elimination_constant(crcl: float) -> float:
    """k_e = 0.00083 * CrCl + 0.0044 (1/h)."""
    return max(0.00083 * crcl + 0.0044, 0.001)


def volume_distribution(weight_kg: float) -> float:
    """Vd = 0.7 L/kg."""
    return max(0.7 * weight_kg, 1.0)


def half_life_hours(k_e: float) -> float:
    return 0.693 / max(k_e, 0.001)


def calculate_auc_24(dose_mg: float, interval_h: float, k_e: float, vd_l: float) -> float:
    """AUC_24 = daily dose / CL (CL = k_e * Vd)."""
    clearance = k_e * vd_l
    if clearance <= 0 or interval_h <= 0:
        return 0.0
    daily_dose = dose_mg * 24.0 / interval_h
    return daily_dose / clearance


def predict_peak(
    dose_mg: float,
    interval_h: float,
    k_e: float,
    vd_l: float,
    infusion_h: float = 1.0,
) -> float:
    """Predicted peak at end of infusion (steady state)."""
    if interval_h <= 0 or vd_l <= 0 or k_e <= 0:
        return 0.0
    infusion_h = max(infusion_h, 0.1)
    factor = (dose_mg / (vd_l * k_e * infusion_h)) * (1 - math.exp(-k_e * infusion_h))
    accumulation = 1 / (1 - math.exp(-k_e * interval_h))
    return factor * accumulation


def predict_trough(
    dose_mg: float,
    interval_h: float,
    k_e: float,
    vd_l: float,
    infusion_h: float = 1.0,
) -> float:
    """Predicted trough just before next dose (steady state)."""
    peak = predict_peak(dose_mg, interval_h, k_e, vd_l, infusion_h)
    return peak * math.exp(-k_e * max(interval_h - infusion_h, 0.1))


def _estimate_ke_from_two_levels(levels: List[Dict]) -> Optional[float]:
    if len(levels) < 2:
        return None
    levels_sorted = sorted(levels, key=lambda l: l["time_hours"])
    c1 = levels_sorted[0]["level_mg_l"]
    c2 = levels_sorted[1]["level_mg_l"]
    t1 = levels_sorted[0]["time_hours"]
    t2 = levels_sorted[1]["time_hours"]
    if c1 <= 0 or c2 <= 0 or t2 <= t1:
        return None
    return math.log(c1 / c2) / (t2 - t1)


def _estimate_vd_from_level(
    level_mg_l: float,
    time_h: float,
    dose_mg: float,
    k_e: float,
    infusion_h: float,
) -> Optional[float]:
    if level_mg_l <= 0 or dose_mg <= 0 or k_e <= 0:
        return None
    infusion_h = max(infusion_h, 0.1)
    if time_h <= infusion_h:
        numerator = dose_mg * (1 - math.exp(-k_e * time_h))
        denominator = k_e * infusion_h * level_mg_l
        return numerator / denominator
    numerator = dose_mg * (1 - math.exp(-k_e * infusion_h)) * math.exp(-k_e * (time_h - infusion_h))
    denominator = k_e * infusion_h * level_mg_l
    return numerator / denominator


def estimate_patient_pk(
    levels: List[Dict],
    dose_mg: float,
    infusion_h: float,
    fallback_ke: float,
    fallback_vd: float,
) -> Tuple[float, float, str]:
    """
    Sawchuk–Zaske method using 1-2 levels.
    If two levels provided, estimate k_e from slope and Vd from extrapolated peak.
    If one level, keep k_e from population and solve Vd.
    """
    if not levels:
        return fallback_ke, fallback_vd, "population"

    ke = _estimate_ke_from_two_levels(levels) or fallback_ke
    level = levels[0]
    time_h = level["time_hours"]
    vd = _estimate_vd_from_level(level["level_mg_l"], time_h, dose_mg, ke, infusion_h) or fallback_vd
    method = "sawchuk_zaske" if len(levels) >= 2 else "single_level_adjustment"
    return ke, vd, method


def calculate_dose(
    weight_kg: float,
    crcl: float,
    serious: bool,
    bayesian: Optional[Dict] = None,
) -> Dict[str, float]:
    """Return guideline-based loading/maintenance regimen and PK predictions."""
    interval_h = 8 if crcl > 100 else 12 if crcl >= 60 else 24
    base_mg_per_kg = 20 if serious else 15
    maintenance_dose = _round_to_increment(base_mg_per_kg * weight_kg)

    loading_dose = 0
    if serious:
        loading_dose = min(_round_to_increment(25 * weight_kg, 250), 3000)

    k_e = bayesian["k_e"] if bayesian and "k_e" in bayesian else elimination_constant(crcl)
    vd = bayesian["vd"] if bayesian and "vd" in bayesian else volume_distribution(weight_kg)

    auc = calculate_auc_24(maintenance_dose, interval_h, k_e, vd)
    target_auc = 500.0
    if bayesian:
        adjusted_dose = (target_auc * (k_e * vd) * interval_h) / 24.0
        maintenance_dose = _round_to_increment(adjusted_dose)
        auc = calculate_auc_24(maintenance_dose, interval_h, k_e, vd)

    peak = predict_peak(maintenance_dose, interval_h, k_e, vd)
    trough = predict_trough(maintenance_dose, interval_h, k_e, vd)

    return {
        "loading_dose_mg": loading_dose,
        "maintenance_dose_mg": maintenance_dose,
        "interval_hours": interval_h,
        "k_e": k_e,
        "vd_l": vd,
        "half_life_h": half_life_hours(k_e),
        "predicted_peak_mg_l": peak,
        "predicted_trough_mg_l": trough,
        "predicted_auc_24": auc,
    }
