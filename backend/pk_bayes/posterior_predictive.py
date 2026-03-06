"""
Posterior predictive simulation: sample eta from Laplace approx, simulate curves, compute PTA.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np
from scipy.stats import norm

from backend.pk_bayes.map_fit import FitResult
from backend.pk_bayes.random_effects import apply_iiv
from backend.pk_bayes.covariates import typical_params
from backend.pk_bayes.models.two_comp_iv import DoseEvent, concentration_timecourse

# Default time grid 0–24 or 0–48 h
DEFAULT_TIMES_HR = np.linspace(0, 24, 241)


def _fit_to_events(regimen: List[Dict]) -> List[DoseEvent]:
    """Build DoseEvent list from regimen dicts."""
    events = []
    for r in regimen:
        dose_mg = float(r.get("dose_mg", 1000))
        t_inf = float(r.get("t_inf_h", r.get("infusion_hr", 1.0)))
        start = float(r.get("start_time_hr", r.get("start_hr", 0.0)))
        if "tau_h" in r:
            tau = float(r["tau_h"])
            for i in range(10):
                events.append(DoseEvent(dose_mg=dose_mg, start_hr=start + i * tau, infusion_hr=t_inf))
        else:
            events.append(DoseEvent(dose_mg=dose_mg, start_hr=start, infusion_hr=t_inf))
    return events or [DoseEvent(dose_mg=1000.0, start_hr=0.0, infusion_hr=1.0)]


@dataclass
class PosteriorSim:
    """Posterior predictive simulation result."""
    times_hr: np.ndarray
    median_curve: np.ndarray
    lower_curve: np.ndarray  # e.g. 5th percentile
    upper_curve: np.ndarray  # e.g. 95th percentile
    auc24_median: float
    auc24_lower: float
    auc24_upper: float
    trough_median: float
    trough_lower: float
    trough_upper: float
    peak_median: float
    peak_lower: float
    peak_upper: float
    pta_auc400_600: Optional[float] = None
    pta_trough_lt20: Optional[float] = None
    pta_auc_lt650: Optional[float] = None


def _auc_trapz(t: np.ndarray, c: np.ndarray, t_end: float = 24.0) -> float:
    mask = (t >= 0) & (t <= t_end)
    tt = t[mask]
    cc = c[mask]
    if tt.size < 2:
        return 0.0
    return float(np.trapz(cc, tt))


def simulate_posterior(
    fit_result: FitResult,
    regimen: List[Dict],
    times_h: Optional[np.ndarray] = None,
    n: int = 1000,
    omega: Optional[np.ndarray] = None,
    hess_inv: Optional[np.ndarray] = None,
    seed: int = 42,
) -> PosteriorSim:
    """
    Laplace approximation: eta ~ N(eta_hat, hess_inv).

    Sample n etas, for each compute curve, AUC24, peak, trough; return median and 5th/95th.
    """
    times_h = times_h if times_h is not None else DEFAULT_TIMES_HR
    events = _fit_to_events(regimen)
    eta_hat = fit_result.eta_hat
    p_typ = getattr(fit_result, "typical_params", None) or fit_result.individual_params
    cov = fit_result.hessian_inv if hess_inv is None else hess_inv
    if cov is None or not np.all(np.isfinite(cov)):
        cov = np.diag(np.ones(4) * 0.2)
    rng = np.random.default_rng(seed)
    n_eta = len(eta_hat)
    etas = rng.multivariate_normal(eta_hat, cov, size=n)

    curves = []
    auc24s = []
    troughs = []
    peaks = []
    interval_hr = 12.0
    infusion_hr = 1.0
    if events:
        interval_hr = events[1].start_hr - events[0].start_hr if len(events) > 1 else 12.0
        infusion_hr = events[0].infusion_hr

    for eta in etas:
        p_ind = apply_iiv(p_typ, eta)
        try:
            c = concentration_timecourse(p_ind, events, times_h)
        except Exception:
            c = np.zeros_like(times_h)
        curves.append(c)
        auc24s.append(_auc_trapz(times_h, c, 24.0))
        # Peak at end of infusion in last interval; trough just before next dose
        t_max = min(24.0, float(times_h[-1]))
        peak_t = (t_max - infusion_hr) if t_max > infusion_hr else infusion_hr
        trough_t = max(0.0, t_max - 1e-3)
        idx_peak = int(np.argmin(np.abs(times_h - peak_t)))
        idx_trough = int(np.argmin(np.abs(times_h - trough_t)))
        peaks.append(float(c[idx_peak]))
        troughs.append(float(c[idx_trough]))

    curves = np.vstack(curves)
    median_c = np.median(curves, axis=0)
    lower_c = np.percentile(curves, 5, axis=0)
    upper_c = np.percentile(curves, 95, axis=0)
    auc24_median = float(np.median(auc24s))
    auc24_lower = float(np.percentile(auc24s, 5))
    auc24_upper = float(np.percentile(auc24s, 95))
    peak_median = float(np.median(peaks))
    peak_lower = float(np.percentile(peaks, 5))
    peak_upper = float(np.percentile(peaks, 95))
    trough_median = float(np.median(troughs))
    trough_lower = float(np.percentile(troughs, 5))
    trough_upper = float(np.percentile(troughs, 95))

    pta_400_600 = np.mean([1.0 if 400 <= a <= 600 else 0.0 for a in auc24s])
    pta_trough = np.mean([1.0 if t < 20 else 0.0 for t in troughs])
    pta_auc_lt650 = np.mean([1.0 if a < 650 else 0.0 for a in auc24s])

    return PosteriorSim(
        times_hr=times_h,
        median_curve=median_c,
        lower_curve=lower_c,
        upper_curve=upper_c,
        auc24_median=auc24_median,
        auc24_lower=auc24_lower,
        auc24_upper=auc24_upper,
        trough_median=trough_median,
        trough_lower=trough_lower,
        trough_upper=trough_upper,
        peak_median=peak_median,
        peak_lower=peak_lower,
        peak_upper=peak_upper,
        pta_auc400_600=float(pta_400_600),
        pta_trough_lt20=float(pta_trough),
        pta_auc_lt650=float(pta_auc_lt650),
    )


def compute_pta(
    metrics_samples: Dict[str, List[float]],
    targets: Dict[str, Tuple[float, float]],
) -> Dict[str, float]:
    """
    Compute PTA for each target.
    metrics_samples: e.g. {"auc24": [..], "trough": [..]}.
    targets: e.g. {"auc24": (400, 600), "trough_lt": 20}.
    Returns dict of target_key -> P(within target).
    """
    out = {}
    for name, (low, high) in targets.items():
        if name not in metrics_samples:
            continue
        vals = metrics_samples[name]
        if "lt" in name or name == "trough":
            # P(X < high)
            out[name] = float(np.mean([1.0 if v < high else 0.0 for v in vals]))
        else:
            out[name] = float(np.mean([1.0 if low <= v <= high else 0.0 for v in vals]))
    return out
