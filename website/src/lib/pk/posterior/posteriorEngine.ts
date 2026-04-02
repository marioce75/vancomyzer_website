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
  CL: number;
  V1: number;
  Q: number;
  V2: number;
  scr: number;
  success: boolean;
  diagnostics: PosteriorFitDiagnostics;
  model_name: "colin_2019" | "vancomyzer_obesity";
  ffm_kg?: number;
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
    // Pass obesity omega overrides when applicable
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
    };
  }

  return {
    CL: fit.CL_posterior,
    V1: fit.V1_posterior,
    Q: fit.Q_posterior,
    V2: fit.V2_posterior,
    scr: prior.scr,
    success: true,
    diagnostics: fit.diagnostics,
    model_name: prior.model_name,
    ffm_kg: prior.ffm_kg,
  };
}
