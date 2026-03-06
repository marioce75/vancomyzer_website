"""
Typical value (TV) covariate model — NONMEM-style.

TVCL, TVV1, TVQ, TVV2 with optional covariate exponents.
Reference: CrCl 100 mL/min, WT 70 kg.
"""

from __future__ import annotations

from typing import Dict, Any

import numpy as np

# Default reference values
CRCL_REF = 100.0
WT_REF = 70.0


def typical_params(covariates: Dict[str, float], theta: Dict[str, float]) -> Dict[str, float]:
    """
    Compute typical (population) PK parameters from theta and covariates.

    theta keys (example): TVCL, TVV1, TVQ, TVV2, theta_crcl_cl, theta_wt_cl, theta_wt_v1, theta_wt_q, theta_wt_v2.
    Covariates: weight_kg, crcl_ml_min (optional; if missing, exponents not applied or use 1.0).

    Equations:
      CL = TVCL * (CrCl/100)^theta_crcl_cl * (WT/70)^theta_wt_cl
      V1 = TVV1 * (WT/70)^theta_wt_v1
      Q  = TVQ  * (WT/70)^theta_wt_q
      V2 = TVV2 * (WT/70)^theta_wt_v2
    """
    wt = float(covariates.get("weight_kg", WT_REF))
    crcl = float(covariates.get("crcl_ml_min", CRCL_REF))
    wt = max(wt, 1.0)
    crcl = max(crcl, 1.0)

    tvcl = float(theta.get("TVCL", 4.0))
    tvv1 = float(theta.get("TVV1", 35.0))
    tvq = float(theta.get("TVQ", 3.0))
    tvv2 = float(theta.get("TVV2", 25.0))
    theta_crcl_cl = float(theta.get("theta_crcl_cl", 0.8))
    theta_wt_cl = float(theta.get("theta_wt_cl", 0.75))
    theta_wt_v1 = float(theta.get("theta_wt_v1", 1.0))
    theta_wt_q = float(theta.get("theta_wt_q", 0.75))
    theta_wt_v2 = float(theta.get("theta_wt_v2", 0.75))

    cl = tvcl * ((crcl / CRCL_REF) ** theta_crcl_cl) * ((wt / WT_REF) ** theta_wt_cl)
    v1 = tvv1 * ((wt / WT_REF) ** theta_wt_v1)
    q = tvq * ((wt / WT_REF) ** theta_wt_q)
    v2 = tvv2 * ((wt / WT_REF) ** theta_wt_v2)

    return {
        "CL": max(cl, 1e-6),
        "V1": max(v1, 1e-6),
        "Q": max(q, 1e-9),
        "V2": max(v2, 1e-6),
    }
