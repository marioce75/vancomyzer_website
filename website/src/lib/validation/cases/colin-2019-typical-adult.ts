/**
 * Colin 2019 — typical-adult prior reproduction.
 *
 * Tests that our two-compartment engine, using the Colin 2019 prior
 * (our default for non-obese adults), reproduces the population-typical
 * clearance reported in the paper for the canonical individual.
 *
 * Source: Colin PJ et al. Clin Pharmacokinet. 2019;58(6):767-780.
 * Typical individual: 35y, 70kg, SCr 0.83 mg/dL.
 * Published structural parameters: CL = 4.10 L/h, V1 = 42.9 L,
 * Q = 3.22 L/h, V2 = 41.7 L (PMID 30656565 abstract — replicated in
 * multiple secondary citations).
 *
 * Published AUC₂₄ is derived analytically from the published CL at
 * steady state: AUC₂₄ = total daily dose / CL = 2000 mg / 4.10 L/h
 * = 487.8 mg·h/L. The case tests whether our engine arrives at the
 * same CL/AUC for the same patient.
 */

import type { PublishedCase } from "../types";

export const COLIN_2019_TYPICAL_ADULT: PublishedCase = {
  id: "colin-2019-typical-adult",
  what_it_tests:
    "Implementation correctness: our engine should reproduce the Colin 2019 typical-adult clearance (4.10 L/h) and the AUC₂₄ it implies at 1 g q12h.",
  source: {
    citation:
      "Colin PJ, Allegaert K, Thomson AH, et al. Vancomycin Pharmacokinetics Throughout Life: Results from a Pooled Population Analysis and Evaluation of Current Dosing Recommendations. Clin Pharmacokinet. 2019;58(6):767-780",
    doi: "10.1007/s40262-018-0727-5",
    url: "https://doi.org/10.1007/s40262-018-0727-5",
    specific_reference:
      "Abstract + Results — structural parameters for the typical individual (35y, 70kg, SCr 0.83 mg/dL)",
    verified: true,
    verification_note:
      "Typical-individual CL=4.10 L/h, V1=42.9 L, V2=41.7 L, Q=3.22 L/h is the verbatim PMID 30656565 abstract and is cited identically across secondary sources. Steady-state AUC derived analytically as TDD/CL.",
  },
  patient: {
    age_years: 35,
    weight_kg: 70,
    serum_creatinine_mg_dl: 0.83,
    sex: "M",
    height_cm: null,
    indication: "MRSA bacteremia (illustrative)",
    notes:
      "Population-typical individual of the Colin 2019 pooled model — not a real patient. Sex is not specified by the paper.",
  },
  regimen: {
    dose_mg: 1000,
    interval_hours: 12,
    infusion_duration_hours: 1.5,
    doses_given: 4,
  },
  levels: [],
  published: {
    auc24_mg_h_l: 487.8,
    peak_mcg_ml: null,
    trough_mcg_ml: null,
    clearance_l_h: 4.10,
    v1_l: 42.9,
    source_kind: "population_simulation",
    extraction_method:
      "AUC₂₄ derived analytically from published CL (TDD/CL = 2000/4.10 = 487.8 mg·h/L). Structural parameters read directly from the published abstract.",
    tolerance_rationale:
      "Tight AUC tolerance is appropriate: the published value is a deterministic function of CL, and our engine uses Colin 2019 as the default prior — any well-implemented version should match within a few percent.",
  },
  tolerance: {
    auc24_pct: 8,
    peak_pct: 15,
    trough_pct: 20,
  },
  notes_for_page:
    "This is a 'reference prior reproduction' test — most popPK papers don't publish per-patient individual cases with full demographics and AUC, so we test against the model's typical-individual output instead. If our AUC₂₄ at this regimen lands within 8% of 488 mg·h/L, the Colin 2019 prior is implemented faithfully.",
  workflow_type: "prior_at_regimen",
};
