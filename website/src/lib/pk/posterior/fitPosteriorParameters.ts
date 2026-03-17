/**
 * Bounded first-pass posterior parameter fitting.
 * Uses the shared one-compartment steady-state model for coherence.
 *
 * This pass implements a transparent MAP-style fit over Ke and V:
 * - likelihood term from observed concentrations
 * - weak quadratic priors centered on the population parameters
 *
 * It remains intentionally bounded and conservative rather than claiming
 * commercial-grade Bayesian precision from sparse data.
 */

import { steadyStateConcentration } from "../steadyStateOneCompartment";
import type { PosteriorFitDiagnostics } from "../types";
import type { NormalizedObservation } from "./normalizeObservations";

const KE_MIN = 0.002;
const KE_MAX = 0.2;
const V_SCALE_MIN = 0.5;
const V_SCALE_MAX = 1.5;
const COARSE_KE_STEPS = 60;
const COARSE_V_STEPS = 40;
const REFINE_KE_STEPS = 40;
const REFINE_V_STEPS = 30;

/**
 * Observation error model: proportional SD with a floor.
 * Keeps the fit from overreacting to sparse low concentrations.
 */
const ASSAY_SD_FLOOR_MCG_ML = 1.0;
const ASSAY_CV = 0.15;

/**
 * Prior spread is intentionally broad because this is a bounded first-pass fitter,
 * not a tightly informed population Bayesian engine.
 */
const PRIOR_LOG_KE_SD = 0.35;
const PRIOR_LOG_V_SD = 0.25;

export interface FitPosteriorInput {
  priorKe: number;
  priorV: number;
  dose_mg: number;
  tau: number;
  T_inf: number;
  observations: NormalizedObservation[];
}

export interface FitPosteriorResult {
  Ke_posterior: number;
  V_posterior: number;
  success: boolean;
  diagnostics: PosteriorFitDiagnostics;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function logPenalty(value: number, prior: number, sd: number): number {
  if (value <= 0 || prior <= 0 || sd <= 0) return Infinity;
  const z = (Math.log(value) - Math.log(prior)) / sd;
  return 0.5 * z * z;
}

function observationSd(predicted: number, observed: number): number {
  const anchor = Math.max(predicted, observed, 0);
  return Math.max(ASSAY_SD_FLOOR_MCG_ML, ASSAY_CV * anchor);
}

function objective(Ke: number, V: number, input: FitPosteriorInput): number {
  const { dose_mg, tau, T_inf, observations, priorKe, priorV } = input;

  let nll = 0;
  for (const { time_in_interval, concentration } of observations) {
    const predicted = steadyStateConcentration(
      time_in_interval,
      Ke,
      V,
      dose_mg,
      tau,
      T_inf
    );
    const sd = observationSd(predicted, concentration);
    const residual = concentration - predicted;
    nll += 0.5 * (residual / sd) ** 2 + Math.log(sd);
  }

  return (
    nll +
    logPenalty(Ke, priorKe, PRIOR_LOG_KE_SD) +
    logPenalty(V, priorV, PRIOR_LOG_V_SD)
  );
}

function gridSearch(
  keLow: number,
  keHigh: number,
  keSteps: number,
  vLow: number,
  vHigh: number,
  vSteps: number,
  input: FitPosteriorInput
): { Ke: number; V: number; score: number } {
  let bestKe = input.priorKe;
  let bestV = input.priorV;
  let bestScore = Infinity;

  for (let i = 0; i <= keSteps; i++) {
    const Ke = keLow + (i / keSteps) * (keHigh - keLow);
    for (let j = 0; j <= vSteps; j++) {
      const V = vLow + (j / vSteps) * (vHigh - vLow);
      const score = objective(Ke, V, input);
      if (score < bestScore) {
        bestScore = score;
        bestKe = Ke;
        bestV = V;
      }
    }
  }

  return { Ke: bestKe, V: bestV, score: bestScore };
}

function buildDefaultDiagnostics(
  observation_count: number,
  fit_quality: PosteriorFitDiagnostics["fit_quality"],
  fit_quality_reason: string,
  uncertainty_label: PosteriorFitDiagnostics["uncertainty_label"]
): PosteriorFitDiagnostics {
  return {
    observation_count,
    fit_quality,
    fit_quality_reason,
    uncertainty_label,
  };
}

function summarizeDiagnostics(
  input: FitPosteriorInput,
  posteriorKe: number,
  posteriorV: number,
  success: boolean
): PosteriorFitDiagnostics {
  const { priorKe, priorV, dose_mg, tau, T_inf, observations } = input;
  const residuals = observations.map(({ time_in_interval, concentration }) => {
    const predicted = steadyStateConcentration(
      time_in_interval,
      posteriorKe,
      posteriorV,
      dose_mg,
      tau,
      T_inf
    );
    const absError = Math.abs(concentration - predicted);
    const relativeError = concentration > 0 ? absError / concentration : 0;
    return { predicted, concentration, absError, relativeError };
  });

  if (!success || residuals.length === 0) {
    return buildDefaultDiagnostics(
      residuals.length,
      "prior_only",
      residuals.length === 0
        ? "No positive measured levels were available for bounded posterior fitting."
        : "Bounded posterior fitting did not produce a stable finite solution; outputs remained on the population prior.",
      "population_only"
    );
  }

  const observation_count = residuals.length;
  const meanAbsError =
    residuals.reduce((sum, item) => sum + item.absError, 0) / observation_count;
  const rmsError = Math.sqrt(
    residuals.reduce((sum, item) => sum + item.absError ** 2, 0) / observation_count
  );
  const maxAbsError = Math.max(...residuals.map((item) => item.absError));
  const meanRelativeError =
    residuals.reduce((sum, item) => sum + item.relativeError, 0) / observation_count;
  const posteriorShiftKePct = Math.abs(((posteriorKe - priorKe) / Math.max(priorKe, 1e-6)) * 100);
  const posteriorShiftVPct = Math.abs(((posteriorV - priorV) / Math.max(priorV, 1e-6)) * 100);

  let fit_quality: PosteriorFitDiagnostics["fit_quality"] = "weak";
  let uncertainty_label: PosteriorFitDiagnostics["uncertainty_label"] = "high";

  if (
    observation_count >= 2 &&
    rmsError <= 2 &&
    meanRelativeError <= 0.2 &&
    posteriorShiftKePct <= 35 &&
    posteriorShiftVPct <= 35
  ) {
    fit_quality = "moderate";
    uncertainty_label = "moderate";
  }

  const reasonParts = [
    `${observation_count} level${observation_count === 1 ? "" : "s"} informed the bounded posterior fit`,
    `RMS error ${rmsError.toFixed(1)} mcg/mL`,
    `mean absolute error ${meanAbsError.toFixed(1)} mcg/mL`,
    `mean relative error ${(meanRelativeError * 100).toFixed(0)}%`,
    `Ke shift ${posteriorShiftKePct.toFixed(0)}%`,
    `V shift ${posteriorShiftVPct.toFixed(0)}%`,
  ];

  if (observation_count === 1) {
    reasonParts.push("single-level fits remain highly uncertain even when bounded");
  }

  return {
    observation_count,
    fit_quality,
    fit_quality_reason: reasonParts.join("; ") + ".",
    rms_error_mcg_ml: Math.round(rmsError * 10) / 10,
    mean_abs_error_mcg_ml: Math.round(meanAbsError * 10) / 10,
    max_abs_error_mcg_ml: Math.round(maxAbsError * 10) / 10,
    mean_relative_error: Math.round(meanRelativeError * 1000) / 1000,
    posterior_shift_ke_pct: Math.round(posteriorShiftKePct * 10) / 10,
    posterior_shift_v_pct: Math.round(posteriorShiftVPct * 10) / 10,
    uncertainty_label,
  };
}

export function fitPosteriorParameters(
  input: FitPosteriorInput
): FitPosteriorResult {
  const { priorKe, priorV, dose_mg, tau, T_inf, observations } = input;
  if (
    observations.length === 0 ||
    priorKe <= 0 ||
    priorV <= 0 ||
    dose_mg <= 0 ||
    tau <= 0
  ) {
    return {
      Ke_posterior: priorKe,
      V_posterior: priorV,
      success: false,
      diagnostics: buildDefaultDiagnostics(
        observations.length,
        "prior_only",
        "Posterior fitting inputs were insufficient, so outputs remained on the population prior.",
        "population_only"
      ),
    };
  }

  const T_infClamped = Math.min(Math.max(0, T_inf), tau || 1);
  const normalizedInput: FitPosteriorInput = {
    ...input,
    T_inf: T_infClamped,
    observations: observations.filter((obs) => obs.concentration > 0),
  };

  if (normalizedInput.observations.length === 0) {
    return {
      Ke_posterior: priorKe,
      V_posterior: priorV,
      success: false,
      diagnostics: buildDefaultDiagnostics(
        0,
        "prior_only",
        "No positive measured levels were available for posterior fitting.",
        "population_only"
      ),
    };
  }

  const coarse = gridSearch(
    KE_MIN,
    KE_MAX,
    COARSE_KE_STEPS,
    priorV * V_SCALE_MIN,
    priorV * V_SCALE_MAX,
    COARSE_V_STEPS,
    normalizedInput
  );

  const refined = gridSearch(
    clamp(coarse.Ke * 0.7, KE_MIN, KE_MAX),
    clamp(coarse.Ke * 1.3, KE_MIN, KE_MAX),
    REFINE_KE_STEPS,
    clamp(coarse.V * 0.8, priorV * V_SCALE_MIN, priorV * V_SCALE_MAX),
    clamp(coarse.V * 1.2, priorV * V_SCALE_MIN, priorV * V_SCALE_MAX),
    REFINE_V_STEPS,
    normalizedInput
  );

  const Ke_posterior = clamp(refined.Ke, KE_MIN, KE_MAX);
  const V_posterior = clamp(refined.V, priorV * V_SCALE_MIN, priorV * V_SCALE_MAX);
  const success = Number.isFinite(refined.score);

  return {
    Ke_posterior,
    V_posterior,
    success,
    diagnostics: summarizeDiagnostics(normalizedInput, Ke_posterior, V_posterior, success),
  };
}
