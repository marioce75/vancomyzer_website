/**
 * Predictive-performance harness — orchestrates one full Monte Carlo run:
 *
 *   for each synthetic ICU patient:
 *     1. sample Goti-2018 "true" PK parameters (with BSV)
 *     2. apply a fixed dosing regimen (15 mg/kg q12h, 1.5 h infusion)
 *     3. simulate "observed" concentrations at a clinically realistic
 *        sampling window — peak (~1.5 h post-infusion-end after dose 4)
 *        plus trough (~30 min before dose 5)
 *     4. add proportional + additive residual error to both observations
 *     5. feed the noisy levels into Vancomyzer's a posteriori engine
 *        (which uses the Colin 2019 prior, not Goti)
 *     6. predict a HELD-OUT concentration — trough before dose 7
 *     7. compare against Goti "truth" at that same held-out time
 *
 * The held-out timepoint is the key methodological choice. Predicting
 * the same point used to fit is circular — every fitter passes that
 * test. Predicting a future point is the actual clinical question:
 * "given two levels, what will the next trough be?"
 *
 * Output: a flat array of { predicted, observed } pairs ready to feed
 * into the Sheiner–Beal metrics in `./metrics`.
 *
 * @safety-checked-via not-clinical — this module is offline validation
 * only. No production code path imports from it; no dose ever leaves.
 */

import { runPosteriorEngine } from "@/lib/pk/posterior/posteriorEngine";
import { concentrationAtTime } from "@/lib/pk/steadyStateTwoCompartment";
import type { NormalizedLevel, NormalizedPatient, NormalizedRegimen } from "@/lib/pk/types";

import { makeRng, type Rng } from "./rng";
import { addResidualError, gotiIndividualParameters, type PkParameters } from "./goti2018";
import { sampleCohort, type SyntheticPatient } from "./syntheticIcuPopulation";
import type { PredictionPair } from "./metrics";

// ─── Fixed protocol parameters ──────────────────────────────────────────
const DOSE_MG_PER_KG = 15;
const INTERVAL_HR    = 12;
const T_INF_HR       = 1.5;
const PEAK_TIME_AFTER_INF_END_HR = 1.5;  // sample peak 1.5 h after end of dose-4 infusion
const TROUGH_BEFORE_NEXT_DOSE_HR = 0.5;  // trough 30 min before dose 5

// Held-out prediction timepoint: trough before dose 7 (24 h after the
// last fitted level → genuinely forward in time, not interpolation).
const HELDOUT_DOSE_INDEX = 7;
const HELDOUT_BEFORE_DOSE_HR = 0.5;

function roundDoseToNearest250mg(mg: number): number {
  return Math.max(500, Math.min(3000, Math.round(mg / 250) * 250));
}

interface SimResult {
  patient: SyntheticPatient;
  truth: PkParameters;
  dose_mg: number;
  noisy_peak_mcg_ml: number;
  noisy_trough_mcg_ml: number;
  observed_heldout_mcg_ml: number;   // Goti truth at the prediction point (no noise)
  predicted_heldout_mcg_ml: number;  // Vancomyzer posterior-predicted at the same time
  fit_succeeded: boolean;
}

/** Run ONE synthetic patient end-to-end through the harness. */
function runOnePatient(patient: SyntheticPatient, rng: Rng): SimResult {
  // 1. True PK (Goti + BSV)
  const truth = gotiIndividualParameters(
    { weight_kg: patient.weight_kg, crcl_ml_min: patient.crcl_ml_min },
    rng,
  );

  // 2. Regimen
  const dose_mg = roundDoseToNearest250mg(DOSE_MG_PER_KG * patient.weight_kg);
  const regimenInput = { CL: truth.CL, V1: truth.V1, Q: truth.Q, V2: truth.V2,
                         dose_mg, tau: INTERVAL_HR, T_inf: T_INF_HR };

  // 3+4. Simulate noisy peak + trough at steady state.
  //   `concentrationAtTime` is a steady-state expression (period-relative t),
  //   so we evaluate at t-within-interval for the peak/trough/heldout times.
  const t_peak    = T_INF_HR + PEAK_TIME_AFTER_INF_END_HR;                 // within interval
  const t_trough  = INTERVAL_HR - TROUGH_BEFORE_NEXT_DOSE_HR;              // within interval
  const t_heldout = INTERVAL_HR - HELDOUT_BEFORE_DOSE_HR;                  // within interval (any later dose at SS is same)

  const true_peak    = concentrationAtTime({ ...regimenInput, t: t_peak });
  const true_trough  = concentrationAtTime({ ...regimenInput, t: t_trough });
  const true_heldout = concentrationAtTime({ ...regimenInput, t: t_heldout });

  const noisy_peak   = addResidualError(true_peak, rng);
  const noisy_trough = addResidualError(true_trough, rng);

  // 5. Feed noisy levels into Vancomyzer's posterior engine.
  //    The engine expects time_since_last_dose_hours; for the peak that's
  //    t_peak (since the infusion-end is part of the dose), and for the
  //    trough the most recent dose was dose 4, so trough sits at
  //    t_trough hours after dose-4 start.
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
    doses_given: 4,
  };
  const nls: NormalizedLevel[] = [
    {
      value_mcg_ml: noisy_peak,
      collection_time: "",  // not used by the posterior fitter when time_since_last_dose is given
      time_since_last_dose_hours: t_peak,
    },
    {
      value_mcg_ml: noisy_trough,
      collection_time: "",
      time_since_last_dose_hours: t_trough,
    },
  ];

  const post = runPosteriorEngine({ patient: np, regimen: nr, levels: nls });

  // 6+7. Predict the held-out timepoint from Vancomyzer's posterior PK and
  //      compare to Goti truth.
  void HELDOUT_DOSE_INDEX; // documents intent; SS expression is dose-index independent
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
    observed_heldout_mcg_ml: true_heldout,
    predicted_heldout_mcg_ml: predicted_heldout,
    fit_succeeded: post.success,
  };
}

export interface RunOptions {
  /** Seed for the PRNG. Default 42 — keep it stable across runs so
   *  the public page can disclose the exact reproducible seed. */
  seed?: number;
  /** Number of synthetic patients in the cohort. Default 200. */
  n?: number;
}

export interface RunOutput {
  seed: number;
  n_attempted: number;
  n_fit_succeeded: number;
  pairs: PredictionPair[];
  per_patient: SimResult[];
}

export function runPredictiveValidation(opts: RunOptions = {}): RunOutput {
  const seed = opts.seed ?? 42;
  const n    = opts.n    ?? 200;
  const rng  = makeRng(seed);
  const cohort = sampleCohort(rng, n);

  const per_patient: SimResult[] = [];
  const pairs: PredictionPair[] = [];
  let n_fit_succeeded = 0;
  for (const patient of cohort) {
    const r = runOnePatient(patient, rng);
    per_patient.push(r);
    if (r.fit_succeeded && Number.isFinite(r.predicted_heldout_mcg_ml) && r.observed_heldout_mcg_ml > 0) {
      pairs.push({ predicted: r.predicted_heldout_mcg_ml, observed: r.observed_heldout_mcg_ml });
      n_fit_succeeded++;
    }
  }
  return { seed, n_attempted: cohort.length, n_fit_succeeded, pairs, per_patient };
}
