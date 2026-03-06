"""
Residual error model: proportional, additive, or combined.

Cobs = Cpred * (1 + eps_prop)  [proportional]
Cobs = Cpred + eps_add          [additive]
Cobs = Cpred * (1 + eps1) + eps2  [combined], eps1, eps2 independent N(0, sigma^2)
"""

from __future__ import annotations

from typing import Literal, Tuple, Union

import numpy as np

# Clamp predicted concentration to avoid log(0)
_C_MIN = 1e-9


def loglik(
    y_obs: np.ndarray,
    y_pred: np.ndarray,
    sigma: Union[float, Tuple[float, float]],
    model: Literal["proportional", "additive", "combined"] = "combined",
) -> float:
    """
    Log-likelihood of observations given predictions and residual error.

    y_obs, y_pred: 1D arrays (same length). Time unit: hours.
    sigma: for proportional/additive a single float (std); for combined (sigma_prop, sigma_add).
    """
    y_obs = np.asarray(y_obs, dtype=float).ravel()
    y_pred = np.asarray(y_pred, dtype=float).ravel()
    y_obs = np.maximum(y_obs, _C_MIN)
    y_pred = np.maximum(y_pred, _C_MIN)
    n = len(y_obs)
    if n == 0:
        return 0.0
    if model == "proportional":
        sig = float(sigma)
        sig = max(sig, 1e-9)
        # Cobs = Cpred * (1 + eps) => eps = (Cobs/Cpred - 1), var = sigma^2
        sd = sig * y_pred
        sd = np.maximum(sd, 1e-9)
        resid = y_obs - y_pred
        return float(-0.5 * np.sum((resid / sd) ** 2 + np.log(2 * np.pi * sd ** 2)))
    if model == "additive":
        sig = float(sigma)
        sig = max(sig, 1e-9)
        resid = y_obs - y_pred
        return float(-0.5 * np.sum((resid / sig) ** 2 + np.log(2 * np.pi * sig ** 2)))
    if model == "combined":
        sig_p, sig_a = (sigma[0], sigma[1]) if isinstance(sigma, (tuple, list)) else (float(sigma) * 0.15, float(sigma) * 1.5)
        sig_p = max(sig_p, 1e-9)
        sig_a = max(sig_a, 1e-9)
        # Variance of Cobs: (Cpred*sig_p)^2 + sig_a^2
        var = (y_pred * sig_p) ** 2 + sig_a ** 2
        var = np.maximum(var, 1e-18)
        resid = y_obs - y_pred
        return float(-0.5 * np.sum((resid ** 2) / var + np.log(2 * np.pi * var)))
    raise ValueError(f"Unknown residual model: {model}")
