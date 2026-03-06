"""
Unit and regression tests for backend/pk_bayes (NONMEM-style Bayesian engine).
"""

from __future__ import annotations

import pytest
import numpy as np

from backend.pk_bayes.models.two_comp_iv import (
    DoseEvent,
    concentration_timecourse,
    predict_levels,
)
from backend.pk_bayes.covariates import typical_params
from backend.pk_bayes.random_effects import apply_iiv, omega_to_chol
from backend.pk_bayes.residual_error import loglik
from backend.pk_bayes.model_registry import get_model, list_models
from backend.pk_bayes.map_fit import fit_map
from backend.pk_bayes.posterior_predictive import simulate_posterior, compute_pta


# --- A1: Deterministic prediction sanity ---
def test_two_comp_concentration_nonnegative_and_continuous():
    params = {"CL": 4.0, "V1": 35.0, "Q": 3.0, "V2": 25.0}
    regimen = [
        DoseEvent(dose_mg=1000.0, start_hr=0.0, infusion_hr=1.0),
        DoseEvent(dose_mg=1000.0, start_hr=12.0, infusion_hr=1.0),
    ]
    times = np.linspace(0, 24, 100)
    c = concentration_timecourse(params, regimen, times)
    assert np.all(c >= 0), "Concentrations must be non-negative"
    assert np.all(np.isfinite(c)), "Concentrations must be finite"
    assert len(c) == len(times)


def test_predict_levels_matches_timecourse():
    params = {"CL": 5.0, "V1": 40.0, "Q": 2.0, "V2": 20.0}
    regimen = [DoseEvent(dose_mg=1000.0, start_hr=0.0, infusion_hr=1.0)]
    times = np.array([1.0, 2.0, 6.0])
    c1 = concentration_timecourse(params, regimen, times)
    c2 = predict_levels(params, regimen, times)
    np.testing.assert_allclose(c1, c2, rtol=1e-5)


# --- A2/A3/A4: Covariates, IIV, residual ---
def test_typical_params_covariates():
    theta = {"TVCL": 4.0, "TVV1": 35.0, "TVQ": 3.0, "TVV2": 25.0, "theta_crcl_cl": 0.8, "theta_wt_cl": 0.75}
    cov = {"weight_kg": 70.0, "crcl_ml_min": 100.0}
    p = typical_params(cov, theta)
    assert "CL" in p and "V1" in p
    assert p["CL"] > 0 and p["V1"] > 0


def test_apply_iiv():
    p_typ = {"CL": 4.0, "V1": 35.0, "Q": 3.0, "V2": 25.0}
    eta = np.array([0.0, 0.0, 0.0, 0.0])
    p_ind = apply_iiv(p_typ, eta)
    assert p_ind["CL"] == p_typ["CL"]
    eta2 = np.array([0.5, 0.0, 0.0, 0.0])
    p_ind2 = apply_iiv(p_typ, eta2)
    assert p_ind2["CL"] > p_typ["CL"]


def test_omega_chol():
    omega = np.diag([0.2, 0.2, 0.15, 0.15])
    L = omega_to_chol(omega)
    assert L.shape == (4, 4)
    np.testing.assert_allclose(L @ L.T, omega, rtol=1e-5)


def test_loglik_combined():
    y_obs = np.array([20.0, 15.0, 10.0])
    y_pred = np.array([19.0, 14.0, 11.0])
    ll = loglik(y_obs, y_pred, (0.15, 1.5), model="combined")
    assert np.isfinite(ll)


# --- Model registry ---
def test_list_models():
    names = list_models()
    assert "vancomycin_2comp_placeholder" in names


def test_get_model():
    m = get_model("vancomycin_2comp_placeholder")
    assert "theta" in m and "omega" in m
    assert "TVCL" in m["theta"]


# --- MAP fit recovers (synthetic) ---
def test_map_fit_synthetic_recovery():
    pop_model = get_model("vancomycin_2comp_placeholder")
    covariates = {"weight_kg": 70.0, "crcl_ml_min": 90.0}
    regimen = [
        {"dose_mg": 1000.0, "start_time_hr": 0.0, "infusion_hr": 1.0},
        {"dose_mg": 1000.0, "start_time_hr": 12.0, "infusion_hr": 1.0},
    ]
    # True individual params (we don't know eta; use typical + small eta)
    p_typ = typical_params(covariates, pop_model["theta"])
    eta_true = np.array([0.2, -0.1, 0.0, 0.0])
    p_true = apply_iiv(p_typ, eta_true)
    times_samp = np.array([2.0, 11.0])
    conc_true = predict_levels(p_true, [DoseEvent(1000, 0, 1), DoseEvent(1000, 12, 1)], times_samp)
    samples = [{"time_h": float(t), "concentration_mg_L": float(c)} for t, c in zip(times_samp, conc_true)]
    fit_result = fit_map(covariates, regimen, samples, pop_model)
    assert fit_result.convergence
    # CL should be in same ballpark
    assert 0.5 * p_true["CL"] <= fit_result.individual_params["CL"] <= 2.0 * p_true["CL"]


# --- Posterior predictive quantiles ---
def test_posterior_sim_quantiles():
    pop_model = get_model("vancomycin_2comp_placeholder")
    covariates = {"weight_kg": 70.0, "crcl_ml_min": 80.0}
    regimen = [{"dose_mg": 1000.0, "start_time_hr": 0.0, "infusion_hr": 1.0}, {"dose_mg": 1000.0, "start_time_hr": 12.0, "infusion_hr": 1.0}]
    samples = [{"time_h": 2.0, "concentration_mg_L": 22.0}, {"time_h": 11.0, "concentration_mg_L": 14.0}]
    fit_result = fit_map(covariates, regimen, samples, pop_model)
    sim = simulate_posterior(fit_result, regimen, n=200)
    assert np.all(sim.lower_curve <= sim.median_curve)
    assert np.all(sim.median_curve <= sim.upper_curve)
    assert sim.auc24_lower <= sim.auc24_median <= sim.auc24_upper


# --- Edge cases ---
def test_map_fit_rejects_negative_time():
    pop_model = get_model("vancomycin_2comp_placeholder")
    covariates = {"weight_kg": 70.0, "crcl_ml_min": 80.0}
    regimen = [{"dose_mg": 1000.0, "start_time_hr": 0.0, "infusion_hr": 1.0}]
    samples = [{"time_h": -1.0, "concentration_mg_L": 20.0}]
    with pytest.raises(ValueError, match="non-negative"):
        fit_map(covariates, regimen, samples, pop_model)


def test_map_fit_requires_at_least_one_sample():
    pop_model = get_model("vancomycin_2comp_placeholder")
    covariates = {"weight_kg": 70.0, "crcl_ml_min": 80.0}
    regimen = [{"dose_mg": 1000.0, "start_time_hr": 0.0, "infusion_hr": 1.0}]
    with pytest.raises(ValueError, match="At least one"):
        fit_map(covariates, regimen, [], pop_model)


def test_compute_pta():
    metrics = {"auc24": [400.0, 500.0, 600.0, 700.0], "trough": [8.0, 15.0, 25.0, 12.0]}
    targets = {"auc24": (400, 600)}
    pta = compute_pta(metrics, targets)
    assert "auc24" in pta
    assert 0 <= pta["auc24"] <= 1
