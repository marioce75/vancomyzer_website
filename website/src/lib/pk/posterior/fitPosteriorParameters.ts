import { concentrationAtTime } from "../steadyStateTwoCompartment";
import type { PosteriorFitDiagnostics } from "../types";
import type { NormalizedObservation } from "./normalizeObservations";

const ASSAY_SD_FLOOR_MCG_ML = 1.0;
const ASSAY_CV = 0.15;

const PRIOR_LOG_CL_SD = 0.35;
const PRIOR_LOG_V1_SD = 0.25;
const PRIOR_LOG_Q_SD = 0.5;
const PRIOR_LOG_V2_SD = 0.5;

export interface FitPosteriorInput {
  priorCL: number;
  priorV1: number;
  priorQ: number;
  priorV2: number;
  dose_mg: number;
  tau: number;
  T_inf: number;
  observations: NormalizedObservation[];
  // Optional omega overrides — used by obesity model (Smit 2020 IIV values)
  omega_CL?: number;
  omega_V1?: number;
  omega_Q?: number;
  omega_V2?: number;
}

export interface PerLevelResidual {
  observed: number;
  predicted: number;
  relative_error: number;
}

export interface FitPosteriorResult {
  CL_posterior: number;
  V1_posterior: number;
  Q_posterior: number;
  V2_posterior: number;
  success: boolean;
  diagnostics: PosteriorFitDiagnostics;
  per_level_residuals: PerLevelResidual[];
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

function objective(
  CL: number, V1: number, Q: number, V2: number,
  input: FitPosteriorInput
): number {
  const { dose_mg, tau, T_inf, observations, priorCL, priorV1, priorQ, priorV2 } = input;

  // Use omega overrides if provided (e.g., Smit 2020 IIV for obesity model)
  const sdCL = input.omega_CL ?? PRIOR_LOG_CL_SD;
  const sdV1 = input.omega_V1 ?? PRIOR_LOG_V1_SD;
  const sdQ  = input.omega_Q  ?? PRIOR_LOG_Q_SD;
  const sdV2 = input.omega_V2 ?? PRIOR_LOG_V2_SD;

  let nll = 0;
  for (const { time_in_interval, concentration } of observations) {
    const predicted = concentrationAtTime({
      CL, V1, Q, V2, dose_mg, tau, T_inf, t: time_in_interval
    });
    const sd = observationSd(predicted, concentration);
    const residual = concentration - predicted;
    nll += 0.5 * (residual / sd) ** 2 + Math.log(sd);
  }

  return (
    nll +
    logPenalty(CL, priorCL, sdCL) +
    logPenalty(V1, priorV1, sdV1) +
    logPenalty(Q, priorQ, sdQ) +
    logPenalty(V2, priorV2, sdV2)
  );
}

// Simple Nelder-Mead optimization for 4 parameters in log-space.
// Configurable initial step lets the multi-start wrapper try a wider simplex
// when the data demands a large posterior shift (extreme single-level cases).
function nelderMeadLogSpace(
  initValues: number[],
  input: FitPosteriorInput,
  maxIters = 200,
  tolerance = 1e-4,
  initialStep = 0.5,
): number[] {
  const n = initValues.length;
  // Initialize simplex
  let simplex = [initValues.map(Math.log)];
  for (let i = 0; i < n; i++) {
    const pt = [...simplex[0]];
    pt[i] += initialStep;
    simplex.push(pt);
  }

  const evalPt = (pt: number[]) => {
    return objective(
      Math.exp(pt[0]), Math.exp(pt[1]), Math.exp(pt[2]), Math.exp(pt[3]),
      input
    );
  };

  let scores = simplex.map(evalPt);

  for (let iter = 0; iter < maxIters; iter++) {
    // Sort
    const indices = Array.from({ length: n + 1 }, (_, i) => i).sort((a, b) => scores[a] - scores[b]);
    simplex = indices.map(i => simplex[i]);
    scores = indices.map(i => scores[i]);

    if (scores[n] - scores[0] < tolerance) break;

    // Centroid of the best n points
    const centroid = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        centroid[j] += simplex[i][j] / n;
      }
    }

    // Reflection
    const reflected = centroid.map((c, j) => c + 1.0 * (c - simplex[n][j]));
    const scoreReflected = evalPt(reflected);

    if (scoreReflected >= scores[0] && scoreReflected < scores[n - 1]) {
      simplex[n] = reflected;
      scores[n] = scoreReflected;
      continue;
    }

    // Expansion
    if (scoreReflected < scores[0]) {
      const expanded = centroid.map((c, j) => c + 2.0 * (reflected[j] - c));
      const scoreExpanded = evalPt(expanded);
      if (scoreExpanded < scoreReflected) {
        simplex[n] = expanded;
        scores[n] = scoreExpanded;
      } else {
        simplex[n] = reflected;
        scores[n] = scoreReflected;
      }
      continue;
    }

    // Contraction
    if (scoreReflected < scores[n]) {
      const contracted = centroid.map((c, j) => c + 0.5 * (reflected[j] - c));
      const scoreContracted = evalPt(contracted);
      if (scoreContracted < scoreReflected) {
        simplex[n] = contracted;
        scores[n] = scoreContracted;
        continue;
      }
    } else {
      const contracted = centroid.map((c, j) => c + 0.5 * (simplex[n][j] - c));
      const scoreContracted = evalPt(contracted);
      if (scoreContracted < scores[n]) {
        simplex[n] = contracted;
        scores[n] = scoreContracted;
        continue;
      }
    }

    // Shrink
    for (let i = 1; i <= n; i++) {
      simplex[i] = simplex[i].map((val, j) => simplex[0][j] + 0.5 * (val - simplex[0][j]));
      scores[i] = evalPt(simplex[i]);
    }
  }

  return simplex[0].map(Math.exp);
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
  posteriorCL: number,
  posteriorV1: number,
  posteriorQ: number,
  posteriorV2: number,
  success: boolean
): PosteriorFitDiagnostics {
  const { priorCL, priorV1, dose_mg, tau, T_inf, observations } = input;
  const residuals = observations.map(({ time_in_interval, concentration }) => {
    const predicted = concentrationAtTime({
      CL: posteriorCL, V1: posteriorV1, Q: posteriorQ, V2: posteriorV2,
      dose_mg, tau, T_inf, t: time_in_interval
    });
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
  
  // To keep it simple, we just report shifts for CL and V1 as they are primary
  const posteriorShiftCLPct = Math.abs(((posteriorCL - priorCL) / Math.max(priorCL, 1e-6)) * 100);
  const posteriorShiftV1Pct = Math.abs(((posteriorV1 - priorV1) / Math.max(priorV1, 1e-6)) * 100);

  let fit_quality: PosteriorFitDiagnostics["fit_quality"] = "weak";
  let uncertainty_label: PosteriorFitDiagnostics["uncertainty_label"] = "high";

  if (
    observation_count >= 2 &&
    rmsError <= 2 &&
    meanRelativeError <= 0.2 &&
    posteriorShiftCLPct <= 35 &&
    posteriorShiftV1Pct <= 35
  ) {
    fit_quality = "moderate";
    uncertainty_label = "moderate";
  }

  const reasonParts = [
    `${observation_count} level${observation_count === 1 ? "" : "s"} informed the bounded posterior MAP fit`,
    `RMS error ${rmsError.toFixed(1)} mcg/mL`,
    `mean absolute error ${meanAbsError.toFixed(1)} mcg/mL`,
    `mean relative error ${(meanRelativeError * 100).toFixed(0)}%`,
    `CL shift ${posteriorShiftCLPct.toFixed(0)}%`,
    `V1 shift ${posteriorShiftV1Pct.toFixed(0)}%`,
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
    posterior_shift_cl_pct: Math.round(posteriorShiftCLPct * 10) / 10,
    posterior_shift_v1_pct: Math.round(posteriorShiftV1Pct * 10) / 10,
    uncertainty_label,
  };
}

export function fitPosteriorParameters(
  input: FitPosteriorInput
): FitPosteriorResult {
  const { priorCL, priorV1, priorQ, priorV2, dose_mg, tau, T_inf, observations } = input;
  if (
    observations.length === 0 ||
    priorCL <= 0 || priorV1 <= 0 || priorQ <= 0 || priorV2 <= 0 ||
    dose_mg <= 0 || tau <= 0
  ) {
    return {
      CL_posterior: priorCL,
      V1_posterior: priorV1,
      Q_posterior: priorQ,
      V2_posterior: priorV2,
      success: false,
      diagnostics: buildDefaultDiagnostics(
        observations.length,
        "prior_only",
        "Posterior fitting inputs were insufficient, so outputs remained on the population prior.",
        "population_only"
      ),
      per_level_residuals: [],
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
      CL_posterior: priorCL,
      V1_posterior: priorV1,
      Q_posterior: priorQ,
      V2_posterior: priorV2,
      success: false,
      diagnostics: buildDefaultDiagnostics(
        0,
        "prior_only",
        "No positive measured levels were available for posterior fitting.",
        "population_only"
      ),
      per_level_residuals: [],
    };
  }

  // Multi-start MAP optimization. A single Nelder-Mead run from the prior
  // converges to local minima on extreme single-level cases (very small Vd,
  // augmented or impaired clearance). Try several spread starting points
  // and keep the lowest-objective result. The optimizer is cheap, so a few
  // restarts cost milliseconds and substantially expand the basin reached.
  const startingPoints: Array<[number, number, number, number]> = [
    [priorCL, priorV1, priorQ, priorV2],            // prior — covers typical cases
    [priorCL * 0.4, priorV1 * 0.5, priorQ, priorV2], // small Vd / low CL — covers Mario's scenario
    [priorCL * 2.5, priorV1 * 1.5, priorQ, priorV2], // augmented clearance / large Vd
    [priorCL * 0.4, priorV1, priorQ, priorV2],       // CL-only suppression
    [priorCL, priorV1 * 0.5, priorQ, priorV2],       // V1-only contraction
  ];

  let bestPoint: number[] = [priorCL, priorV1, priorQ, priorV2];
  let bestScore = Infinity;
  for (const start of startingPoints) {
    const candidate = nelderMeadLogSpace(start, normalizedInput);
    if (
      !Number.isFinite(candidate[0]) || !Number.isFinite(candidate[1])
      || !Number.isFinite(candidate[2]) || !Number.isFinite(candidate[3])
    ) continue;
    const score = objective(candidate[0], candidate[1], candidate[2], candidate[3], normalizedInput);
    if (score < bestScore) {
      bestScore = score;
      bestPoint = candidate;
    }
  }

  const [bestCL, bestV1, bestQ, bestV2] = bestPoint;
  const success = Number.isFinite(bestCL) && Number.isFinite(bestV1) && Number.isFinite(bestQ) && Number.isFinite(bestV2)
    && Number.isFinite(bestScore);

  const finalCL = clamp(bestCL, priorCL * 0.1, priorCL * 10);
  const finalV1 = clamp(bestV1, priorV1 * 0.1, priorV1 * 10);
  const finalQ  = clamp(bestQ,  priorQ  * 0.1, priorQ  * 10);
  const finalV2 = clamp(bestV2, priorV2 * 0.1, priorV2 * 10);

  // Per-level residuals — observed vs posterior-predicted concentration at
  // the recorded time-in-interval. Surfaced so the API route can log fit
  // quality and the UI can warn the clinician when no fit explains the data.
  const per_level_residuals: PerLevelResidual[] = normalizedInput.observations.map(
    ({ time_in_interval, concentration }) => {
      const predicted = concentrationAtTime({
        CL: finalCL, V1: finalV1, Q: finalQ, V2: finalV2,
        dose_mg, tau, T_inf: T_infClamped, t: time_in_interval,
      });
      const relative_error = concentration > 0 ? Math.abs(predicted - concentration) / concentration : 0;
      return { observed: concentration, predicted, relative_error };
    },
  );

  return {
    CL_posterior: finalCL,
    V1_posterior: finalV1,
    Q_posterior: finalQ,
    V2_posterior: finalV2,
    success,
    diagnostics: summarizeDiagnostics(
      normalizedInput, bestCL, bestV1, bestQ, bestV2, success
    ),
    per_level_residuals,
  };
}
