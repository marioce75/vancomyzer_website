/**
 * Patanwala 2022 — multi-platform Bayesian comparison (reference-band card).
 *
 * 188 adult ICU patients, 466 AUC₂₄ estimations. Each concentration was fed
 * through three popPK models inside the Tucuxi software platform:
 *   - Goti 2018       (mean AUC₂₄ 469 ± 148 mg·h/L)
 *   - Colin 2019      (mean AUC₂₄ 562 ± 172 mg·h/L) — Vancomyzer's default prior
 *   - Thomson 2009    (mean AUC₂₄ 517 ± 164 mg·h/L)
 *
 * Three-way agreement on AUC dosing category was 48% (223/466). Pairwise
 * agreement: Goti-Colin 59%, Goti-Thomson 68%, Colin-Thomson 67%. The paper's
 * headline finding: clinicians come to different dosing decisions in ~1 of 3
 * ICU patients depending on which popPK model is used, even from the same
 * measured concentrations.
 *
 * This is a REFERENCE-BAND card — Vancomyzer is not in the comparison loop
 * (we don't have access to the 188-patient dataset and couldn't run our
 * engine against it per-patient). The card exists to surface industry-wide
 * platform-choice variance and to show clinicians where Vancomyzer's prior
 * (Colin) sits relative to the alternatives.
 *
 * Source: Patanwala AE et al. Crit Care Res Pract. 2022;2022:7011376.
 */

import type { PublishedCase } from "../types";

export const PATANWALA_2022_MULTI_PLATFORM: PublishedCase = {
  id: "patanwala-2022-multi-platform",
  what_it_tests:
    "Industry-context: three popPK models inside one Bayesian platform (Tucuxi) produce AUC₂₄ estimates that differ by ~20% on the same 188 ICU adults — the choice of model alone changes dosing decisions in 1 of 3 cases.",
  source: {
    citation:
      "Patanwala AE, Spremo D, Jeon M, Thoma Y, Alffenaar JC, Stocker S. Discrepancies Between Bayesian Vancomycin Models Can Affect Clinical Decisions in the Critically Ill. Crit Care Res Pract. 2022;2022:7011376",
    doi: "10.1155/2022/7011376",
    url: "https://doi.org/10.1155/2022/7011376",
    specific_reference:
      "Abstract + Table 1 (cohort demographics) + Section 3.2 Main Results (per-model AUC₂₄ means)",
    verified: true,
    verification_note:
      "All per-model cohort means (Goti 469 ± 148, Colin 562 ± 172, Thomson 517 ± 164) verified directly from the open Crit Care Res Pract 2022 PDF: abstract + Results section 3.2. Cohort demographics (n=188, mean age 58 ± 17, 63% male, APACHE III 62 ± 22, 39% ventilated, 35% vasopressors) verified from Table 1. Three-way agreement 48% (223/466) verified from Table 2.",
  },
  // Sentinel values for the engine-run schema — ignored when reference_band is set.
  patient: {
    age_years: 58,
    weight_kg: 75,
    serum_creatinine_mg_dl: 1.0,
    sex: "M",
    height_cm: null,
    indication: "Cohort summary (n=188 ICU adults), not an individual patient",
    notes: "Sentinel patient — reference-band card does not run the engine.",
  },
  regimen: null,
  levels: [],
  published: {
    auc24_mg_h_l: null,
    peak_mcg_ml: null,
    trough_mcg_ml: null,
    clearance_l_h: null,
    v1_l: null,
    source_kind: "population_simulation",
    extraction_method: "n/a — reference-band card; per-platform means rendered directly",
    tolerance_rationale: "n/a — no engine run, no tolerance check",
  },
  tolerance: { auc24_pct: 0, peak_pct: 0, trough_pct: 0 },
  notes_for_page:
    "Same 188 ICU patients, same 466 measured concentrations, three different popPK priors. The cohort-mean AUC₂₄ spans 469 (Goti) to 562 (Colin) — a ~20% inter-model range. Three-way agreement on AUC dosing category was only 48%. Platform choice is itself a clinical decision.",
  workflow_type: "reference_band",
  reference_band: {
    cohort_description:
      "188 adult ICU patients · 466 AUC₂₄ estimations · mean age 58 ± 17 y · 63% male · APACHE III 62 ± 22 · 39% mechanically ventilated · 35% on vasopressors · Royal Prince Alfred Hospital, Sydney, 2019-2020",
    platforms: [
      { name: "Goti 2018 (via Tucuxi)", mean_auc24_mg_h_l: 469, sd_auc24_mg_h_l: 148 },
      {
        name: "Colin 2019 (via Tucuxi)",
        mean_auc24_mg_h_l: 562,
        sd_auc24_mg_h_l: 172,
        notes: "Vancomyzer uses this prior",
        is_vancomyzer_prior: true,
      },
      { name: "Thomson 2009 (via Tucuxi)", mean_auc24_mg_h_l: 517, sd_auc24_mg_h_l: 164 },
    ],
    our_position:
      "Vancomyzer's default adult prior is Colin 2019 — at the cohort level, our engine should produce AUC₂₄ distributions centered near 562 mg·h/L (the Colin band). We do NOT match the Goti or Thomson bands; those are shown to surface the inter-model variance clinicians face when choosing a Bayesian platform.",
  },
};
