"""
Interindividual variability (IIV) — log-normal ETA, NONMEM-style.

p_i = p_typ * exp(eta_p)
eta ~ N(0, Omega)
Omega can be full matrix; use Cholesky for sampling.
"""

from __future__ import annotations

from typing import Dict, List, Optional

import numpy as np

# Parameter names for ordering
PARAM_NAMES = ["CL", "V1", "Q", "V2"]


def omega_to_chol(omega: np.ndarray) -> np.ndarray:
    """
    Cholesky factor L such that Omega = L @ L.T.
    omega: symmetric positive-definite matrix (n x n).
    Returns lower triangular L.
    """
    omega = np.asarray(omega, dtype=float)
    try:
        L = np.linalg.cholesky(omega)
        return L
    except np.linalg.LinAlgError:
        # Fallback: use diagonal sqrt if not PD
        d = np.diag(np.diag(omega))
        d = np.maximum(d, 1e-8)
        return np.sqrt(d)


def apply_iiv(p_typ: Dict[str, float], eta: np.ndarray) -> Dict[str, float]:
    """
    Apply log-normal IIV: p_ind = p_typ * exp(eta).
    p_typ: dict of typical params (CL, V1, Q, V2).
    eta: 1D array of length 4 in order [eta_CL, eta_V1, eta_Q, eta_V2].
    """
    eta = np.asarray(eta, dtype=float).ravel()
    out = {}
    for i, name in enumerate(PARAM_NAMES):
        val = p_typ.get(name, 1.0)
        e = eta[i] if i < len(eta) else 0.0
        out[name] = max(float(val) * np.exp(e), 1e-6 if name == "CL" else 1e-6)
    return out


def eta_from_params(p_typ: Dict[str, float], p_ind: Dict[str, float]) -> np.ndarray:
    """Compute eta such that p_ind = p_typ * exp(eta). Log-space difference."""
    eta = np.zeros(len(PARAM_NAMES))
    for i, name in enumerate(PARAM_NAMES):
        t = p_typ.get(name, 1.0)
        ind = p_ind.get(name, t)
        if t <= 0 or ind <= 0:
            eta[i] = 0.0
        else:
            eta[i] = np.log(ind / t)
    return eta
