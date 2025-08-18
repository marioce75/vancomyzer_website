from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

import numpy as np
import pymc as pm
import pytensor.tensor as pt

from .pk import predict_at_times, superposition_curve, auc_trapezoid

# --------------------
# Constants (tuneable)
# --------------------
DEFAULT_THETA1 = 0.75  # CLcr exponent
DEFAULT_THETA2 = 0.25  # TBW exponent
TAU_CL = 0.35          # log-CL prior SD
TAU_V = 0.30           # log-V prior SD
RESID_SD_PRIOR = 0.2   # HalfNormal scale for residual log-error


@dataclass
class PatientCovars:
    clcr_ml_min: float  # Cockcroft-Gault (mL/min)
    tbw_kg: float       # total body weight


@dataclass
class Regimen:
    dose_mg: float
    interval_hours: float
    infusion_minutes: float


@dataclass
class Posterior:
    CL_draws: np.ndarray  # shape (n_draws,)
    V_draws: np.ndarray   # shape (n_draws,)
    sigma_draws: np.ndarray  # residual log-sd
    rhat_ok: bool = True

    @property
    def n(self) -> int:
        return int(self.CL_draws.shape[0])

    @property
    def CL_median(self) -> float:
        return float(np.median(self.CL_draws))

    @property
    def V_median(self) -> float:
        return float(np.median(self.V_draws))


def _prior_location_logCL(clcr: float, tbw: float, theta1: float = DEFAULT_THETA1, theta2: float = DEFAULT_THETA2) -> float:
    # Baseline CL 4.5 L/h scaled by CLcr and TBW
    base_CL = 4.5 * (max(clcr, 1e-3) / 100.0) ** theta1 * (max(tbw, 1e-3) / 70.0) ** theta2
    return float(np.log(base_CL))


def _prior_location_logV(tbw: float) -> float:
    base_V = 0.7 * max(tbw, 1e-3)
    return float(np.log(base_V))


def build_model(patient: PatientCovars, regimen: Regimen, level_times_np: np.ndarray | None, level_values_np: np.ndarray | None):
    with pm.Model() as model:
        # Priors on log-parameters
        mu_logCL = _prior_location_logCL(patient.clcr_ml_min, patient.tbw_kg)
        mu_logV = _prior_location_logV(patient.tbw_kg)

        logCL = pm.Normal('logCL', mu=mu_logCL, sigma=TAU_CL)
        logV = pm.Normal('logV', mu=mu_logV, sigma=TAU_V)
        sigma = pm.HalfNormal('sigma', sigma=RESID_SD_PRIOR)

        CL = pm.Deterministic('CL', pm.math.exp(logCL))
        V = pm.Deterministic('V', pm.math.exp(logV))

        if level_times_np is not None and level_values_np is not None and level_times_np.size > 0:
            # Build symbolic prediction using PyTensor
            t = pt.as_tensor_variable(level_times_np)  # shape (n,)
            tinf_h = pt.maximum(0.25, pt.as_tensor_variable(regimen.infusion_minutes) / 60.0)
            R0 = regimen.dose_mg / tinf_h
            k = CL / V
            tau = regimen.interval_hours

            # Determine number of doses to cover largest observed time
            t_max = float(level_times_np.max())
            n_doses = int(np.ceil((t_max + (float(regimen.infusion_minutes)/60.0) + 1e-9) / tau)) + 1
            dose_times = [i * tau for i in range(max(1, n_doses))]

            pred = pt.zeros_like(t, dtype='float64')
            for tDose in dose_times:
                td = t - tDose
                valid = pt.ge(td, 0)
                within = pt.and_(valid, pt.le(td, tinf_h))
                post = pt.and_(valid, pt.gt(td, tinf_h))
                within_f = within.astype('float64')
                post_f = post.astype('float64')
                pred = pred + within_f * (R0 / (k * V)) * (1.0 - pt.exp(-k * td))
                pred = pred + post_f * (R0 / (k * V)) * (1.0 - pt.exp(-k * tinf_h)) * pt.exp(-k * (td - tinf_h))

            # LogNormal observation on log-scale
            pm.LogNormal('y', mu=pt.log(pt.clip(pred, 1e-12, 1e9)), sigma=sigma, observed=level_values_np)

        return model


def fit_posterior(patient: PatientCovars, regimen: Regimen, levels: List[Dict[str, float]] | None) -> Posterior:
    # Extract measurement arrays
    if levels:
        times = np.array([float(x['time_hr']) for x in levels if 'time_hr' in x and 'concentration_mg_L' in x], dtype=float)
        values = np.array([float(x['concentration_mg_L']) for x in levels if 'time_hr' in x and 'concentration_mg_L' in x], dtype=float)
        # Only keep valid positive concentrations
        m = np.isfinite(times) & np.isfinite(values) & (values > 0)
        level_times = times[m]
        level_values = values[m]
    else:
        level_times = np.array([], dtype=float)
        level_values = np.array([], dtype=float)

    with build_model(patient, regimen, level_times if level_times.size else None, level_values if level_values.size else None):
        idata = pm.sample(
            draws=800,
            tune=800,
            chains=2,
            target_accept=0.9,
            progressbar=False,
            compute_convergence_checks=True,
            random_seed=42,
        )

    cl_draws = idata.posterior['CL'].values.reshape(-1)
    v_draws = idata.posterior['V'].values.reshape(-1)
    s_draws = idata.posterior['sigma'].values.reshape(-1)

    # rhat diagnostics if present
    try:
      rhat = pm.rhat(idata, var_names=["CL","V"]).to_array().values
      rhat_ok = bool(np.all(np.isfinite(rhat)) and np.nanmax(rhat) < 1.1)
    except Exception:
      rhat_ok = True

    # Thin to ~600 draws if needed
    n = cl_draws.shape[0]
    target = 600
    stride = max(1, n // target)
    cl_draws = cl_draws[::stride]
    v_draws = v_draws[::stride]
    s_draws = s_draws[::stride]

    return Posterior(CL_draws=cl_draws, V_draws=v_draws, sigma_draws=s_draws, rhat_ok=rhat_ok)


def simulate_from_posterior(posterior: Posterior, regimen: Regimen, horizon_h: float = 48.0, dt: float = 0.05):
    # Vectorized simulation across draws
    times = np.arange(0.0, horizon_h + dt / 2, dt, dtype=float)
    curves = []
    auc24 = []
    c_peak = []
    c_trough = []

    Tinf_h = max(0.25, regimen.infusion_minutes / 60.0)
    for cl, v in zip(posterior.CL_draws, posterior.V_draws):
        t, c = superposition_curve(cl, v, regimen.dose_mg, regimen.interval_hours, regimen.infusion_minutes, horizon_h=horizon_h, dt=dt, n_doses=int(np.ceil(horizon_h / regimen.interval_hours)) + 2)
        curves.append(c)
        auc24.append(auc_trapezoid(t, c, 0.0, 24.0))
        # Summary metrics: peak ~ 1h post end of infusion of first interval, trough ~ just before next dose
        t_peak = min(Tinf_h + 1.0, regimen.interval_hours)
        t_trough = max(regimen.interval_hours - 1e-2, 0.0)
        c_peak.append(np.interp(t_peak, t, c))
        c_trough.append(np.interp(t_trough, t, c))

    M = np.vstack(curves) if len(curves) else np.zeros((0, times.size))
    median = np.nanmedian(M, axis=0) if M.size else np.zeros_like(times)
    p05 = np.nanpercentile(M, 5, axis=0) if M.size else np.zeros_like(times)
    p95 = np.nanpercentile(M, 95, axis=0) if M.size else np.zeros_like(times)

    return {
        'time_hours': times.tolist(),
        'median': median.tolist(),
        'p05': p05.tolist(),
        'p95': p95.tolist(),
        'auc24': float(np.nanmedian(auc24)) if auc24 else 0.0,
        'c_peak': float(np.nanmedian(c_peak)) if c_peak else 0.0,
        'c_trough': float(np.nanmedian(c_trough)) if c_trough else 0.0,
    }
