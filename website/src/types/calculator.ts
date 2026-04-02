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
}

export interface CalculateRequestRegimen {
  dose_mg: number;
  interval_hours: number;
  infusion_duration_hours: number;
  doses_given?: number; // number of doses administered before levels drawn; affects steady-state assumption
  target_auc24?: number; // desired AUC₂₄ target for maintenance recommendation (pulse dose workflow)
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
  curve?: { time_hours: number; concentration: number }[];
  interpretation_summary?: string;
  quick_summary?: string;
  clinical_note?: string;
}

export interface CalculateResponse {
  recommendation_type: "initial_regimen" | "existing_regimen";
  auc24: number;
  peak: number;
  trough: number;
  recommended_dose: string;
  recommended_interval_hours: number;
  recommended_infusion_duration_hours?: number;
  infusion_duration_adjusted_for_safety?: boolean;
  infusion_safety_note?: string;
  interpretation_summary: string;
  assumptions: string[];
  limitations: string[];
  curve: { time_hours: number; concentration: number }[];
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
  };
}

export interface CalculateErrorResponse {
  error_type: "validation_error" | "calculation_error" | "insufficient_data";
  message: string;
  field_errors?: Record<string, string>;
  details?: string[];
  limitations?: string[];
  recovery_guidance?: string[];
  fallback_workflow?: "initial_regimen" | "repeat_existing_regimen_sampling";
}
