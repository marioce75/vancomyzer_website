/**
 * Neely 2014 — Bayesian-from-sparse-data plausibility check.
 *
 * The most-cited "Bayesian-with-one-trough" reference in vancomycin
 * dosing literature, but the paper does not publish per-patient
 * demographics + dose + AUC. The only individual-grained number
 * reproducible from the paper is the institutional cohort median
 * trough (8.0 mcg/mL, range 1.1–17.5, n=36).
 *
 * This case tests whether our Bayesian posterior, fed a representative
 * adult patient + a single observed trough = 8.0 mcg/mL, lands its
 * posterior trough prediction within ±25% of the input observation.
 * This is a wide-tolerance plausibility check, not a point match —
 * Bayesian fits at sparse data should converge toward the observation
 * given a moderately weighted prior.
 *
 * Source: Neely MN et al. Antimicrob Agents Chemother. 2014;58(1):309-316.
 */

import type { PublishedCase } from "../types";

export const NEELY_2014_TROUGH_PLAUSIBILITY: PublishedCase = {
  id: "neely-2014-trough-plausibility",
  what_it_tests:
    "Posterior fitter behavior with a single trough observation: our Bayesian fit should land its trough prediction near the input observation, with prior regularization preventing exact match.",
  source: {
    citation:
      "Neely MN, Youn G, Jones B, et al. Are vancomycin trough concentrations adequate for optimal dosing? Antimicrob Agents Chemother. 2014;58(1):309-316",
    doi: "10.1128/AAC.01653-13",
    url: "https://doi.org/10.1128/AAC.01653-13",
    specific_reference:
      "Institutional cohort (n=36): median trough 8.0 mcg/mL (range 1.1–17.5); population PK ModelF: Ke 0.30 h⁻¹, Vc 14.8 L, KCP 1.13 h⁻¹, KPC 0.66 h⁻¹",
    verified: true,
    verification_note:
      "Cohort parameters confirmed from PMC3910745 full text. The paper does NOT publish per-patient demographics + dose + AUC — only the cohort median trough. This case uses representative defaults for the institutional cohort population (adult, ~58y, ~75 kg, normal renal function) and tests our posterior fit against the cohort median trough as a plausibility floor, not as a point reproduction.",
  },
  patient: {
    age_years: 58,
    weight_kg: 75,
    serum_creatinine_mg_dl: 1.0,
    sex: "M",
    height_cm: null,
    indication: "Mixed (MRSA and other indications)",
    notes:
      "Cohort-typical adult — not an individual patient. Demographics are reasonable defaults; the paper does not publish per-patient values.",
  },
  regimen: {
    dose_mg: 1000,
    interval_hours: 12,
    infusion_duration_hours: 1.0,
    doses_given: 5,
  },
  levels: [{ value_mcg_ml: 8.0, time_since_last_dose_hours: 11.5 }],
  published: {
    auc24_mg_h_l: null,
    peak_mcg_ml: null,
    trough_mcg_ml: 8.0,
    clearance_l_h: null,
    v1_l: 14.8,
    source_kind: "individual_observed",
    extraction_method:
      "Median observed trough (8.0 mcg/mL) from the n=36 institutional sub-cohort. The published value is the OBSERVED trough at 11.5h post-dose; we compare our Bayesian POSTERIOR trough prediction against this same value.",
    tolerance_rationale:
      "Wide ±25% tolerance is appropriate because the published value is a cohort median, not an individual-case prediction. The point of this test is 'does our posterior fit land in the neighborhood of the observation?' — not 'does our posterior match a paper-specific prediction?'",
  },
  tolerance: {
    auc24_pct: 25,
    peak_pct: 25,
    trough_pct: 25,
  },
  notes_for_page:
    "Honesty case: Neely 2014 is widely cited as the canonical Bayesian-from-sparse-data exemplar, but the paper does not publish per-patient demographics + AUC. We compare our posterior trough prediction against the cohort median (8.0 mcg/mL) at the observed time-point — a plausibility test only.",
  workflow_type: "existing",
};
