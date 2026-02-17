from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple

from utils import pk


# Configurable guardrails (ASHP/IDSA 2020 aligned defaults)
MAX_SINGLE_DOSE_MG = 2000
MAX_DAILY_DOSE_MG = 4500
ALLOWED_INTERVALS_HR = [6, 8, 12, 24, 48]
DOSE_INCREMENT_MG = 250
AUC_TARGET_LOW = 400.0
AUC_TARGET_HIGH = 600.0
AUC_TARGET_MID = 500.0


def infusion_hours_for_dose(dose_mg: float) -> float:
    """Simple infusion time rule based on dose size."""
    if dose_mg >= 2000:
        return 2.0
    if dose_mg >= 1500:
        return 1.5
    return 1.0


@dataclass(frozen=True)
class CandidateRegimen:
    dose_mg: float
    interval_hr: float
    infusion_hr: float
    auc24: float
    peak: float
    trough: float
    daily_dose_mg: float


def _interval_preference(interval_hr: float) -> int:
    """Tie-breaker: prefer q12, then q24, then q8, q6, q48."""
    order = {12: 0, 24: 1, 8: 2, 6: 3, 48: 4}
    return order.get(int(interval_hr), 99)


def recommend_regimens(
    weight_kg: float,
    crcl: float,
    serious: bool,
    k_e: float | None = None,
    vd_l: float | None = None,
) -> Tuple[List[CandidateRegimen], List[str]]:
    """Search candidate regimens and return ordered options."""
    k_e = k_e or pk.elimination_constant(crcl)
    vd_l = vd_l or pk.volume_distribution(weight_kg)

    candidates: List[CandidateRegimen] = []
    for interval_hr in ALLOWED_INTERVALS_HR:
        for dose_mg in range(DOSE_INCREMENT_MG, MAX_SINGLE_DOSE_MG + DOSE_INCREMENT_MG, DOSE_INCREMENT_MG):
            infusion_hr = infusion_hours_for_dose(dose_mg)
            daily_dose = dose_mg * (24.0 / interval_hr)
            if daily_dose > MAX_DAILY_DOSE_MG:
                continue
            auc24 = pk.calculate_auc_24(dose_mg, interval_hr, k_e, vd_l)
            peak = pk.predict_peak(dose_mg, interval_hr, k_e, vd_l, infusion_hr)
            trough = pk.predict_trough(dose_mg, interval_hr, k_e, vd_l, infusion_hr)
            candidates.append(
                CandidateRegimen(
                    dose_mg=dose_mg,
                    interval_hr=interval_hr,
                    infusion_hr=infusion_hr,
                    auc24=auc24,
                    peak=peak,
                    trough=trough,
                    daily_dose_mg=daily_dose,
                )
            )

    if not candidates:
        raise ValueError("No valid regimens within guardrails.")

    def score(candidate: CandidateRegimen) -> Tuple[int, float, int, float, float]:
        in_target = AUC_TARGET_LOW <= candidate.auc24 <= AUC_TARGET_HIGH
        if in_target:
            distance = abs(candidate.auc24 - AUC_TARGET_MID)
        else:
            distance = min(abs(candidate.auc24 - AUC_TARGET_LOW), abs(candidate.auc24 - AUC_TARGET_HIGH))
        return (
            0 if in_target else 1,
            distance,
            _interval_preference(candidate.interval_hr),
            candidate.daily_dose_mg,
            candidate.trough,
        )

    candidates_sorted = sorted(candidates, key=score)
    best = candidates_sorted[0]

    warnings: List[str] = []
    if not (AUC_TARGET_LOW <= best.auc24 <= AUC_TARGET_HIGH):
        warnings.append(
            f"Unable to reach {AUC_TARGET_LOW:.0f}-{AUC_TARGET_HIGH:.0f} mg·h/L with allowed constraints; closest is {best.auc24:.0f}."
        )

    return candidates_sorted, warnings


def recommend_regimen(
    weight_kg: float,
    crcl: float,
    serious: bool,
    k_e: float | None = None,
    vd_l: float | None = None,
) -> Tuple[CandidateRegimen, List[str]]:
    """Return the single best regimen."""
    options, warnings = recommend_regimens(weight_kg, crcl, serious, k_e=k_e, vd_l=vd_l)
    return options[0], warnings


def loading_dose(weight_kg: float, serious: bool) -> float:
    """Loading dose 20-25 mg/kg (cap 3000 mg) for serious infections."""
    if not serious:
        return 0.0
    return min(pk._round_to_increment(25 * weight_kg, 250), 3000)

