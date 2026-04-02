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
  doses_given?: number; // number of doses administered; affects steady-state assumption
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

export interface ExistingRegimenEngineOutput {
  auc24: number;
  peak: number;
  trough: number;
  scr: number;
  current_regimen_dose_mg: number;
  current_regimen_interval_hours: number;
  current_regimen_infusion_hours?: number;
  doses_given?: number;
  target_auc24?: number;
  curve: { time_hours: number; concentration: number }[];
  measured_levels: { time_hours: number; concentration: number }[];
  level_count: number;
  data_quality_note: string;
  used_posterior_refinement: boolean;
  posterior_fit: PosteriorFitDiagnostics;
  CL: number;
  V1: number;
  Q: number;
  V2: number;
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
  interpretation_summary?: string;
  assumptions?: string[];
  limitations?: string[];
  calculation_details?: CalculationDetails;
  frequency_options?: FrequencyOption[];
  documentation_preview?: {
    quick_summary: string;
    clinical_note: string;
  };
}

export interface ExplanationInput {
  engineOutput: ExistingRegimenEngineOutput;
  recommendation: AdjustmentRecommendation;
}

// ... more types
export interface PosteriorFitDiagnostics {
  observation_count: number;
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
