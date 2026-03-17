/**
 * First-pass posterior engine: prior → normalize observations → fit → posterior params.
 * Bounded and transparent; does not claim high-certainty precision from sparse data.
 *
 * Prior model is explicit in code via ADULT_VANCOMYCIN_PRIOR_MODEL
 * (currently the Ducharme 1994 adult population prior).
 */

import { buildPriorParameters } from "./buildPriorParameters";
import { normalizeObservations } from "./normalizeObservations";
import { fitPosteriorParameters } from "./fitPosteriorParameters";
import type {
  NormalizedPatient,
  NormalizedRegimen,
  NormalizedLevel,
  PosteriorFitDiagnostics,
} from "../types";

export interface PosteriorEngineInput {
  patient: NormalizedPatient;
  regimen: NormalizedRegimen;
  levels: NormalizedLevel[];
}

export interface PosteriorEngineResult {
  Ke: number;
  V: number;
  crcl: number;
  success: boolean;
  diagnostics: PosteriorFitDiagnostics;
}

export function runPosteriorEngine(
  input: PosteriorEngineInput
): PosteriorEngineResult {
  const { patient, regimen, levels } = input;
  const prior = buildPriorParameters(patient, regimen);
  if (levels.length === 0) {
    return {
      Ke: prior.Ke,
      V: prior.V,
      crcl: prior.crcl,
      success: false,
      diagnostics: {
        observation_count: 0,
        fit_quality: "not_applicable",
        fit_quality_reason: "No measured levels were available for posterior fitting.",
        uncertainty_label: "population_only",
      },
    };
  }

  const { observations, context } = normalizeObservations(levels, regimen);
  const fit = fitPosteriorParameters({
    priorKe: prior.Ke,
    priorV: prior.V,
    dose_mg: regimen.dose_mg,
    tau: context.tau,
    T_inf: context.T_inf,
    observations,
  });

  if (!fit.success) {
    return {
      Ke: prior.Ke,
      V: prior.V,
      crcl: prior.crcl,
      success: false,
      diagnostics: fit.diagnostics,
    };
  }

  return {
    Ke: fit.Ke_posterior,
    V: fit.V_posterior,
    crcl: prior.crcl,
    success: true,
    diagnostics: fit.diagnostics,
  };
}
