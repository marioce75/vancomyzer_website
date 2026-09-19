/**
 * Core PK types used internally by the engine — not the API contract.
 */

import type { CalculationDetails } from "@/types/calculator";

export interface NormalizedPatient {
  age: number;
  weight_kg: number;
  height_cm: number;
  sex: "male" | "female" | "";
  serum_creatinine_mg_dl: number;
}

export interface NormalizedRegimen {
  dose_mg: number;
  interval_hours: number;
  infusion_duration_hours: number;
  doses_given?: number; // number of doses administered; affects the exposure horizon
  /**
   * Clinician confirmation that the regimen is at steady state. See
   * exposureHorizon.ts: true → steady-state horizon; false → actual-history
   * horizon regardless of dose count; undefined → legacy dose-count rule.
   */
  steady_state_confirmed?: boolean;
  target_auc24?: number; // desired AUC₂₄ target for maintenance recommendation (pulse dose workflow)
}

export interface NormalizedLevel {
  value_mcg_ml: number;
  collection_time: string;
  time_since_last_dose_hours: number;
}

export interface ExistingRegimenEngineInput {
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
}

export interface PosteriorPredictedAtLevel {
  observed: number;
  predicted: number;
  relative_error: number;
}

export interface FitDiagnostic {
  prior_CL: number;
  prior_V1: number;
  posterior_CL: number;
  posterior_V1: number;
  posterior_shift_cl_pct: number;
  posterior_shift_v1_pct: number;
  posterior_predicted_at_levels: PosteriorPredictedAtLevel[];
  max_relative_error: number;
}

/** Steady-state projection of a regimen (canonical computeExposure output). */
export interface SteadyStateExposureBlock {
  auc24: number;
  peak: number;
  trough: number;
  infusion_duration_hours: number;
}

/** Exposure at the Nth dose of the actual history — never a daily AUC. */
export interface ActualHistoryExposureBlock {
  doses_given: number;
  peak: number;
  trough: number;
  auc_interval_n: number;
  auc_0_24h: number;
}

export interface SteadyStateApproachBlock {
  terminal_half_life_hours: number;
  elapsed_hours: number;
  half_lives_elapsed: number;
  fraction_of_steady_state: number;
  adequate: boolean;
}

export interface ExistingRegimenEngineOutput {
  /**
   * Top-level exposure triple. Its horizon is stated in `exposure_horizon`:
   *   steady_state   — canonical steady-state projection of the CURRENT regimen
   *                    (same function and infusion duration as every candidate row);
   *   actual_history — ALSO the steady-state projection (so current vs candidate
   *                    comparisons are like-for-like); the finite-history values
   *                    are in `actual_history_exposure`;
   *   single_dose    — first-dose peak/trough and AUC over the first 24 h.
   * Finite-dose peak/trough are never mixed with a steady-state daily AUC here.
   */
  auc24: number;
  peak: number;
  trough: number;
  exposure_horizon: "steady_state" | "actual_history" | "single_dose";
  steady_state_exposure: SteadyStateExposureBlock;
  actual_history_exposure?: ActualHistoryExposureBlock;
  /** Advisory only: how far along the approach to steady state the model thinks the patient is. */
  steady_state_approach?: SteadyStateApproachBlock;
  /** Set when the clinician confirmed steady state but the model says the approach is inadequate. */
  steady_state_warning?: string;
  scr: number;
  current_regimen_dose_mg: number;
  current_regimen_interval_hours: number;
  current_regimen_infusion_hours?: number;
  doses_given?: number;
  target_auc24?: number;
  curve: { time_hours: number; concentration: number }[];
  /** Alternate curve when in pulse-dose mode: the engine's auto-recommended
   *  maintenance regimen, plotted alongside the user-entered regimen so the
   *  UI can offer a toggle between them. */
  curve_engine_recommended?: { time_hours: number; concentration: number }[];
  /** Pulse-dose mode only: the loading dose alone over the first 48 h — the
   *  profile the single-dose top-level AUC/peak/trough describe. */
  loading_dose_curve?: { time_hours: number; concentration: number }[];
  measured_levels: { time_hours: number; concentration: number }[];
  level_count: number;
  data_quality_note: string;
  used_posterior_refinement: boolean;
  posterior_fit: PosteriorFitDiagnostics;
  CL: number;
  V1: number;
  Q: number;
  V2: number;
  model_name: "colin_2019" | "vancomyzer_obesity";
  ffm_kg?: number;
  fit_diagnostic?: FitDiagnostic;
  /**
   * Set when the fitted clearance hit a physiological bound — either the
   * non-renal floor or the clearance-vs-CrCl ceiling. Carried so the result can
   * tell the clinician the estimate was adjusted and why.
   */
  posterior_cl_bound?: "floored_nonrenal" | "capped_renal";
}

export interface FrequencyOption {
  dose_mg: number;
  interval_hours: number;
  auc24: number;
  peak: number;
  trough: number;
  infusion_duration_hours: number;
  is_recommended: boolean;
  curve?: { time_hours: number; concentration: number }[];
  interpretation_summary?: string;
  quick_summary?: string;
  clinical_note?: string;
}

export interface AdjustmentRecommendation {
  recommended_dose: string;
  recommended_interval_hours: number;
  recommended_infusion_duration_hours?: number;
  infusion_duration_adjusted_for_safety?: boolean;
  infusion_safety_note?: string;
  /**
   * Predicted steady-state exposure of the regimen this recommendation actually
   * emits, and where it sits against the 400-600 target band.
   *
   * finalizeRecommendation already simulates these to run the safety caps and
   * used to discard them, so the adjustment path shipped a regimen without ever
   * stating the exposure it expected: nothing could warn when the emitted
   * regimen missed target, and the dose card fell back to displaying the
   * CURRENT regimen's AUC in its place.
   */
  predicted_auc24?: number;
  predicted_peak?: number;
  predicted_trough?: number;
  auc_range_status?: "in_range" | "below_target" | "above_target";
  interpretation_summary?: string;
  assumptions?: string[];
  limitations?: string[];
  calculation_details?: CalculationDetails;
  frequency_options?: FrequencyOption[];
  documentation_preview?: {
    quick_summary: string;
    clinical_note: string;
  };
  /**
   * Set when no safe adjustment regimen exists — i.e. the engine cannot
   * find any dose/interval combination in its search space whose predicted
   * peak ≤ 80 mcg/mL and trough ≤ 25 mcg/mL. Typically severe renal
   * impairment + sparse data where the current regimen is already supra-
   * therapeutic. The UI MUST render the pulse-dose safety state in place
   * of the standard regimen card; recommended_dose / interval / etc.
   * remain populated with sentinel-safe values so downstream consumers
   * don't crash.
   */
  adjustment_dosing_blocked?: {
    reason: string;
    recommended_action: string;
    safety_message: string;
    estimated_cl_l_h: number;
  };
}

export interface ExplanationInput {
  engineOutput: ExistingRegimenEngineOutput;
  recommendation: AdjustmentRecommendation;
}

// ... more types
export interface PosteriorObjectiveDiagnostics {
  /** Sum over observations of 0.5·z² + ln σ (Gaussian NLL with the app's error model). */
  nll_observations: number;
  /** Sum of 0.5·z² log-normal prior penalties, per parameter. */
  prior_penalty: { CL: number; V1: number; Q: number; V2: number };
  total: number;
}

export interface PosteriorFitDiagnostics {
  parameter_basis?: "final_after_clearance_policy";
  pre_policy_bound?: {
    posterior: { CL: number; V1: number; Q: number; V2: number };
    objective: PosteriorObjectiveDiagnostics;
  };
  observation_count: number;
  /** Horizon the fit modelled the observations under. */
  horizon?: "steady_state" | "actual_history" | "single_dose";
  prior?: { CL: number; V1: number; Q: number; V2: number };
  posterior?: { CL: number; V1: number; Q: number; V2: number };
  /** Log-SDs of the log-normal prior actually used (application-specific, not the published IIV). */
  prior_log_sd?: { CL: number; V1: number; Q: number; V2: number };
  error_model?: string;
  objective?: PosteriorObjectiveDiagnostics;
  /** Observed vs posterior-predicted concentration at each level, with the σ used. */
  predicted_at_observations?: { time_hours: number; observed: number; predicted: number; residual: number; sigma: number; z: number }[];
  convergence?: { method: string; starts: number; best_start_index: number; iterations: number; converged: boolean; tolerance: number };
  /** Parameters that were clamped to the 0.1×–10× prior bounds after optimisation. */
  boundary_hits?: ("CL" | "V1" | "Q" | "V2")[];
  /** Pairs of observations that appear to be duplicate/discordant entries at the same time. */
  observation_conflicts?: { index_a: number; index_b: number; time_hours: number; values: [number, number]; relative_difference: number }[];
  fit_quality: "not_applicable" | "prior_only" | "weak" | "moderate" | "acceptable" | "good" | "excellent";
  fit_quality_reason: string;
  uncertainty_label: "population_only" | "low" | "moderate" | "high" | "very_high";
  rms_error_mcg_ml?: number;
  mean_abs_error_mcg_ml?: number;
  max_abs_error_mcg_ml?: number;
  mean_relative_error?: number;
  posterior_shift_cl_pct?: number;
  posterior_shift_v1_pct?: number;
}
