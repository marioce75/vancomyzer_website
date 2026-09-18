import {
  concentrationAtTime,
  singleDoseConcentration,
  type TwoCompartmentParameters,
} from "../steadyStateTwoCompartment";
import type { PosteriorFitDiagnostics } from "../types";
import type { NormalizedObservation } from "./normalizeObservations";
import type { ExposureHorizon } from "../exposureHorizon";

/**
 * Error model (application-specific; not the published residual model):
 *   σ_i = max(1 mg/L, 0.15 × max(observed_i, predicted_i))
 * Objective (MAP, minimised in log-parameter space):
 *   Σ_i [ 0.5·((y_i − f_i)/σ_i)² + ln σ_i ]  +  Σ_p 0.5·((ln θ_p − ln θ_p,prior)/ω_p)²
 * with independent log-normal priors ω = (0.35, 0.25, 0.50, 0.50) for
 * (CL, V1, Q, V2). Because σ_i depends on the prediction, the ln σ term is part
 * of the objective (it is not a pure weighted least squares). No prior
 * covariance is modelled. These ω are NOT the Colin 2019 published IIV
 * (CV 27.9% / 27.3% / 97.9%); changing them is a documented model revision.
 */
export const ASSAY_SD_FLOOR_MCG_ML = 1.0;
export const ASSAY_CV = 0.15;

export const PRIOR_LOG_CL_SD = 0.35;
export const PRIOR_LOG_V1_SD = 0.25;
export const PRIOR_LOG_Q_SD = 0.5;
export const PRIOR_LOG_V2_SD = 0.5;

/** Two entries closer than this in time are treated as the same sampling event. */
export const DUPLICATE_SAMPLE_WINDOW_HOURS = 0.25;
/** Same-time entries whose values differ by more than this are discordant. */
export const DISCORDANT_SAMPLE_RELATIVE_DIFFERENCE = 0.2;

/** Nelder–Mead settings (documented so tolerance changes are deliberate). */
export const NM_MAX_ITERATIONS = 400;
export const NM_TOLERANCE = 1e-6;

export interface FitPosteriorInput {
  priorCL: number;
  priorV1: number;
  priorQ: number;
  priorV2: number;
  dose_mg: number;
  tau: number;
  T_inf: number;
  observations: NormalizedObservation[];
  /** Doses given so far (used by the actual-history and single-dose horizons). */
  doses_given?: number;
  /**
   * Exposure horizon decided once per request (exposureHorizon.ts). Under
   * "steady_state" the fit uses the τ-accumulation form; under
   * "actual_history"/"single_dose" it superposes exactly doses_given doses.
   * When omitted, falls back to the legacy dose-count rule (≥5 → steady state).
   */
  horizon?: ExposureHorizon;
  // Optional between-subject-variability overrides. No shipped model sets these
  // since the custom obesity branch was retired on 15 Sep 2026; kept so a future
  // model can widen or narrow the prior without changing this file.
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

/**
 * Predicted concentration for one observed level.
 *
 * Steady state — the tau-accumulation form, which presumes an infinite train of
 * preceding doses.
 *
 * Pre-steady-state — superposition of exactly the doses actually given:
 *   C(t) = sum over k = 0..N-1 of singleDoseConcentration(t + k*tau)
 * where t is the true time since the most recent dose. Using the steady-state
 * form here asked the optimizer to explain a level that has only accumulated
 * over N doses with a concentration built from infinitely many, and the only
 * way to fit that is to inflate clearance — which underestimated AUC24 by 22%
 * to 53% after dose 2 and drove dose increases in patients who were already
 * accumulating. Reading the true elapsed time also means a level drawn past the
 * interval is modelled as the extended trough it is rather than as an on-time
 * one. This is the same superposition curvePoints() draws, so the fit and the
 * plotted curve now share one definition of the concentration-time profile.
 */
function predictConcentration(
  params: TwoCompartmentParameters,
  input: FitPosteriorInput,
  observation: NormalizedObservation,
): number {
  const { dose_mg, tau, T_inf, doses_given } = input;
  const base = { ...params, dose_mg, tau, T_inf };
  const horizon: ExposureHorizon =
    input.horizon ?? (doses_given === undefined || doses_given >= 5 ? "steady_state" : "actual_history");

  if (horizon === "steady_state" || doses_given === undefined) {
    return concentrationAtTime({ ...base, t: observation.time_in_interval });
  }

  let total = 0;
  for (let k = 0; k < doses_given; k++) {
    total += singleDoseConcentration(base, observation.time_hours + k * tau);
  }
  return total;
}

function priorSds(input: FitPosteriorInput) {
  // Use between-subject-variability overrides if a model provided them.
  return {
    CL: input.omega_CL ?? PRIOR_LOG_CL_SD,
    V1: input.omega_V1 ?? PRIOR_LOG_V1_SD,
    Q:  input.omega_Q  ?? PRIOR_LOG_Q_SD,
    V2: input.omega_V2 ?? PRIOR_LOG_V2_SD,
  };
}

/** Objective and its components — exposed for verification. */
export function objectiveComponents(
  CL: number, V1: number, Q: number, V2: number,
  input: FitPosteriorInput,
) {
  const { observations, priorCL, priorV1, priorQ, priorV2 } = input;
  const sd = priorSds(input);
  let nll = 0;
  const perObservation = observations.map((observation) => {
    const { concentration } = observation;
    const predicted = predictConcentration({ CL, V1, Q, V2 }, input, observation);
    const sigma = observationSd(predicted, concentration);
    const residual = concentration - predicted;
    const z = residual / sigma;
    nll += 0.5 * z * z + Math.log(sigma);
    return { time_hours: observation.time_hours, observed: concentration, predicted, residual, sigma, z };
  });
  const prior_penalty = {
    CL: logPenalty(CL, priorCL, sd.CL),
    V1: logPenalty(V1, priorV1, sd.V1),
    Q: logPenalty(Q, priorQ, sd.Q),
    V2: logPenalty(V2, priorV2, sd.V2),
  };
  const total = nll + prior_penalty.CL + prior_penalty.V1 + prior_penalty.Q + prior_penalty.V2;
  return { nll_observations: nll, prior_penalty, total, perObservation };
}

function objective(
  CL: number, V1: number, Q: number, V2: number,
  input: FitPosteriorInput
): number {
  return objectiveComponents(CL, V1, Q, V2, input).total;
}

// Simple Nelder-Mead optimization for 4 parameters in log-space.
// Configurable initial step lets the multi-start wrapper try a wider simplex
// when the data demands a large posterior shift (extreme single-level cases).
function nelderMeadLogSpace(
  initValues: number[],
  input: FitPosteriorInput,
  maxIters = NM_MAX_ITERATIONS,
  tolerance = NM_TOLERANCE,
  initialStep = 0.5,
): { point: number[]; iterations: number; converged: boolean } {
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
  let iterations = 0;
  let converged = false;

  for (let iter = 0; iter < maxIters; iter++) {
    iterations = iter + 1;
    // Sort
    const indices = Array.from({ length: n + 1 }, (_, i) => i).sort((a, b) => scores[a] - scores[b]);
    simplex = indices.map(i => simplex[i]);
    scores = indices.map(i => scores[i]);

    if (scores[n] - scores[0] < tolerance) { converged = true; break; }

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

  // Final sort so the returned vertex is the best one even when we hit maxIters.
  const order = Array.from({ length: n + 1 }, (_, i) => i).sort((a, b) => scores[a] - scores[b]);
  return { point: simplex[order[0]].map(Math.exp), iterations, converged };
}

/**
 * Same-time entries: two observations within DUPLICATE_SAMPLE_WINDOW_HOURS of
 * each other. Two well-spaced samples (a peak and a trough) identify CL and V1;
 * two entries at the same time do not — they are either assay replicates of
 * one draw (then their disagreement is assay error) or a data-entry mistake.
 * Discordant same-time entries are reported so the caller can hold the
 * recommendation for reconciliation instead of fitting through the conflict.
 */
export function findObservationConflicts(observations: NormalizedObservation[]) {
  const conflicts: NonNullable<PosteriorFitDiagnostics["observation_conflicts"]> = [];
  for (let i = 0; i < observations.length; i++) {
    for (let j = i + 1; j < observations.length; j++) {
      const a = observations[i], b = observations[j];
      if (Math.abs(a.time_hours - b.time_hours) > DUPLICATE_SAMPLE_WINDOW_HOURS) continue;
      const hi = Math.max(a.concentration, b.concentration);
      const lo = Math.min(a.concentration, b.concentration);
      const rel = hi > 0 ? (hi - lo) / hi : 0;
      if (rel > DISCORDANT_SAMPLE_RELATIVE_DIFFERENCE) {
        conflicts.push({ index_a: i, index_b: j, time_hours: a.time_hours, values: [a.concentration, b.concentration], relative_difference: rel });
      }
    }
  }
  return conflicts;
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
  const { priorCL, priorV1, observations } = input;
  const residuals = observations.map((observation) => {
    const { concentration } = observation;
    const predicted = predictConcentration(
      { CL: posteriorCL, V1: posteriorV1, Q: posteriorQ, V2: posteriorV2 },
      input,
      observation,
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
  let bestStart = -1;
  let bestRun = { iterations: 0, converged: false };
  startingPoints.forEach((start, startIndex) => {
    const run = nelderMeadLogSpace(start, normalizedInput);
    const candidate = run.point;
    if (
      !Number.isFinite(candidate[0]) || !Number.isFinite(candidate[1])
      || !Number.isFinite(candidate[2]) || !Number.isFinite(candidate[3])
    ) return;
    const score = objective(candidate[0], candidate[1], candidate[2], candidate[3], normalizedInput);
    if (score < bestScore) {
      bestScore = score;
      bestPoint = candidate;
      bestStart = startIndex;
      bestRun = { iterations: run.iterations, converged: run.converged };
    }
  });

  const [bestCL, bestV1, bestQ, bestV2] = bestPoint;
  const success = Number.isFinite(bestCL) && Number.isFinite(bestV1) && Number.isFinite(bestQ) && Number.isFinite(bestV2)
    && Number.isFinite(bestScore);

  const finalCL = clamp(bestCL, priorCL * 0.1, priorCL * 10);
  const finalV1 = clamp(bestV1, priorV1 * 0.1, priorV1 * 10);
  const finalQ  = clamp(bestQ,  priorQ  * 0.1, priorQ  * 10);
  const finalV2 = clamp(bestV2, priorV2 * 0.1, priorV2 * 10);
  // A clamp changes the answer the optimiser found; say so rather than hide it.
  const boundary_hits: NonNullable<PosteriorFitDiagnostics["boundary_hits"]> = [];
  if (finalCL !== bestCL) boundary_hits.push("CL");
  if (finalV1 !== bestV1) boundary_hits.push("V1");
  if (finalQ !== bestQ) boundary_hits.push("Q");
  if (finalV2 !== bestV2) boundary_hits.push("V2");

  // Per-level residuals — observed vs posterior-predicted concentration at
  // the recorded time-in-interval. Surfaced so the API route can log fit
  // quality and the UI can warn the clinician when no fit explains the data.
  const per_level_residuals: PerLevelResidual[] = normalizedInput.observations.map(
    (observation) => {
      const { concentration } = observation;
      const predicted = predictConcentration(
        { CL: finalCL, V1: finalV1, Q: finalQ, V2: finalV2 },
        normalizedInput,
        observation,
      );
      const relative_error = concentration > 0 ? Math.abs(predicted - concentration) / concentration : 0;
      return { observed: concentration, predicted, relative_error };
    },
  );

  const summary = summarizeDiagnostics(normalizedInput, bestCL, bestV1, bestQ, bestV2, success);
  const components = objectiveComponents(finalCL, finalV1, finalQ, finalV2, normalizedInput);
  const conflicts = findObservationConflicts(normalizedInput.observations);
  const sd = priorSds(normalizedInput);
  const diagnostics: PosteriorFitDiagnostics = {
    ...summary,
    horizon: normalizedInput.horizon
      ?? (normalizedInput.doses_given === undefined || normalizedInput.doses_given >= 5 ? "steady_state" : "actual_history"),
    prior: { CL: priorCL, V1: priorV1, Q: priorQ, V2: priorV2 },
    posterior: { CL: finalCL, V1: finalV1, Q: finalQ, V2: finalV2 },
    prior_log_sd: sd,
    error_model: `sigma = max(${ASSAY_SD_FLOOR_MCG_ML} mg/L, ${ASSAY_CV} x max(observed, predicted)); Gaussian NLL incl. ln(sigma)`,
    objective: { nll_observations: components.nll_observations, prior_penalty: components.prior_penalty, total: components.total },
    predicted_at_observations: components.perObservation,
    convergence: {
      method: "Nelder-Mead in log-parameter space, multi-start",
      starts: startingPoints.length,
      best_start_index: bestStart,
      iterations: bestRun.iterations,
      converged: bestRun.converged,
      tolerance: NM_TOLERANCE,
    },
    boundary_hits,
    observation_conflicts: conflicts,
  };

  return {
    CL_posterior: finalCL,
    V1_posterior: finalV1,
    Q_posterior: finalQ,
    V2_posterior: finalV2,
    success,
    diagnostics,
    per_level_residuals,
  };
}
