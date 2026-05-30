/**
 * Goti 2018 vancomycin population PK model — used as the GROUND-TRUTH
 * generator for the predictive-performance harness.
 *
 * Source: Goti V, Chaturvedula A, Fossler MJ et al. "Hospitalized
 * Patients With and Without Hemodialysis Have Markedly Different
 * Vancomycin Pharmacokinetics: A Population Pharmacokinetic Model-Based
 * Analysis." Ther Drug Monit. 2018;40(2):212–221.
 * DOI: 10.1097/FTD.0000000000000490
 *
 * Why Goti as the truth generator:
 *   1. Largest published popPK derivation set (n=1812) outside of Colin
 *   2. US ICU/hospitalized population — different prior distribution
 *      from Colin 2019's pooled multi-source cohort (n=2554)
 *   3. Independent peer-reviewed implementation in PrecisePK — and was
 *      the worst-performing prior in Bai et al 2025 (rRMSE up to 68.59%
 *      a priori), so it stresses a Colin-prior fitter realistically
 *   4. CrCl as the dominant covariate (not the SCr-only path Colin uses)
 *      — guarantees the prior–truth mismatch is structural, not just
 *      parametric noise
 *
 * Structural form (non-hemodialysis branch; HD patients are out of
 * scope for Vancomyzer):
 *
 *     CL (L/h) = θCL × (CrCl_mL_min / 120)^0.8 × (WT_kg / 70)^0.75
 *     V1 (L)   = θV1 × (WT_kg / 70)
 *     Q  (L/h) = θQ  × (WT_kg / 70)^0.75
 *     V2 (L)   = θV2 × (WT_kg / 70)
 *
 *     θCL = 4.5, θV1 = 58.4, θQ = 6.5, θV2 = 38.4
 *
 * Allometric exponents (0.75 for clearances, 1.0 for volumes) follow
 * standard pharmacometric practice and match the Goti structural form
 * as transcribed in third-party reviews (DoseMeRx model documentation,
 * Uster 2021 systematic evaluation).
 *
 * Between-subject variability (exponential model, log-normal random
 * effects): omega values are set to literature-typical adult vancomycin
 * BSV ranges since the raw OMEGA matrix isn't openly published. These
 * are documented on the public page so reviewers can sanity-check them.
 *
 *     omega_CL = 0.40   (40% CV)
 *     omega_V1 = 0.30   (30% CV)
 *     omega_Q  = 0.50   (50% CV)
 *     omega_V2 = 0.40   (40% CV)
 *
 * Residual error (combined proportional + additive):
 *     prop_err = 0.20   (20% CV)
 *     add_err  = 1.0    (1.0 mg/L SD)
 *
 * @safety-checked-via not-clinical — this module never emits a dose. It
 * only generates synthetic ground-truth concentrations for off-line
 * validation. No production code path imports from this file.
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

/** Add Goti-style combined proportional + additive residual error to a concentration. */
export function addResidualError(conc_true: number, rng: Rng): number {
  const prop_noise = conc_true * GOTI_2018_RESIDUAL.proportional * rng.normal();
  const add_noise  = GOTI_2018_RESIDUAL.additive_mg_l * rng.normal();
  return Math.max(0.1, conc_true + prop_noise + add_noise);
}
