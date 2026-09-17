import { buildPriorParameters } from "./buildPriorParameters";
import { crclOnTotalBodyWeight } from "../renalEstimate";
import { normalizeObservations } from "./normalizeObservations";
import { fitPosteriorParameters, type PerLevelResidual } from "./fitPosteriorParameters";
import type {
  NormalizedPatient,
  NormalizedRegimen,
  NormalizedLevel,
  PosteriorFitDiagnostics,
} from "../types";

/**
 * Physiological non-renal vancomycin clearance, per 70 kg, on the same
 * allometry the model uses. An anuric adult still clears roughly 0.3-0.5 L/h by
 * non-renal routes, so a fitted clearance below this is not describing a
 * patient — it is Colin 2019's FSCR exponential extrapolating past its
 * covariate support at high creatinine. At SCr 6.0 the prior returns 0.106 L/h
 * for a 65 y / 80 kg adult whose true clearance is about 0.7 L/h, and the MAP
 * fit was then dragged to 0.493, halving a dose that was already correct.
 *
 * The published prior is deliberately NOT floored (see buildPriorParameters.ts:
 * doing so moved 1944/10800 grid points away from an independent Colin
 * re-implementation). Only the fitted individual estimate is bounded here, and
 * only when a fit actually succeeded.
 */
export const MIN_NONRENAL_CL_L_H_PER_70KG = 0.4;

/**
 * Vancomycin clearance rarely exceeds creatinine clearance — it runs about
 * 0.6-0.8x CrCl, and the highest ratio measured for a genuine augmented-
 * clearance patient during the 16 Sep audit was 1.15x. A fit landing above 2x
 * CrCl is far more likely to be a mis-drawn level than real physiology: a
 * single 1.0 mcg/mL trough (wrong lumen, drawn before the dose was hung, or a
 * mislabelled tube) raised the fit to 4.09x the patient's own CrCl and shipped
 * 4500 mg/day to a patient with a CrCl of 39 mL/min.
 */
export const MAX_CL_TO_CRCL_RATIO = 2.0;

export type PosteriorClBound = "floored_nonrenal" | "capped_renal";

function nonRenalFloorLH(weight_kg: number): number {
  return MIN_NONRENAL_CL_L_H_PER_70KG * Math.pow(Math.max(30, weight_kg) / 70, 0.75);
}

export interface PosteriorEngineInput {
  patient: NormalizedPatient;
  regimen: NormalizedRegimen;
  levels: NormalizedLevel[];
}

export interface PosteriorEngineResult {
  CL: number;
  V1: number;
  Q: number;
  V2: number;
  scr: number;
  success: boolean;
  diagnostics: PosteriorFitDiagnostics;
  model_name: "colin_2019" | "vancomyzer_obesity";
  ffm_kg?: number;
  /** Population-prior values used as the MAP starting point. Exposed so
   *  the API route can log prior↔posterior shifts to the audit log. */
  prior_CL: number;
  prior_V1: number;
  prior_Q: number;
  prior_V2: number;
  /** Observed-vs-posterior-predicted residuals per measured level. */
  per_level_residuals: PerLevelResidual[];
  /**
   * Set when the fitted clearance hit a physiological bound and was adjusted.
   * Surfaced so the result can say so — a silently altered clearance is exactly
   * the failure mode this bound exists to prevent.
   */
  posterior_cl_bound?: PosteriorClBound;
}

export function runPosteriorEngine(
  input: PosteriorEngineInput
): PosteriorEngineResult {
  const { patient, regimen, levels } = input;
  const prior = buildPriorParameters(patient, regimen);
  if (levels.length === 0) {
    return {
      CL: prior.CL,
      V1: prior.V1,
      Q: prior.Q,
      V2: prior.V2,
      scr: prior.scr,
      success: false,
      diagnostics: {
        observation_count: 0,
        fit_quality: "not_applicable",
        fit_quality_reason: "No measured levels were available for posterior fitting.",
        uncertainty_label: "population_only",
      },
      model_name: prior.model_name,
      ffm_kg: prior.ffm_kg,
      prior_CL: prior.CL,
      prior_V1: prior.V1,
      prior_Q: prior.Q,
      prior_V2: prior.V2,
      per_level_residuals: [],
    };
  }

  const { observations, context } = normalizeObservations(levels, regimen);
  const fit = fitPosteriorParameters({
    priorCL: prior.CL,
    priorV1: prior.V1,
    priorQ: prior.Q,
    priorV2: prior.V2,
    dose_mg: regimen.dose_mg,
    tau: context.tau,
    T_inf: context.T_inf,
    observations,
    doses_given: context.doses_given,
    // Between-subject-variability overrides, when a model supplies them.
    // Colin 2019 does not, so these are undefined for every shipped result.
    omega_CL: prior.omega_CL,
    omega_V1: prior.omega_V1,
    omega_Q: prior.omega_Q,
    omega_V2: prior.omega_V2,
  });

  if (!fit.success) {
    return {
      CL: prior.CL,
      V1: prior.V1,
      Q: prior.Q,
      V2: prior.V2,
      scr: prior.scr,
      success: false,
      diagnostics: fit.diagnostics,
      model_name: prior.model_name,
      ffm_kg: prior.ffm_kg,
      prior_CL: prior.CL,
      prior_V1: prior.V1,
      prior_Q: prior.Q,
      prior_V2: prior.V2,
      per_level_residuals: fit.per_level_residuals,
    };
  }

  // Bound the FITTED clearance to what is physiologically reachable. This runs
  // only on the success path: when the fit fails the outputs are the published
  // prior, and bounding those would floor the prior by the back door.
  const floorLH = nonRenalFloorLH(patient.weight_kg);
  const crclLH = crclOnTotalBodyWeight(patient) * 0.06; // mL/min -> L/h
  const ceilingLH = crclLH > 0 ? MAX_CL_TO_CRCL_RATIO * crclLH : Number.POSITIVE_INFINITY;

  let boundedCL = fit.CL_posterior;
  let posterior_cl_bound: PosteriorClBound | undefined;
  if (boundedCL < floorLH) {
    boundedCL = floorLH;
    posterior_cl_bound = "floored_nonrenal";
  } else if (boundedCL > ceilingLH) {
    boundedCL = ceilingLH;
    posterior_cl_bound = "capped_renal";
  }

  return {
    CL: boundedCL,
    posterior_cl_bound,
    V1: fit.V1_posterior,
    Q: fit.Q_posterior,
    V2: fit.V2_posterior,
    scr: prior.scr,
    success: true,
    diagnostics: fit.diagnostics,
    model_name: prior.model_name,
    ffm_kg: prior.ffm_kg,
    prior_CL: prior.CL,
    prior_V1: prior.V1,
    prior_Q: prior.Q,
    prior_V2: prior.V2,
    per_level_residuals: fit.per_level_residuals,
  };
}
