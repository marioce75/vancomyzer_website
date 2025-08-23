from __future__ import annotations

from typing import Dict, Tuple

# Local import that works whether backend is a package or run as a script
try:
    from . import pk
except Exception:  # pragma: no cover
    import pk  # type: ignore

_ML_MIN_TO_L_H = 0.06  # 1 mL/min = 0.06 L/h


def _normalize_sex(sex: str) -> str:
    s = (sex or "").strip().lower()
    if s.startswith("f"):
        return "female"
    return "male"


def _devine_ibw_kg(sex: str, height_cm: float) -> float:
    sex_n = _normalize_sex(sex)
    inches_total = float(height_cm) / 2.54
    inches_over_60 = max(0.0, inches_total - 60.0)
    if sex_n == "female":
        return 45.5 + 2.3 * inches_over_60
    return 50.0 + 2.3 * inches_over_60


def _adjbw_kg(tbw_kg: float, ibw_kg: float) -> float:
    # Common heuristic: IBW + 0.4*(TBW - IBW), but not less than IBW
    if tbw_kg <= ibw_kg:
        return ibw_kg
    return ibw_kg + 0.4 * (tbw_kg - ibw_kg)


def _choose_weight_for_crcl(weight_mode: str, tbw_kg: float, ibw_kg: float, adjbw_kg: float) -> float:
    mode = (weight_mode or "TBW").strip()
    mode_upper = mode.upper()
    if mode_upper == "TBW":
        return float(tbw_kg)
    if mode_upper == "IBW":
        return float(ibw_kg)
    # AdjBW: use AdjBW only when TBW > 1.3 * IBW; otherwise use IBW
    if mode_upper == "ADJBW":
        if tbw_kg > 1.3 * ibw_kg:
            return float(adjbw_kg)
        return float(ibw_kg)
    # Fallback to TBW
    return float(tbw_kg)


def _cockcroft_gault_crcl_ml_min(
    sex: str,
    age_yr: float,
    weight_for_crcl_kg: float,
    scr_mg_dl: float,
) -> float:
    sex_n = _normalize_sex(sex)
    # Guard against nonpositive SCr
    scr = float(scr_mg_dl)
    if scr <= 0:
        scr = 0.01
    base = ((140.0 - float(age_yr)) * float(weight_for_crcl_kg)) / (72.0 * scr)
    if sex_n == "female":
        base *= 0.85
    return float(base)


def _round_to_nearest(value: float, step: int) -> int:
    return int(round(value / step) * step)


def loading_dose_recommendation_mg(
    weight_kg: float,
    target_mg_per_kg: float = 20.0,
    cap_mg: int = 3000,
    rounding_step_mg: int = 250,
) -> int:
    """
    Loading dose = target mg/kg * TBW (cap at 3000 mg; round to nearest 250 mg).
    """
    raw = float(weight_kg) * float(target_mg_per_kg)
    capped = min(raw, float(cap_mg))
    return _round_to_nearest(capped, rounding_step_mg)


def loading_dose_options_mg(
    weight_kg: float,
    targets_mg_per_kg: Tuple[float, float] = (20.0, 25.0),
    cap_mg: int = 3000,
    rounding_step_mg: int = 250,
) -> Dict[float, int]:
    """
    Returns loading dose options keyed by mg/kg targets, e.g. {20.0: 1500, 25.0: 1750}
    """
    return {
        float(t): loading_dose_recommendation_mg(
            weight_kg=weight_kg, target_mg_per_kg=t, cap_mg=cap_mg, rounding_step_mg=rounding_step_mg
        )
        for t in targets_mg_per_kg
    }


def spreadsheet_mode_params(
    *,
    sex: str,              # "male" | "female"
    age_yr: float,
    height_cm: float,
    weight_kg: float,      # TBW
    scr_mg_dl: float,
    dose_mg: float,
    tau_h: float,
    tinf_min: float,
    weight_mode: str = "TBW",   # "TBW" | "IBW" | "AdjBW"
    obesity_adjustment: bool = False
) -> dict:
    """
    Deterministic Spreadsheet Mode calculations (no Bayesian components).
    """
    sex_n = _normalize_sex(sex)
    tbw = float(weight_kg)
    ibw = _devine_ibw_kg(sex_n, float(height_cm))
    adjbw = _adjbw_kg(tbw, ibw)

    weight_for_crcl = _choose_weight_for_crcl(weight_mode, tbw, ibw, adjbw)

    crcl_ml_min_raw = _cockcroft_gault_crcl_ml_min(sex_n, float(age_yr), weight_for_crcl, float(scr_mg_dl))
    crcl_cap = 150.0
    crcl_ml_min_capped = min(crcl_ml_min_raw, crcl_cap)
    crcl_L_h = crcl_ml_min_capped * _ML_MIN_TO_L_H

    cl_from_crcl_factor = 0.75
    CL = cl_from_crcl_factor * crcl_L_h  # L/h

    # Volume of distribution
    vd_per_kg = 0.7
    # Placeholder for future obesity logic
    V = vd_per_kg * tbw if not obesity_adjustment else vd_per_kg * tbw  # same for now

    k = CL / max(V, 1e-12)

    # Steady-state peak/trough using the pk module
    cmax_ss, cmin_ss = pk.ss_peak_trough(CL=CL, V=V, dose_mg=float(dose_mg), tau_h=float(tau_h), tinf_min=float(tinf_min))

    # AUC24 steady state via analytical relation: AUC24 = DailyDose / CL
    daily_dose_mg = float(dose_mg) * (24.0 / float(tau_h))
    auc24 = pk.auc24_ss(daily_dose_mg=daily_dose_mg, CL_L_h=CL)

    # Loading dose options (20–25 mg/kg), capped at 3000 mg and rounded to nearest 250 mg
    ld_options = loading_dose_options_mg(
        weight_kg=tbw, targets_mg_per_kg=(20.0, 25.0), cap_mg=3000, rounding_step_mg=250
    )

    return {
        "weights": {
            "TBW": tbw,
            "IBW": ibw,
            "AdjBW": adjbw,
            "weight_for_crcl": weight_for_crcl,
            "mode": weight_mode,
        },
        "crcl": {
            "mL_min_raw": crcl_ml_min_raw,
            "mL_min_capped": crcl_ml_min_capped,
            "L_h": crcl_L_h,
        },
        "cl_vanc_L_h": CL,
        "vd_L": V,
        "k_h_inv": k,
        "ss": {
            "cmax_mg_L": cmax_ss,
            "cmin_mg_L": cmin_ss,
        },
        "auc24_ss_mg_h_L": auc24,
        "loading_dose": {
            "options_mg": ld_options,
            "cap_mg": 3000,
            "rounding_step_mg": 250,
        },
        "policy": {
            "crcl_cap_mL_min": 150,
            "cl_from_crcl_factor": 0.75,
            "vd_L_per_kg": 0.7,
        },
    }
