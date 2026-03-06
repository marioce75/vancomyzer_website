"""
Regimen optimization: rank candidate regimens by PTA and constraints.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from backend.pk_bayes.map_fit import FitResult
from backend.pk_bayes.posterior_predictive import simulate_posterior, PosteriorSim

# Default targets
AUC_TARGET = (400.0, 600.0)
AUC_MAX_SAFE = 650.0
TROUGH_MAX = 20.0


@dataclass
class RegimenCandidate:
    dose_mg: float
    interval_hr: float
    infusion_hr: float
    posterior_sim: PosteriorSim
    score: float  # primary: P(400<=AUC24<=600)
    p_auc_gt650: float
    p_trough_gt20: float


def rank_regimens(
    fit_result: FitResult,
    candidate_regimens: List[Dict[str, Any]],
    targets: Optional[Dict[str, Tuple[float, float]]] = None,
    n_sim: int = 500,
) -> List[RegimenCandidate]:
    """
    For each candidate regimen, run posterior predictive; rank by P(400<=AUC24<=600).
    Apply constraints: prefer P(AUC24>650)<0.1, P(trough>20)<0.1.
    """
    targets = targets or {"auc24": AUC_TARGET}
    results = []
    for reg in candidate_regimens:
        dose_mg = float(reg.get("dose_mg", 1000))
        interval_hr = float(reg.get("interval_hr", 12))
        infusion_hr = float(reg.get("infusion_hr", 1.0))
        regimen_list = [
            {
                "dose_mg": dose_mg,
                "tau_h": interval_hr,
                "t_inf_h": infusion_hr,
                "start_time_hr": 0.0,
            }
        ]
        sim = simulate_posterior(fit_result, regimen_list, n=n_sim)
        p_in_target = sim.pta_auc400_600 or 0.0
        p_auc_gt650 = 1.0 - (sim.pta_auc_lt650 or 0.0)
        p_trough_gt20 = 1.0 - (sim.pta_trough_lt20 or 0.0)
        results.append(
            RegimenCandidate(
                dose_mg=dose_mg,
                interval_hr=interval_hr,
                infusion_hr=infusion_hr,
                posterior_sim=sim,
                score=p_in_target,
                p_auc_gt650=p_auc_gt650,
                p_trough_gt20=p_trough_gt20,
            )
        )
    results.sort(key=lambda x: x.score, reverse=True)
    return results[:10]
