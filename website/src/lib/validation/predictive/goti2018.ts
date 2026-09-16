/**
 * Goti 2018-based truth model: the GROUND-TRUTH generator for the
 * predictive-performance harness (developer-run synthetic analysis, not
 * real patients).
 *
 * Source of the typical values: Goti V, Chaturvedula A, Fossler MJ, et al.
 * Hospitalized patients with and without hemodialysis have markedly
 * different vancomycin pharmacokinetics: a population pharmacokinetic
 * model-based analysis. Ther Drug Monit. 2018;40(2):212–221.
 * DOI: 10.1097/FTD.0000000000000490
 *
 * Why a different model from Vancomyzer's prior: the truth model should not
 * be Colin 2019, or the fit would start from the true typical values. Goti
 * 2018 is a two-compartment model built from routine hospital monitoring
 * data, with creatinine clearance (not serum creatinine) on clearance, so
 * the prior and the truth differ in structure as well as in values.
 *
 * What is Goti 2018 and what is a developer choice. The Goti 2018 abstract
 * (and Bai et al. 2025, Table 1) list creatinine clearance and dialysis
 * status as covariates on clearance and dialysis status on central volume.
 * No body-weight covariate is listed. The allometric weight terms below were
 * ADDED by the developer, and the variability and residual-error values are
 * developer choices, not Goti 2018 estimates. The typical values and the
 * CrCl relationship are as transcribed by the developer and have not been
 * re-checked against the full text in this revision.
 *
 *     CL (L/h) = θCL × (CrCl_mL_min / 120)^0.8 × (WT_kg / 70)^0.75   (weight term added)
 *     V1 (L)   = θV1 × (WT_kg / 70)                                  (weight term added)
 *     Q  (L/h) = θQ  × (WT_kg / 70)^0.75                             (weight term added)
 *     V2 (L)   = θV2 × (WT_kg / 70)                                  (weight term added)
 *
 *     θCL = 4.5, θV1 = 58.4, θQ = 6.5, θV2 = 38.4 (non-dialysis branch)
 *
 * Between-subject variability (log-normal), developer-chosen:
 *
 *     omega_CL = 0.40, omega_V1 = 0.30, omega_Q = 0.50, omega_V2 = 0.40
 *
 * Residual error (combined proportional + additive), developer-chosen:
 *     prop_err = 0.20 (20% CV), add_err = 1.0 mg/L SD
 *
 * @safety-checked-via not-clinical: this module never emits a dose. It only
 * generates synthetic concentrations for offline validation. No production
 * code path imports from this file.
 */

import type { Rng } from "./rng";

export const GOTI_2018_THETA = {
  CL: 4.5,   // L/h per 70 kg at CrCl = 120 mL/min
  V1: 58.4,  // L per 70 kg
  Q:  6.5,   // L/h per 70 kg
  V2: 38.4,  // L per 70 kg
} as const;

export const GOTI_2018_OMEGA = {
  CL: 0.40,
  V1: 0.30,
  Q:  0.50,
  V2: 0.40,
} as const;

export const GOTI_2018_RESIDUAL = {
  proportional: 0.20, // CV
  additive_mg_l: 1.0,
} as const;

export interface GotiCovariates {
  weight_kg: number;
  crcl_ml_min: number;
}

export interface PkParameters {
  CL: number;
  V1: number;
  Q: number;
  V2: number;
}

/** Typical-value (population) Goti parameters for a given patient — no BSV. */
export function gotiTypicalParameters(cov: GotiCovariates): PkParameters {
  const wt_ratio = cov.weight_kg / 70;
  return {
    CL: GOTI_2018_THETA.CL * Math.pow(cov.crcl_ml_min / 120, 0.8) * Math.pow(wt_ratio, 0.75),
    V1: GOTI_2018_THETA.V1 * wt_ratio,
    Q:  GOTI_2018_THETA.Q  * Math.pow(wt_ratio, 0.75),
    V2: GOTI_2018_THETA.V2 * wt_ratio,
  };
}

/** Draw an individual's "true" Goti parameters by adding log-normal BSV. */
export function gotiIndividualParameters(cov: GotiCovariates, rng: Rng): PkParameters {
  const typ = gotiTypicalParameters(cov);
  return {
    CL: typ.CL * rng.logNormal(0, GOTI_2018_OMEGA.CL),
    V1: typ.V1 * rng.logNormal(0, GOTI_2018_OMEGA.V1),
    Q:  typ.Q  * rng.logNormal(0, GOTI_2018_OMEGA.Q),
    V2: typ.V2 * rng.logNormal(0, GOTI_2018_OMEGA.V2),
  };
}

/** Add the developer-chosen combined proportional + additive residual error to a concentration (floored at 0.1 mg/L). */
export function addResidualError(conc_true: number, rng: Rng): number {
  const prop_noise = conc_true * GOTI_2018_RESIDUAL.proportional * rng.normal();
  const add_noise  = GOTI_2018_RESIDUAL.additive_mg_l * rng.normal();
  return Math.max(0.1, conc_true + prop_noise + add_noise);
}
