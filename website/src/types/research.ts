/**
 * Types for the Vancomyzer Research Mode — NONMEM export infrastructure.
 * Supports the Dōsys LLC / UTRGV / HCA Gulf Coast Division IRB study.
 *
 * All types are additive. No existing calculator types are modified.
 */

// ---------------------------------------------------------------------------
// Database row types
// ---------------------------------------------------------------------------

export interface ResearchPatient {
  study_id: string;             // Auto-generated UUID (RS-XXXX)
  site_id: string;              // e.g., "HCA-GC-01"
  age: number;                  // Capped at 90 per HIPAA Safe Harbor
  sex: "male" | "female";
  ethnicity: "hispanic" | "non-hispanic" | "unknown";
  weight_kg: number;            // TBW
  height_cm: number;
  bmi: number;                  // Auto-calculated
  ffm_kg: number;               // Auto-calculated (Janmahasatian 2005)
  ibw_kg: number;               // Auto-calculated (Devine)
  adjbw_kg: number | null;      // Auto-calculated for BMI 30-40
  scr_baseline: number;         // mg/dL
  crcl_baseline: number;        // mL/min (Cockcroft-Gault)
  icu_admission: number;        // 0 or 1
  indication: "mrsa_bacteremia" | "mrsa_pneumonia" | "ssti" | "osteomyelitis" | "empiric" | "other";
  bedbound: number;             // 0 or 1
  rrt: number;                  // 0 or 1 — renal replacement therapy
  enrollment_date: string;      // YYYY-MM-DD
  meets_inclusion: number;      // 0 or 1
  exclusion_reasons: string;    // JSON array of strings
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ScrTrajectoryPoint {
  id: number;
  study_id: string;
  scr_mg_dl: number;
  time_hours: number;           // Hours from first vancomycin dose
  crcl_ml_min: number;          // Auto-calculated at this timepoint
}

export interface DosingRecord {
  id: number;
  study_id: string;
  dose_mg: number;
  infusion_duration_min: number;
  infusion_rate_mg_h: number;   // Auto-calculated: dose / (duration/60)
  time_hours: number;           // Hours from first dose (first dose = 0)
  is_loading_dose: number;      // 0 or 1
}

export interface LevelRecord {
  id: number;
  study_id: string;
  concentration_mcg_ml: number;
  time_hours: number;           // Hours from first dose
  during_infusion: number;      // 0 or 1 — exclusion flag
  in_distribution_phase: number;// 0 or 1 — exclusion flag (<2h after infusion end)
  time_since_infusion_end_h: number; // Auto-calculated
}

export interface ClinicalOutcome {
  id: number;
  study_id: string;
  aki_detected: number;         // 0 or 1
  aki_stage: number | null;     // 1, 2, 3, or null
  aki_onset_day: number | null; // Days from first dose
  hospital_los_days: number | null;
  vanc_discontinued_early: number; // 0 or 1
  discontinuation_reason: string | null;
  microbiological_outcome: "eradicated" | "persistent" | "unknown" | null;
}

export interface ConcomitantNephrotoxin {
  id: number;
  study_id: string;
  drug_name: string;            // From controlled vocabulary
  vasopressor_use: number;      // 0 or 1
}

export interface ResearchAuditEntry {
  id: number;
  timestamp: string;
  user_id: string;
  action: string;               // create, update, delete, export
  study_id: string | null;
  fields_changed: string;       // JSON description
}

// ---------------------------------------------------------------------------
// Controlled vocabularies
// ---------------------------------------------------------------------------

export const INDICATIONS = [
  "mrsa_bacteremia",
  "mrsa_pneumonia",
  "ssti",
  "osteomyelitis",
  "empiric",
  "other",
] as const;

export const INDICATION_LABELS: Record<string, string> = {
  mrsa_bacteremia: "MRSA Bacteremia",
  mrsa_pneumonia: "MRSA Pneumonia",
  ssti: "Skin & Soft Tissue Infection",
  osteomyelitis: "Osteomyelitis",
  empiric: "Empiric",
  other: "Other",
};

export const NEPHROTOXINS = [
  "NSAIDs",
  "Aminoglycosides",
  "Amphotericin B",
  "IV Contrast",
  "Acyclovir",
  "Tacrolimus",
  "Cisplatin",
  "Colistin",
  "Piperacillin-Tazobactam",
] as const;

export const ETHNICITIES = ["hispanic", "non-hispanic", "unknown"] as const;

// ---------------------------------------------------------------------------
// Engine result types
// ---------------------------------------------------------------------------

export interface EligibilityResult {
  eligible: boolean;
  inclusion: { criterion: string; met: boolean }[];
  exclusion: { criterion: string; triggered: boolean }[];
  exclusion_reasons: string[];
}

export interface KdigoResult {
  detected: boolean;
  stage: 0 | 1 | 2 | 3;
  onset_day: number | null;
  details: string;
}

export interface PredictionError {
  level_id: number;
  observed: number;
  predicted: number;
  pe_percent: number;           // (predicted - observed) / observed * 100
  ape_percent: number;          // |pe_percent|
  within_20_pct: boolean;
}

export interface PredictionErrorSummary {
  method: "a_priori" | "a_posteriori";
  n_levels: number;
  mpe: number;                  // Mean percentage error (bias)
  rmse: number;                 // Root mean squared error (precision)
  nrmse: number;                // Normalized RMSE (RMSE / mean observed)
  pct_within_20: number;        // % of predictions within ±20%
  individual_errors: PredictionError[];
}

export interface StudyMetrics {
  total_patients: number;
  eligible_patients: number;
  excluded_patients: number;
  obesity_subgroup: number;     // BMI >= 40
  exclusion_breakdown: Record<string, number>;
  a_priori_summary: PredictionErrorSummary | null;
  a_posteriori_summary: PredictionErrorSummary | null;
}

// ---------------------------------------------------------------------------
// NONMEM row
// ---------------------------------------------------------------------------

export interface NonmemRow {
  ID: number;
  TIME: number;
  DV: number;
  AMT: number;
  RATE: number;
  EVID: number;                 // 1 = dose, 0 = observation
  MDV: number;                  // 1 = missing DV (dose rows), 0 = observed
  CMT: number;                  // 1 = central compartment
  AGE: number;
  WT: number;
  HT: number;
  BMI: number;
  FFM: number;
  IBW: number;
  SEX: number;                  // 0 = female, 1 = male (NONMEM convention)
  SCRI: number;                 // SCr at or nearest to this timepoint
  CRCL: number;
  ICU: number;
  OBS_CLASS: number;            // 1 = BMI <30, 2 = BMI 30-40, 3 = BMI >=40
  HISP: number;
  ARC: number;                  // CrCl > 150
  SITE: string;
}

// ---------------------------------------------------------------------------
// Hughes 2024 acceptance thresholds
// ---------------------------------------------------------------------------

export const HUGHES_THRESHOLDS = {
  mpe_acceptable: 20,           // MPE within ±20%
  nrmse_acceptable: 8,          // Normalized RMSE < 8 mg/L
  pct_within_20_acceptable: 50, // ≥50% within ±20%
} as const;
