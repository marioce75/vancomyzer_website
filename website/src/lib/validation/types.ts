/**
 * Type definitions for the literature case library.
 *
 * There are three kinds of case (see ComparisonKind):
 *  - same-model reproductions pin the engine's output to a value published
 *    for the model the engine uses (Colin 2019). They run in `npm test`
 *    (scripts/verify-cases.ts) and fail the suite if the engine drifts
 *    outside the case's tolerance or if no published value is present.
 *  - cross-model references run the engine (Colin 2019) next to a value
 *    from a DIFFERENT published model or a cohort statistic. The difference
 *    is shown for context only. They never pass or fail and are excluded
 *    from summary statistics.
 *  - reference bands show a published multi-model comparison without
 *    running the engine.
 *
 * Every published value must record how it was extracted so a reviewer
 * can check it against the cited source.
 */

/**
 * How the engine is invoked for a case:
 *  - "empiric"           → computeInitialRegimen (engine picks the regimen)
 *  - "prior_at_regimen"  → buildPriorParameters + computeExposure (population prior at a stated
 *                          regimen; no Bayesian update)
 *  - "existing"          → runExistingRegimenEngine (Bayesian fit to the case's levels)
 *  - "reference_band"    → no engine call; the card renders a published multi-model comparison
 */
export type WorkflowType = "empiric" | "prior_at_regimen" | "existing" | "reference_band";

/**
 * What the case's comparison means:
 *  - "same_model_reproduction": published value comes from the model the engine uses.
 *    Pass/fail against `tolerance`; counted in the summary.
 *  - "cross_model_reference": published value comes from a different model or a cohort
 *    statistic. Engine value and difference are shown for context only; no pass/fail;
 *    excluded from summary statistics. `tolerance` must be null.
 *  - "reference_band": no engine call (workflow_type "reference_band"). `tolerance` must be null.
 */
export type ComparisonKind = "same_model_reproduction" | "cross_model_reference" | "reference_band";

export type SourceKind =
  /** Typical-individual value from a published model's equations or text. */
  | "model_typical_value"
  /** Cohort-level statistic (median, mean, range) from a published study. */
  | "cohort_summary"
  | "population_simulation"
  | "individual_observed"
  | "individual_predicted_bayesian"
  | "guideline_worked_example";

/**
 * Where the case's patient inputs come from:
 *  - "published": the inputs are the values stated in the source
 *  - "approximated": some inputs match published values; others were chosen by Vancomyzer
 *    to approximate the source and have not been verified against it (see patient.notes)
 *  - "illustrative": the inputs were chosen by Vancomyzer for illustration and are not from the source
 *  - "not_applicable": sentinel inputs on a reference-band card (no engine run)
 */
export type InputsStatus = "published" | "approximated" | "illustrative" | "not_applicable";

export interface SourceCitation {
  /** Vancouver-style citation. */
  citation: string;
  /** DOI without the "doi:" prefix. */
  doi: string;
  /** Resolvable URL for the source (DOI or stable URL). */
  url: string;
  /** Exact pointer into the source, e.g. "Abstract" or "Table 3, a posteriori rows". */
  specific_reference: string;
  /**
   * True only if the curator checked the numbers against the source.
   * False means a secondary reference was used.
   */
  verified: boolean;
  verification_note: string;
}

export interface CasePatient {
  age_years: number;
  weight_kg: number;
  serum_creatinine_mg_dl: number;
  sex: "M" | "F";
  /** Optional — only needed if the source provides it. */
  height_cm: number | null;
  /** Free-text clinical context, e.g. "MRSA bacteremia". */
  indication: string;
  /** Where the inputs come from. Shown on the card. */
  inputs_status: InputsStatus;
  /** Caveats about the inputs, shown on the card. */
  notes: string;
}

export interface CaseRegimen {
  dose_mg: number;
  interval_hours: number;
  /** Must keep the infusion rate at or below 10 mg/min (duration ≥ dose/600 h). */
  infusion_duration_hours: number;
  doses_given: number;
}

export interface CaseLevel {
  value_mcg_ml: number;
  time_since_last_dose_hours: number;
}

export interface PublishedRange {
  low: number;
  high: number;
  /** e.g. "interquartile range" or "range of full-data estimates across four models". */
  description: string;
}

export interface PublishedValues {
  auc24_mg_h_l: number | null;
  /** Optional published range around auc24_mg_h_l, shown on the card. */
  auc24_range?: PublishedRange | null;
  peak_mcg_ml: number | null;
  trough_mcg_ml: number | null;
  clearance_l_h: number | null;
  v1_l: number | null;
  source_kind: SourceKind;
  /** "Read directly from Table 3 row 2" | "Evaluated from the published equation" etc. */
  extraction_method: string;
  /** Justification for the chosen tolerance, or why there is none. */
  tolerance_rationale: string;
}

export interface CaseTolerance {
  /** Maximum absolute percent difference before a reproduction case fails. */
  auc24_pct: number;
  peak_pct: number;
  trough_pct: number;
  clearance_pct: number;
  v1_pct: number;
}

export interface PublishedCase {
  /** kebab-case slug, e.g. "colin-2019-typical-adult". URL-safe, stable across builds. */
  id: string;
  /** One-sentence summary of what the case checks or shows. */
  what_it_tests: string;
  source: SourceCitation;
  patient: CasePatient;
  /** Required for "existing" and "prior_at_regimen"; null for "empiric" and "reference_band". */
  regimen: CaseRegimen | null;
  /** Empty array if there are no measured concentrations. */
  levels: CaseLevel[];
  published: PublishedValues;
  comparison_kind: ComparisonKind;
  /** Required for same-model reproductions; null for cross-model references and reference bands. */
  tolerance: CaseTolerance | null;
  /** Sentence(s) shown on the case card explaining context and caveats. */
  notes_for_page: string;
  workflow_type: WorkflowType;
  /**
   * Populated when workflow_type === "reference_band". Carries per-model
   * published values for a multi-model comparison study. The runner skips
   * the engine call; patient / regimen / published fields are sentinels.
   */
  reference_band?: ReferenceBand;
}

export interface ReferencePlatform {
  /** Display name shown on the bar, e.g. "Goti 2018 (via Tucuxi)". */
  name: string;
  mean_auc24_mg_h_l: number;
  /** Optional standard deviation, shown as a whisker on the bar. */
  sd_auc24_mg_h_l?: number;
  /** Optional caveat shown under the name. */
  notes?: string;
  /** True if this row uses the model Vancomyzer uses for dosing (highlighted). */
  is_vancomyzer_prior?: boolean;
}

export interface ReferenceBand {
  /** One-paragraph cohort description shown above the bar chart. */
  cohort_description: string;
  /** Per-model published values. */
  platforms: ReferencePlatform[];
  /** How Vancomyzer relates to this published comparison. */
  our_position: string;
}

export type CaseStatus =
  /** Same-model reproduction within tolerance on every published metric. */
  | "pass"
  /** Same-model reproduction outside tolerance, or with nothing published to compare. */
  | "fail"
  /** Cross-model reference or reference band: not a pass/fail test. */
  | "not_tested";

/** Result of running one case through the live engine and comparing to published. */
export interface CaseResult {
  case_id: string;
  comparison_kind: ComparisonKind;
  predicted: {
    auc24: number | null;
    peak: number | null;
    trough: number | null;
    clearance_l_h: number | null;
    v1_l: number | null;
  };
  /** (engine − published) / published × 100, or null when either is missing. */
  deltas: {
    auc24_pct: number | null;
    peak_pct: number | null;
    trough_pct: number | null;
    clearance_pct: number | null;
    v1_pct: number | null;
  };
  status: CaseStatus;
  /** For status "fail": which checks failed. Empty otherwise. */
  failures: string[];
}
