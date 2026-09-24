import { buildPriorParameters } from "./buildPriorParameters";
import { crclOnTotalBodyWeight } from "../renalEstimate";
import { normalizeObservations } from "./normalizeObservations";
import { fitPosteriorParameters, objectiveComponents, summarizeDiagnostics, type FitPosteriorInput, type PerLevelResidual } from "./fitPosteriorParameters";
import {
  posteriorParameterUncertainty,
  priorParameterUncertainty,
  type ParameterUncertaintyResult,
} from "./parameterUncertainty";
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
  /**
   * Uncertainty in (CL, V1, Q, V2) for the plotted credible band: posterior
   * draws around the MAP optimum, the population prior when no fit was
   * used, or "unavailable" with a reason (parameterUncertainty.ts).
   */
  parameter_uncertainty: ParameterUncertaintyResult;
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
      parameter_uncertainty: priorParameterUncertainty(prior, {
        CL: prior.omega_CL, V1: prior.omega_V1, Q: prior.omega_Q, V2: prior.omega_V2,
      }),
    };
  }

  const { observations, context } = normalizeObservations(levels, regimen);
  const fitInput: FitPosteriorInput = {
    priorCL: prior.CL,
    priorV1: prior.V1,
    priorQ: prior.Q,
    priorV2: prior.V2,
    dose_mg: regimen.dose_mg,
    tau: context.tau,
    T_inf: context.T_inf,
    observations,
    doses_given: context.doses_given,
    horizon: context.horizon,
    // Between-subject-variability overrides, when a model supplies them.
    // Colin 2019 does not, so these are undefined for every shipped result.
    omega_CL: prior.omega_CL,
    omega_V1: prior.omega_V1,
    omega_Q: prior.omega_Q,
    omega_V2: prior.omega_V2,
  };
  const fit = fitPosteriorParameters(fitInput);

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
      // Outputs are the prior, so the band is the prior's.
      parameter_uncertainty: priorParameterUncertainty(prior, {
        CL: prior.omega_CL, V1: prior.omega_V1, Q: prior.omega_Q, V2: prior.omega_V2,
      }),
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

  // All downstream quality flags describe the parameter vector used for exposure.
  // Keep optimizer provenance explicitly separate from this post-fit policy bound.
  let diagnostics = fit.diagnostics;
  let residuals = fit.per_level_residuals;
  if (posterior_cl_bound) {
    const components = objectiveComponents(boundedCL, fit.V1_posterior, fit.Q_posterior, fit.V2_posterior, fitInput);
    diagnostics = {
      ...fit.diagnostics,
      ...summarizeDiagnostics(fitInput, boundedCL, fit.V1_posterior, fit.Q_posterior, fit.V2_posterior, true),
      pre_policy_bound: { posterior: fit.diagnostics.posterior!, objective: fit.diagnostics.objective! },
      parameter_basis: "final_after_clearance_policy",
      posterior: { CL: boundedCL, V1: fit.V1_posterior, Q: fit.Q_posterior, V2: fit.V2_posterior },
      objective: { nll_observations: components.nll_observations, prior_penalty: components.prior_penalty, total: components.total },
      predicted_at_observations: components.perObservation,
    };
    diagnostics.fit_quality_reason += " Diagnostics recomputed after the clearance policy bound; optimizer convergence refers to the pre-policy fit.";
    residuals = components.perObservation.map(x => ({ observed: x.observed, predicted: x.predicted, relative_error: Math.abs(x.residual) / x.observed }));
  }

  // The posterior band is built around the MAP optimum and its curvature. When
  // the plotted parameters are not that optimum (optimizer clamp, or the
  // clearance policy bound above) the band would describe a different point,
  // so none is drawn and the reason is reported instead.
  const clampHits = fit.diagnostics.boundary_hits ?? [];
  const parameter_uncertainty: ParameterUncertaintyResult = posterior_cl_bound
    ? {
        method: "unavailable",
        reason: "Clearance was adjusted to a physiological limit, so no reliable range can be estimated. Check the level's time and value.",
        detail: "Clearance was moved to a physiological bound after the fit, so the fit's uncertainty no longer describes the plotted parameters.",
      }
    : clampHits.length > 0
      ? {
          method: "unavailable",
          reason: "The fit reached a parameter limit, so no reliable range can be estimated. Check the level's time and value.",
          detail: `The fit reached a parameter limit (${clampHits.join(", ")}), so its uncertainty cannot be approximated at that point.`,
        }
      : posteriorParameterUncertainty({
          // Same normalisation fitPosteriorParameters applies before optimising.
          ...fitInput,
          T_inf: Math.min(Math.max(0, fitInput.T_inf), fitInput.tau || 1),
          observations: fitInput.observations.filter((obs) => obs.concentration > 0),
        }, {
          CL: fit.CL_posterior, V1: fit.V1_posterior, Q: fit.Q_posterior, V2: fit.V2_posterior,
        });

  return {
    parameter_uncertainty,
    CL: boundedCL,
    posterior_cl_bound,
    V1: fit.V1_posterior,
    Q: fit.Q_posterior,
    V2: fit.V2_posterior,
    scr: prior.scr,
    success: true,
    diagnostics,
    model_name: prior.model_name,
    ffm_kg: prior.ffm_kg,
    prior_CL: prior.CL,
    prior_V1: prior.V1,
    prior_Q: prior.Q,
    prior_V2: prior.V2,
    per_level_residuals: residuals,
  };
}
