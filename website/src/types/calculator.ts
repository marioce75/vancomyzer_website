/** A plotted concentration point, with the credible band edges when the engine computed one. */
export interface CurvePointWithBand {
  time_hours: number;
  concentration: number;
  lower?: number;
  upper?: number;
}

/** What the band on the plotted curves represents (draws are never sent). */
export type ParameterUncertaintySummary =
  | {
      method: "posterior_sir" | "population_prior";
      level: number;
      n_draws: number;
      seed: number;
      log_sd: { CL: number; V1: number; Q: number; V2: number };
      corr_CL_V1: number;
      effective_sample_size?: number;
    }
  | { method: "unavailable"; reason: string; detail?: string };

/**
 * Types aligned with POST /api/calculate contract.
 * Do not invent a different API contract.
 */

export type CalculatorMode = "initial_regimen" | "existing_regimen";

export interface CalculateRequestPatient {
  age: number;
  weight_kg: number;
  height_cm: number;
  sex: "male" | "female" | "";
  serum_creatinine_mg_dl: number;
  /**
   * Dialysis or other renal replacement therapy. The Colin 2019 population
   * excludes RRT, and this site states that recommendations are withheld for
   * it, so the API refuses the calculation when this is true.
   */
  dialysis_or_rrt?: boolean;
}

export interface CalculateRequestRegimen {
  dose_mg: number;
  interval_hours: number;
  infusion_duration_hours: number;
  doses_given?: number; // number of doses administered before levels drawn; affects the exposure horizon
  /** Clinician confirmation of steady state (the "≥6 · steady state" control). false → actual-history horizon. */
  steady_state_confirmed?: boolean;
  target_auc24?: number; // desired AUC₂₄ target for maintenance recommendation (pulse dose workflow)
  /** Dose 1 was a loading dose (level workflows, doses_given ≥ 2). */
  loading_dose_mg?: number;
  loading_infusion_duration_hours?: number;
  /** Hours from the start of the loading dose to the start of the first maintenance dose (default: the interval). */
  loading_to_maintenance_hours?: number;
}

export interface CalculateRequestLevel {
  value_mcg_ml: number;
  collection_time: string;
  time_since_last_dose_hours: number;
}

export interface CalculateRequest {
  mode: CalculatorMode;
  patient: CalculateRequestPatient;
  regimen?: CalculateRequestRegimen;
  levels?: CalculateRequestLevel[];
  /** Optional clinician-supplied tracking string. Pro+ only. NO PHI. */
  case_id?: string;
  /**
   * "explicit" = user clicked Calculate / pressed Cmd+Enter / completed a
   *              loading-dose simulation → eligible for history persistence.
   * "auto"     = debounced recalc fired by an input change → never persisted.
   * Defaults to "explicit" when absent for backward compatibility.
   */
  intent?: "explicit" | "auto";
}

export type ReviewStatusLevel = "prior_only" | "caution" | "supported";
export type WorkflowFitCategory = "prior_only" | "single_level" | "multi_level_coherent";

export interface ReviewStatus {
  level: ReviewStatusLevel;
  workflow_fit: WorkflowFitCategory;
  banner_title: string;
  banner_body: string;
  next_actions: string[];
}

export interface CalculationDetails {
  method: string;
  evidence_strength: string;
  data_quality_summary: string;
  key_inputs: string[];
  caution_flags: string[];
  review_status: ReviewStatus;
}

export interface FrequencyOption {
  dose_mg: number;
  interval_hours: number;
  auc24: number;
  peak: number;
  trough: number;
  infusion_duration_hours: number;
  doses_given?: number;
  is_recommended: boolean;
  curve?: CurvePointWithBand[];
  interpretation_summary?: string;
  quick_summary?: string;
  clinical_note?: string;
}

export type AucRangeStatus = "in_range" | "below_target" | "above_target";

export interface ArcAdvisory {
  detected: boolean;
  /** Cockcroft-Gault on total body weight, absolute mL/min. */
  crcl_ml_min?: number;
  /**
   * The same clearance indexed to 1.73 m2, which is the basis the ARC
   * definition uses. Absent when height was not entered, so BSA could not be
   * derived; the trigger then falls back to the absolute value.
   */
  crcl_indexed_ml_min_1_73?: number;
  cl_l_h?: number;
  required_tdd_mg?: number;
  continuous_infusion_rate_mg_h?: number;
  message?: string;
}

export interface CalculateResponse {
  recommendation_type: "initial_regimen" | "existing_regimen";
  auc24: number;
  peak: number;
  trough: number;
  auc_range_status?: AucRangeStatus;
  arc_advisory?: ArcAdvisory;
  /** Soft warnings about input timing — e.g., late lab draws within tolerance. */
  timing_warnings?: string[];
  /** Surfaced when the posterior fit can't explain the level within tolerance. */
  fit_quality_warnings?: string[];
  /** Which horizon the top-level auc24/peak/trough describe (see lib/pk/exposureHorizon.ts). */
  exposure_horizon?: "steady_state" | "actual_history" | "single_dose";
  steady_state_exposure?: { auc24: number; peak: number; trough: number; infusion_duration_hours: number };
  actual_history_exposure?: { doses_given: number; peak: number; trough: number; auc_interval_n: number; auc_0_24h: number };
  steady_state_approach?: { terminal_half_life_hours: number; elapsed_hours: number; half_lives_elapsed: number; fraction_of_steady_state: number; adequate: boolean };
  steady_state_warning?: string;
  /** Actionable adjustment withheld until the clinician reconciles the observations. */
  review_hold?: { reason: string; message: string; conflicts?: unknown[] };
  /** Immutable binding of this result to its inputs and model version. */
  result_snapshot?: { model_manifest_version: string; mode: string; input_digest: string; computed_at: string };
  /** Alternate concentration-time curve when in pulse-dose mode — the
   *  engine's auto-recommended maintenance regimen. The primary `curve`
   *  reflects the user's entered regimen. */
  curve_engine_recommended?: CurvePointWithBand[];
  /** Pulse-dose mode only: the loading dose alone over the first 48 h. */
  loading_dose_curve?: CurvePointWithBand[];
  /** Posterior fit diagnostic — prior/posterior values + per-level residuals. */
  fit_diagnostic?: {
    prior_CL: number;
    prior_V1: number;
    posterior_CL: number;
    posterior_V1: number;
    posterior_shift_cl_pct: number;
    posterior_shift_v1_pct: number;
    posterior_predicted_at_levels: { observed: number; predicted: number; relative_error: number }[];
    max_relative_error: number;
  };
  /** What the credible band on the curves represents; see ParameterUncertaintySummary. */
  parameter_uncertainty?: ParameterUncertaintySummary;
  /**
   * The engine's own posterior fit diagnostic (fit quality and the qualitative
   * uncertainty label). The graph band no longer uses it; see parameter_uncertainty.
   */
  posterior_fit?: {
    observation_count: number;
    fit_quality: string;
    fit_quality_reason: string;
    uncertainty_label: string;
  };
  /**
   * Predicted steady-state exposure of the regimen being recommended, as
   * distinct from `auc24`/`peak`/`trough`, which on the existing-regimen path
   * describe the regimen the patient is already on.
   */
  predicted_auc24?: number;
  predicted_peak?: number;
  predicted_trough?: number;
  recommended_dose: string;
  recommended_interval_hours: number;
  recommended_infusion_duration_hours?: number;
  infusion_duration_adjusted_for_safety?: boolean;
  infusion_safety_note?: string;
  interpretation_summary: string;
  assumptions: string[];
  limitations: string[];
  curve: CurvePointWithBand[];
  measured_levels: { time_hours: number; concentration: number }[];
  calculation_details?: CalculationDetails;
  frequency_options?: FrequencyOption[];
  documentation_preview?: {
    quick_summary: string;
    clinical_note: string;
  };
  pk_parameters?: {
    CL: number;
    V1: number;
    Q: number;
    V2: number;
    used_posterior_refinement: boolean;
    scr: number;
    age?: number;
    weight_kg?: number;
    pk_model_name?: "colin_2019" | "vancomyzer_obesity";
    ffm_kg?: number;
  };
  /**
   * Set when the empiric search returns no safe fixed-interval regimen (severe
   * renal impairment, very low clearance). The UI MUST render the pulse-dose
   * safety state instead of the standard recommended_dose/auc/peak/trough
   * fields, which will contain sentinel zeros in this case.
   */
  empiric_dosing_blocked?: {
    reason: string;
    recommended_pulse_dose_mg: number;
    safety_message: string;
    estimated_cl_l_h: number;
  };
  /**
   * Set when the existing-regimen ADJUSTMENT engine cannot find any
   * regimen in its search space whose predicted peak/trough fall within
   * the institutional safety caps. The UI MUST render the safety state
   * in place of the standard recommendation card.
   */
  adjustment_dosing_blocked?: {
    reason: string;
    recommended_action: string;
    safety_message: string;
    estimated_cl_l_h: number;
  };
}

export interface CalculateErrorResponse {
  // "rate_limited" is returned with HTTP 429 to anonymous callers of
  // POST /api/calculate (see src/lib/rateLimit.ts); the visitor sees `message`.
  error_type: "validation_error" | "calculation_error" | "insufficient_data" | "rate_limited";
  message: string;
  field_errors?: Record<string, string>;
  details?: string[];
  limitations?: string[];
  recovery_guidance?: string[];
  fallback_workflow?: "initial_regimen" | "repeat_existing_regimen_sampling";
}
