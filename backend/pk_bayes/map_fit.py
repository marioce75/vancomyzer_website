"""
MAP (Maximum a Posteriori) Bayesian updating: estimate eta given observed concentrations.

Posterior: log p(eta | y) ∝ log p(y | eta) + log p(eta)
Prior: eta ~ N(0, Omega)
Optimize with scipy; Laplace approximation for uncertainty.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
from scipy.optimize import minimize
from scipy.stats import multivariate_normal

from backend.pk_bayes.covariates import typical_params
from backend.pk_bayes.models.two_comp_iv import DoseEvent, predict_levels
from backend.pk_bayes.random_effects import PARAM_NAMES, apply_iiv
from backend.pk_bayes.residual_error import loglik


# Sample schema: list of dicts with time_h, concentration_mg_L, optional sample_type, dose_event_link
def _samples_to_arrays(samples: List[Dict[str, Any]]) -> Tuple[np.ndarray, np.ndarray]:
    """Extract (times, concentrations) from sample list."""
    times = np.array([float(s["time_h"]) for s in samples], dtype=float)
    conc = np.array([float(s["concentration_mg_L"]) for s in samples], dtype=float)
    return times, conc


def _build_events(regimen: List[Dict[str, Any]]) -> List[DoseEvent]:
    """Build list of DoseEvent from regimen. Each element: dose_mg, start_time_hr or start_hr, infusion_hr or t_inf_h. Or single element with tau_h for repeated."""
    events = []
    for r in regimen:
        dose_mg = float(r.get("dose_mg", 1000))
        t_inf_h = float(r.get("t_inf_h", r.get("infusion_hr", 1.0)))
        start = float(r.get("start_time_hr", r.get("start_hr", 0.0)))
        if "tau_h" in r and len(regimen) == 1:
            tau = float(r["tau_h"])
            for i in range(10):
                events.append(DoseEvent(dose_mg=dose_mg, start_hr=start + i * tau, infusion_hr=t_inf_h))
        else:
            events.append(DoseEvent(dose_mg=dose_mg, start_hr=start, infusion_hr=t_inf_h))
    if not events:
        events = [DoseEvent(dose_mg=1000.0, start_hr=0.0, infusion_hr=1.0)]
    return events


@dataclass
class FitResult:
    """Result of MAP fit."""
    eta_hat: np.ndarray
    individual_params: Dict[str, float]
    typical_params: Dict[str, float]  # population typical for this subject (for posterior sampling)
    objective: float
    convergence: bool
    message: str
    hessian_inv: Optional[np.ndarray] = None
    residuals: Optional[np.ndarray] = None
    model_fit_r_squared: Optional[float] = None
    warnings: List[str] = field(default_factory=list)
    model_name: str = ""
    assumptions: str = ""


def _neg_log_posterior(
    eta: np.ndarray,
    covariates: Dict[str, float],
    events: List[DoseEvent],
    times_obs: np.ndarray,
    conc_obs: np.ndarray,
    theta: Dict[str, float],
    omega: np.ndarray,
    sigma: Any,
    residual_model: str,
) -> float:
    """Negative log posterior: -log p(eta|y)."""
    p_typ = typical_params(covariates, theta)
    p_ind = apply_iiv(p_typ, eta)
    pred = predict_levels(p_ind, events, times_obs)
    pred = np.maximum(pred, 1e-9)
    ll = loglik(conc_obs, pred, sigma, model=residual_model)
    # Prior: eta ~ N(0, Omega)
    try:
        lp = multivariate_normal.logpdf(eta, mean=np.zeros_like(eta), cov=omega)
    except Exception:
        lp = -1e10
    lp = float(lp) if np.isfinite(lp) else -1e10
    return -(ll + lp)


def fit_map(
    covariates: Dict[str, float],
    regimen: List[Dict[str, Any]],
    samples: List[Dict[str, Any]],
    pop_model: Dict[str, Any],
    eta_bounds: Tuple[float, float] = (-3.0, 3.0),
    n_restarts: int = 4,
) -> FitResult:
    """
    MAP fit: find eta that maximizes p(eta|y).

    covariates: weight_kg, crcl_ml_min (and any needed for typical_params).
    regimen: list of {dose_mg, start_time_hr or start_hr, infusion_hr or t_inf_h} or {dose_mg, tau_h, t_inf_h}.
    samples: list of {time_h, concentration_mg_L, ...}.
    pop_model: from get_model() — theta, omega, sigma, residual_model.
    """
    warnings_list: List[str] = []
    # Input validation
    if not samples:
        raise ValueError("At least one sample is required for MAP fit")
    times_obs, conc_obs = _samples_to_arrays(samples)
    if np.any(times_obs < 0):
        raise ValueError("Sample times must be non-negative")
    if np.any(conc_obs <= 0):
        raise ValueError("Concentrations must be positive")
    if len(samples) == 1:
        warnings_list.append("Single level: identifiability limited; interpret with caution")

    theta = pop_model.get("theta", {})
    omega = np.asarray(pop_model.get("omega", np.eye(4) * 0.2), dtype=float)
    if omega.shape != (4, 4):
        omega = np.diag(np.ones(4) * 0.2)
    sigma = pop_model.get("sigma", {"proportional": 0.15, "additive": 1.5})
    residual_model = pop_model.get("residual_model", "combined")
    if isinstance(sigma, dict):
        sigma_tuple = (float(sigma.get("proportional", 0.15)), float(sigma.get("additive", 1.5)))
    else:
        sigma_tuple = sigma

    events = _build_events(regimen)
    n_eta = 4
    bounds = [eta_bounds] * n_eta

    def obj(eta: np.ndarray) -> float:
        return _neg_log_posterior(
            eta, covariates, events, times_obs, conc_obs,
            theta, omega, sigma_tuple, residual_model,
        )

    # Multiple restarts
    best_f = np.inf
    best_x = np.zeros(n_eta)
    rng = np.random.default_rng(42)
    for _ in range(n_restarts):
        x0 = rng.uniform(-0.5, 0.5, size=n_eta) if _ > 0 else np.zeros(n_eta)
        res = minimize(
            obj,
            x0,
            method="L-BFGS-B",
            bounds=bounds,
            options={"maxiter": 300, "ftol": 1e-8},
        )
        if res.fun < best_f:
            best_f = res.fun
            best_x = res.x.copy()

    eta_hat = best_x
    p_typ = typical_params(covariates, theta)
    p_ind = apply_iiv(p_typ, eta_hat)
    pred = predict_levels(p_ind, events, times_obs)
    residuals = conc_obs - pred
    # R-squared
    ss_res = np.sum(residuals ** 2)
    ss_tot = np.sum((conc_obs - np.mean(conc_obs)) ** 2)
    r_sq = float(1.0 - ss_res / ss_tot) if ss_tot > 1e-15 else 0.0

    # Hessian at MAP (finite difference)
    eps = 1e-4
    hess = np.zeros((n_eta, n_eta))
    f0 = obj(eta_hat)
    for i in range(n_eta):
        for j in range(n_eta):
            e_ip = eta_hat.copy()
            e_ip[i] += eps
            e_jp = eta_hat.copy()
            e_jp[j] += eps
            e_both = eta_hat.copy()
            e_both[i] += eps
            e_both[j] += eps
            hess[i, j] = (obj(e_both) - obj(e_ip) - obj(e_jp) + f0) / (eps * eps)
    try:
        hess_inv = np.linalg.inv(hess)
    except np.linalg.LinAlgError:
        hess_inv = np.diag(1.0 / np.diag(omega))

    conv = best_f < 1e6 and np.all(np.isfinite(eta_hat))
    return FitResult(
        eta_hat=eta_hat,
        individual_params=p_ind,
        typical_params=p_typ,
        objective=best_f,
        convergence=conv,
        message="MAP fit completed",
        hessian_inv=hess_inv,
        residuals=residuals,
        model_fit_r_squared=r_sq,
        warnings=warnings_list,
        model_name=pop_model.get("model_name", "unknown"),
        assumptions=pop_model.get("description", "2-compartment IV, log-normal IIV, combined residual error."),
    )
