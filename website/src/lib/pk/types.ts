/**
 * Internal types for PK engine. Keeps API contract in website/src/types/calculator.
 */

export interface NormalizedPatient {
  age: number;
  sex: string;
  height_cm: number;
  weight_kg: number;
  serum_creatinine_mg_dl: number;
}

export interface NormalizedRegimen {
  dose_mg: number;
  interval_hours: number;
  infusion_duration_hours: number;
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

export interface PosteriorFitDiagnostics {
  observation_count: number;
  fit_quality: "not_applicable" | "prior_only" | "weak" | "moderate";
  fit_quality_reason: string;
  rms_error_mcg_ml?: number;
  mean_abs_error_mcg_ml?: number;
  max_abs_error_mcg_ml?: number;
  mean_relative_error?: number;
  posterior_shift_ke_pct?: number;
  posterior_shift_v_pct?: number;
  uncertainty_label: "population_only" | "high" | "moderate";
}

export interface ExistingRegimenEngineOutput {
  auc24: number;
  peak: number;
  trough: number;
  crcl: number;
  current_regimen_dose_mg: number;
  current_regimen_interval_hours: number;
  curve: { time_hours: number; concentration: number }[];
  measured_levels: { time_hours: number; concentration: number }[];
  level_count: number;
  data_quality_note: string;
  /** True when first-pass refinement from measured level(s) was applied. */
  used_posterior_refinement?: boolean;
  /** Internal posterior fit diagnostics for explanation text. Not in API response. */
  posterior_fit?: PosteriorFitDiagnostics;
  /** Internal: used by recommendation layer to simulate candidate regimens. Not in API response. */
  Ke?: number;
  V?: number;
  current_regimen_infusion_hours?: number;
}

export interface AdjustmentRecommendation {
  recommended_dose: string;
  recommended_interval_hours: number;
}

export interface ExplanationInput {
  engineOutput: ExistingRegimenEngineOutput;
  recommendation: AdjustmentRecommendation;
}
