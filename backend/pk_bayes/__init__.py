"""
Bayesian vancomycin PK engine (NONMEM-style).

Research/educational use only. NOT FOR CLINICAL USE.
"""

from backend.pk_bayes.map_fit import fit_map, FitResult
from backend.pk_bayes.posterior_predictive import simulate_posterior, compute_pta, PosteriorSim
from backend.pk_bayes.regimen_opt import rank_regimens
from backend.pk_bayes.model_registry import get_model, list_models

__all__ = [
    "fit_map",
    "FitResult",
    "simulate_posterior",
    "compute_pta",
    "PosteriorSim",
    "rank_regimens",
    "get_model",
    "list_models",
]
