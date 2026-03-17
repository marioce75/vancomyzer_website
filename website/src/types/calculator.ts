/**
 * Types aligned with POST /api/calculate contract.
 * Do not invent a different API contract.
 */

export type CalculatorMode = "initial_regimen" | "existing_regimen";

export interface CalculateRequestPatient {
  age: number;
  sex: string;
  height_cm: number;
  weight_kg: number;
  serum_creatinine_mg_dl: number;
}

export interface CalculateRequestRegimen {
  dose_mg: number;
  interval_hours: number;
  infusion_duration_hours: number;
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

export interface CalculateResponse {
  recommendation_type: "initial_regimen" | "existing_regimen";
  auc24: number;
  peak: number;
  trough: number;
  recommended_dose: string;
  recommended_interval_hours: number;
  interpretation_summary: string;
  assumptions: string[];
  limitations: string[];
  curve: { time_hours: number; concentration: number }[];
  measured_levels: { time_hours: number; concentration: number }[];
  documentation_preview?: {
    quick_summary: string;
    clinical_note: string;
  };
}

export interface CalculateErrorResponse {
  error_type: "validation_error" | "calculation_error" | "insufficient_data";
  message: string;
  field_errors?: Record<string, string>;
  details?: string[];
  limitations?: string[];
}
