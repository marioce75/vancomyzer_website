/**
 * Predictive-performance harness: one developer-run synthetic analysis
 * (not real patients).
 *
 *   for each synthetic ICU patient:
 *     1. draw "true" PK parameters from the Goti 2018-based truth model
 *        (./goti2018; weight scaling and variability are developer choices)
 *     2. apply a fixed regimen (15 mg/kg q12h, 1.5 h infusion)
 *     3. simulate two steady-state levels in a dosing interval at steady
 *        state (reported to the engine as dose 5, i.e. steady state): 3.0 h after the start of the dose (1.5 h after the end of
 *        the infusion) and 11.5 h (0.5 h before the next dose)
 *     4. add residual error to both levels
 *     5. fit Vancomyzer's a posteriori engine (Colin 2019 prior) to those
 *        two noisy levels
 *     6. predict the concentration at a HELD-OUT time that was not used in
 *        the fit: 6.0 h after the start of the dose (mid-interval, 4.5 h
 *        after the end of the infusion), in the same steady-state interval
 *     7. compare that prediction with
 *          (a) a synthetic observation at the held-out time (truth plus
 *              residual error), and, separately,
 *          (b) the noise-free truth at the held-out time
 *
 * Scope of the endpoint: the held-out time lies between the two fitted
 * sample times in the same steady-state interval. It tests interpolation
 * within one interval. It is not a forecast after a dose change, before
 * steady state, or with changing physiology (none are simulated).
 *
 * History: before 2026-09-16 the "held-out" prediction was evaluated at the
 * same time as the fitted trough (11.5 h), so it was not held out. See the
 * page and scripts/verify-predictive-performance.ts.
 *
 * Reproducibility: the cohort, the truth parameters and the two fitted
 * levels are drawn from one seeded stream exactly as in earlier versions.
 * Residual error for the held-out observation comes from a second seeded
 * stream, so adding it did not change the fitted data.
 *
 * @safety-checked-via not-clinical: offline validation only. No production
 * code path imports from this module and it never emits a dose.
 */

import { runPosteriorEngine } from "@/lib/pk/posterior/posteriorEngine";
import { concentrationAtTime } from "@/lib/pk/steadyStateTwoCompartment";
import type { NormalizedLevel, NormalizedPatient, NormalizedRegimen } from "@/lib/pk/types";

import { makeRng, type Rng } from "./rng";
import { addResidualError, gotiIndividualParameters, type PkParameters } from "./goti2018";
import { CRCL_CAP_ML_MIN, sampleCohort, type SyntheticPatient } from "./syntheticIcuPopulation";
import type { PredictionPair } from "./metrics";

// ─── Fixed protocol parameters ──────────────────────────────────────────
/** Seed and cohort size used by the public page and the CLI script. */
export const PREDICTIVE_DEFAULT_SEED = 42;
export const PREDICTIVE_DEFAULT_N = 200;

const DOSE_MG_PER_KG = 15;
const INTERVAL_HR = 12;
const T_INF_HR = 1.5;
const DOSES_BEFORE_SAMPLING = 5; // truth is simulated at steady state
const PEAK_TIME_AFTER_INF_END_HR = 1.5; // fitted level 1
const TROUGH_BEFORE_NEXT_DOSE_HR = 0.5; // fitted level 2
const HELDOUT_TIME_AFTER_DOSE_START_HR = 6.0; // held-out level (not fitted)

/** Offset for the second seeded stream (held-out residual error only). */
const HELDOUT_NOISE_SEED_OFFSET = 0x9e3779b9;

/** Plain description of the protocol, shared by the page and the script. */
export const PREDICTIVE_DESIGN = {
  dose_mg_per_kg: DOSE_MG_PER_KG,
  dose_rounding: "rounded to the nearest 250 mg, limited to 500–3000 mg",
  interval_hours: INTERVAL_HR,
  infusion_hours: T_INF_HR,
  /** Levels are sampled in the dosing interval that starts with this dose. */
  sampled_dose_number: DOSES_BEFORE_SAMPLING,
  fitted_sample_times_hours: [T_INF_HR + PEAK_TIME_AFTER_INF_END_HR, INTERVAL_HR - TROUGH_BEFORE_NEXT_DOSE_HR] as const,
  heldout_sample_time_hours: HELDOUT_TIME_AFTER_DOSE_START_HR,
  heldout_hours_after_infusion_end: HELDOUT_TIME_AFTER_DOSE_START_HR - T_INF_HR,
} as const;

function roundDoseToNearest250mg(mg: number): number {
  return Math.max(500, Math.min(3000, Math.round(mg / 250) * 250));
}

export interface SimResult {
  patient: SyntheticPatient;
  truth: PkParameters;
  dose_mg: number;
  noisy_peak_mcg_ml: number;
  noisy_trough_mcg_ml: number;
  /** Noise-free truth at the held-out time. */
  true_heldout_mcg_ml: number;
  /** Truth plus residual error at the held-out time. Never given to the engine. */
  observed_heldout_mcg_ml: number;
  /** Vancomyzer posterior prediction at the held-out time. */
  predicted_heldout_mcg_ml: number;
  fit_succeeded: boolean;
  model_name: string;
}

/** Run ONE synthetic patient end-to-end through the harness. */
function runOnePatient(patient: SyntheticPatient, rng: Rng, heldoutNoiseRng: Rng): SimResult {
  // 1. True PK (Goti 2018-based truth model + between-subject variability)
  const truth = gotiIndividualParameters(
    { weight_kg: patient.weight_kg, crcl_ml_min: patient.crcl_ml_min },
    rng,
  );

  // 2. Regimen
  const dose_mg = roundDoseToNearest250mg(DOSE_MG_PER_KG * patient.weight_kg);
  const regimenInput = { CL: truth.CL, V1: truth.V1, Q: truth.Q, V2: truth.V2,
                         dose_mg, tau: INTERVAL_HR, T_inf: T_INF_HR };

  // 3+4. Simulate the two fitted levels and the held-out level at steady
  //   state. `concentrationAtTime` is a steady-state expression in time
  //   since the start of the current dose.
  const [t_peak, t_trough] = PREDICTIVE_DESIGN.fitted_sample_times_hours;
  const t_heldout = PREDICTIVE_DESIGN.heldout_sample_time_hours;

  const true_peak    = concentrationAtTime({ ...regimenInput, t: t_peak });
  const true_trough  = concentrationAtTime({ ...regimenInput, t: t_trough });
  const true_heldout = concentrationAtTime({ ...regimenInput, t: t_heldout });

  // Same draw order as earlier versions, so the fitted data are unchanged.
  const noisy_peak   = addResidualError(true_peak, rng);
  const noisy_trough = addResidualError(true_trough, rng);
  // Held-out observation: separate stream (see header).
  const observed_heldout = addResidualError(true_heldout, heldoutNoiseRng);

  // 5. Fit Vancomyzer's posterior engine to the two fitted levels only.
  const np: NormalizedPatient = {
    age: Math.round(patient.age_yr),
    weight_kg: Math.round(patient.weight_kg * 10) / 10,
    height_cm: Math.round(patient.height_cm),
    sex: patient.sex,
    serum_creatinine_mg_dl: Math.round(patient.scr_mg_dl * 100) / 100,
  };
  const nr: NormalizedRegimen = {
    dose_mg,
    interval_hours: INTERVAL_HR,
    infusion_duration_hours: T_INF_HR,
    doses_given: DOSES_BEFORE_SAMPLING,
  };
  const nls: NormalizedLevel[] = [
    {
      value_mcg_ml: noisy_peak,
      collection_time: "", // not used by the posterior fitter when time_since_last_dose is given
      time_since_last_dose_hours: t_peak,
    },
    {
      value_mcg_ml: noisy_trough,
      collection_time: "",
      time_since_last_dose_hours: t_trough,
    },
  ];

  const post = runPosteriorEngine({ patient: np, regimen: nr, levels: nls });

  // 6. Predict the held-out time from the posterior.
  const predicted_heldout = concentrationAtTime({
    CL: post.CL, V1: post.V1, Q: post.Q, V2: post.V2,
    dose_mg, tau: INTERVAL_HR, T_inf: T_INF_HR, t: t_heldout,
  });

  return {
    patient,
    truth,
    dose_mg,
    noisy_peak_mcg_ml: noisy_peak,
    noisy_trough_mcg_ml: noisy_trough,
    true_heldout_mcg_ml: true_heldout,
    observed_heldout_mcg_ml: observed_heldout,
    predicted_heldout_mcg_ml: predicted_heldout,
    fit_succeeded: post.success,
    model_name: post.model_name,
  };
}

export interface RunOptions {
  /** Seed for the PRNG. Default PREDICTIVE_DEFAULT_SEED. */
  seed?: number;
  /** Number of synthetic patients. Default PREDICTIVE_DEFAULT_N. */
  n?: number;
}

export interface CohortDescription {
  n_male: number;
  age_range: [number, number];
  weight_range_kg: [number, number];
  median_weight_kg: number;
  median_scr_mg_dl: number;
  /** Patients whose Cockcroft–Gault CrCl is above 130 mL/min (augmented renal clearance is not excluded). */
  n_crcl_above_130: number;
  /** Patients whose CrCl was capped at CRCL_CAP_ML_MIN. */
  n_crcl_at_cap: number;
  crcl_cap_ml_min: number;
  n_bmi_40_or_more: number;
}

export interface RunOutput {
  seed: number;
  n_attempted: number;
  n_fit_succeeded: number;
  /** Prediction vs synthetic observation (truth + residual error) at the held-out time. */
  pairs_vs_observation: PredictionPair[];
  /** Prediction vs noise-free truth at the held-out time. */
  pairs_vs_truth: PredictionPair[];
  per_patient: SimResult[];
  cohort: CohortDescription;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function describeCohort(cohort: SyntheticPatient[]): CohortDescription {
  const ages = cohort.map((p) => p.age_yr);
  const weights = cohort.map((p) => p.weight_kg);
  return {
    n_male: cohort.filter((p) => p.sex === "male").length,
    age_range: [Math.min(...ages), Math.max(...ages)],
    weight_range_kg: [Math.min(...weights), Math.max(...weights)],
    median_weight_kg: median(weights),
    median_scr_mg_dl: median(cohort.map((p) => p.scr_mg_dl)),
    n_crcl_above_130: cohort.filter((p) => p.crcl_ml_min > 130).length,
    n_crcl_at_cap: cohort.filter((p) => p.crcl_ml_min >= CRCL_CAP_ML_MIN).length,
    crcl_cap_ml_min: CRCL_CAP_ML_MIN,
    n_bmi_40_or_more: cohort.filter((p) => p.weight_kg / (p.height_cm / 100) ** 2 >= 40).length,
  };
}

export function runPredictiveValidation(opts: RunOptions = {}): RunOutput {
  const seed = opts.seed ?? PREDICTIVE_DEFAULT_SEED;
  const n    = opts.n    ?? PREDICTIVE_DEFAULT_N;
  const rng  = makeRng(seed);
  const heldoutNoiseRng = makeRng((seed + HELDOUT_NOISE_SEED_OFFSET) >>> 0);
  const cohort = sampleCohort(rng, n);

  const per_patient: SimResult[] = [];
  const pairs_vs_observation: PredictionPair[] = [];
  const pairs_vs_truth: PredictionPair[] = [];
  let n_fit_succeeded = 0;
  for (const patient of cohort) {
    const r = runOnePatient(patient, rng, heldoutNoiseRng);
    per_patient.push(r);
    if (r.fit_succeeded && Number.isFinite(r.predicted_heldout_mcg_ml) && r.true_heldout_mcg_ml > 0) {
      pairs_vs_observation.push({ predicted: r.predicted_heldout_mcg_ml, reference: r.observed_heldout_mcg_ml });
      pairs_vs_truth.push({ predicted: r.predicted_heldout_mcg_ml, reference: r.true_heldout_mcg_ml });
      n_fit_succeeded++;
    }
  }
  return {
    seed,
    n_attempted: cohort.length,
    n_fit_succeeded,
    pairs_vs_observation,
    pairs_vs_truth,
    per_patient,
    cohort: describeCohort(cohort),
  };
}
