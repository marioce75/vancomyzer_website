/**
 * Type definitions for the Literature Reproducibility case library.
 *
 * Each PublishedCase is a frozen-in-time test fixture pinning Vancomyzer's
 * engine output to a value cited in the peer-reviewed literature or a
 * society guideline. Cases run at build time (see scripts/verify-cases.ts)
 * and hard-fail the build if our output drifts beyond the case's tolerance.
 *
 * Schema is deliberately strict: every numeric input must be a specific
 * number (no ranges), and every published value must have an extraction
 * method recorded so the attorney/clinician/reviewer can verify the data
 * against the cited source.
 */

/**
 * How the engine should be invoked for a case:
 *  - "empiric"           → computeInitialRegimen (engine picks the best regimen for the patient)
 *  - "prior_at_regimen"  → buildPriorParameters + computeExposure (prior-only prediction at a
 *                          stated regimen; no Bayesian update). Used to verify the prior's
 *                          CL/V output against a published population-typical AUC, which is
 *                          what most popPK papers actually publish (very few publish individual
 *                          patient-level cases with full demographics + dose + AUC).
 *  - "existing"          → runExistingRegimenPipeline (full Bayesian fit using measured levels)
 *  - "reference_band"    → NO engine call. Card renders a published multi-platform comparison
 *                          (e.g., Patanwala 2022 cohort-mean AUC per popPK model) as
 *                          industry-context evidence. Our engine is not in the test loop for
 *                          these cards; they exist to show platform-choice variance.
 */
export type WorkflowType = "empiric" | "prior_at_regimen" | "existing" | "reference_band";

export type SourceKind =
  | "population_simulation"
  | "individual_observed"
  | "individual_predicted_bayesian"
  | "guideline_worked_example";

export interface SourceCitation {
  /** Vancouver-style citation, e.g. "Colin PJ et al. Clin Pharmacokinet. 2019;58(6):767-780" */
  citation: string;
  /** DOI without the "doi:" prefix, e.g. "10.1007/s40262-018-0727-5" */
  doi: string;
  /** Resolvable URL for the source (DOI or stable URL) */
  url: string;
  /**
   * Exact pointer into the source, e.g. "Figure 3, panel B" or
   * "Appendix A, Patient Case 1". Required — clinicians click through
   * to verify, and a vague "see paper" undercuts the credibility play.
   */
  specific_reference: string;
  /**
   * True only if the curator personally verified the numbers against the
   * source. False means the case is sourced from a secondary reference
   * (e.g. cited in a review) and we couldn't access the primary.
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
  /** Caveats: "population median, not real patient" or "case 14 from cohort". */
  notes: string;
}

export interface CaseRegimen {
  dose_mg: number;
  interval_hours: number;
  infusion_duration_hours: number;
  doses_given: number;
}

export interface CaseLevel {
  value_mcg_ml: number;
  time_since_last_dose_hours: number;
}

export interface PublishedValues {
  auc24_mg_h_l: number | null;
  peak_mcg_ml: number | null;
  trough_mcg_ml: number | null;
  clearance_l_h: number | null;
  v1_l: number | null;
  source_kind: SourceKind;
  /** "Read directly from Table 3 row 2" | "Visual estimation from Figure 4" etc. */
  extraction_method: string;
  /** Justification for the chosen tolerance. */
  tolerance_rationale: string;
}

export interface CaseTolerance {
  /** Acceptable absolute percent error on AUC24 before the case is "drifted". */
  auc24_pct: number;
  peak_pct: number;
  trough_pct: number;
}

export interface PublishedCase {
  /** kebab-case slug, e.g. "colin-2019-fig-3b". URL-safe, stable across builds. */
  id: string;
  /** One-sentence summary of what the case proves. */
  what_it_tests: string;
  source: SourceCitation;
  patient: CasePatient;
  /** Required for "existing", omitted for "empiric" (which has no input regimen). */
  regimen: CaseRegimen | null;
  /** Empty array if no measured concentrations (population sim / empiric). */
  levels: CaseLevel[];
  published: PublishedValues;
  tolerance: CaseTolerance;
  /** Sentence(s) shown on the case card explaining context + caveats. */
  notes_for_page: string;
  workflow_type: WorkflowType;
  /**
   * Populated when workflow_type === "reference_band". Carries the per-
   * platform published values for a multi-platform comparison study (e.g.,
   * Patanwala 2022's three popPK priors over 188 ICU adults). When set, the
   * runner skips the engine call and the card renders the comparison band
   * directly. The patient / regimen / published / tolerance fields above are
   * required by the schema but ignored by the runner for these cases — use
   * sentinel/placeholder values in the case file.
   */
  reference_band?: ReferenceBand;
}

export interface ReferencePlatform {
  /** Display name shown on the bar, e.g. "Goti (via Tucuxi)" or "PrecisePK". */
  name: string;
  mean_auc24_mg_h_l: number;
  /** Optional standard deviation, shown as a whisker on the bar. */
  sd_auc24_mg_h_l?: number;
  /** Optional caveat — e.g. "uses the prior Vancomyzer is built on" so the
   *  reader knows which row to compare against. */
  notes?: string;
  /** True if this is the platform Vancomyzer's prior is built on (highlighted
   *  visually). */
  is_vancomyzer_prior?: boolean;
}

export interface ReferenceBand {
  /** One-paragraph cohort description shown above the bar chart. */
  cohort_description: string;
  /** Per-platform published values. Sorted ascending by mean on the card. */
  platforms: ReferencePlatform[];
  /** Position statement — how Vancomyzer relates to this band. */
  our_position: string;
}

/** Result of running one case through the live engine and comparing to published. */
export interface CaseResult {
  case_id: string;
  predicted: {
    auc24: number | null;
    peak: number | null;
    trough: number | null;
    clearance_l_h: number | null;
    v1_l: number | null;
  };
  deltas: {
    auc24_pct: number | null;
    peak_pct: number | null;
    trough_pct: number | null;
  };
  within_tolerance: boolean;
  /** If false, lists which metrics drifted. */
  failures: string[];
  /** True for reference_band cases that have no engine output to verify —
   *  the card renders the published band as industry context, not as a
   *  reproducibility test. These cases are excluded from the summary
   *  scorecard's delta math but still counted in the total. */
  is_reference_band?: boolean;
}
