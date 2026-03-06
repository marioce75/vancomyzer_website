"""
Model registry: load population priors (theta, omega, sigma) by name.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from backend.pk_bayes.random_effects import PARAM_NAMES

_PRIORS_DIR = Path(__file__).resolve().parent / "priors"
_REGISTRY: Dict[str, Dict[str, Any]] = {}


def _load_prior(name: str) -> Dict[str, Any]:
    path = _PRIORS_DIR / f"{name}.json"
    if not path.exists():
        raise KeyError(f"Prior not found: {name}")
    raw = json.loads(path.read_text())
    # Ensure omega is numpy array
    if "omega" in raw and isinstance(raw["omega"], list):
        raw["omega"] = np.array(raw["omega"], dtype=float)
    return raw


def get_model(name: str) -> Dict[str, Any]:
    """Get full model spec (theta, omega, sigma, residual_model, etc.)."""
    if name not in _REGISTRY:
        _REGISTRY[name] = _load_prior(name)
    return _REGISTRY[name].copy()


def list_models() -> List[str]:
    """List available prior names (without .json)."""
    if not _PRIORS_DIR.exists():
        return []
    return [p.stem for p in _PRIORS_DIR.glob("*.json")]


def get_theta_omega_sigma(name: str) -> tuple:
    """Return (theta dict, omega 4x4 array, sigma dict or tuple)."""
    spec = get_model(name)
    theta = spec.get("theta", {})
    omega = spec.get("omega", np.eye(4) * 0.2)
    omega = np.asarray(omega, dtype=float)
    if omega.shape != (4, 4):
        omega = np.diag(np.diag(omega) if omega.ndim == 2 else np.ones(4) * 0.2)
    sigma = spec.get("sigma", {"proportional": 0.15, "additive": 1.5})
    return theta, omega, sigma
