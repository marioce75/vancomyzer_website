/**
 * Patanwala 2022 — multi-platform Bayesian comparison (reference-band card).
 *
 * 188 adult ICU patients, 466 AUC₂₄ estimations. Each concentration was fed
 * through three popPK models inside the Tucuxi software platform:
 *   - Goti 2018       (mean AUC₂₄ 469 ± 148 mg·h/L)
 *   - Colin 2019      (mean AUC₂₄ 562 ± 172 mg·h/L) — the model Vancomyzer uses for dosing
 *   - Thomson 2009    (mean AUC₂₄ 517 ± 164 mg·h/L)
 *
 * Three-way agreement on AUC dosing category was 48% (223/466). Pairwise
 * agreement: Goti-Colin 59%, Goti-Thomson 68%, Colin-Thomson 67%. The choice
 * of model changed the AUC dosing category for the same measured
 * concentrations in a substantial share of estimations.
 *
 * This is a REFERENCE-BAND card: Vancomyzer was not run on this cohort (the
 * 188-patient dataset is not available to us). The card shows published
 * values only, including the published results for Colin 2019, the model
 * Vancomyzer uses for dosing.
 *
 * Source: Patanwala AE et al. Crit Care Res Pract. 2022;2022:7011376.
 */

import { COLIN_2019 } from "@/lib/pk/modelRegistry";
import type { PublishedCase } from "../types";

export const PATANWALA_2022_MULTI_PLATFORM: PublishedCase = {
  id: "patanwala-2022-multi-platform",
  what_it_tests:
    "Published context: three population models run in one Bayesian program (Tucuxi) gave cohort-mean AUC₂₄ values from 469 to 562 mg·h/L for the same 188 ICU adults, and agreed on the AUC dosing category in 48% of estimations. Vancomyzer was not run on this cohort.",
  source: {
    citation:
      "Patanwala AE, Spremo D, Jeon M, Thoma Y, Alffenaar JC, Stocker S. Discrepancies Between Bayesian Vancomycin Models Can Affect Clinical Decisions in the Critically Ill. Crit Care Res Pract. 2022;2022:7011376",
    doi: "10.1155/2022/7011376",
    url: "https://doi.org/10.1155/2022/7011376",
    specific_reference:
      "Patanwala 2022 (abstract, Table 1, section 3.2) — three population models in 188 ICU adults",
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
    inputs_status: "not_applicable",
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
    source_kind: "cohort_summary",
    extraction_method: "Per-model cohort means and SDs read from the Results (section 3.2); rendered directly.",
    tolerance_rationale: "Not applicable: reference band, no engine run, no pass/fail.",
  },
  comparison_kind: "reference_band",
  tolerance: null,
  notes_for_page:
    "Same 188 ICU patients and 466 AUC₂₄ estimations, three population models. Cohort-mean AUC₂₄ ranged from 469 (Goti) to 562 (Colin), about 20% apart, and the three models agreed on the AUC dosing category in 48% of estimations (pairwise 59–68%). The choice of model can change dosing decisions.",
  workflow_type: "reference_band",
  reference_band: {
    cohort_description:
      "188 adult ICU patients · 466 AUC₂₄ estimations · mean age 58 ± 17 y · 63% male · APACHE III 62 ± 22 · 39% mechanically ventilated · 35% on vasopressors · Royal Prince Alfred Hospital, Sydney, 2019-2020",
    platforms: [
      { name: "Goti 2018 (via Tucuxi)", mean_auc24_mg_h_l: 469, sd_auc24_mg_h_l: 148 },
      {
        name: `${COLIN_2019.shortName} (via Tucuxi)`,
        mean_auc24_mg_h_l: 562,
        sd_auc24_mg_h_l: 172,
        notes: "Model Vancomyzer uses for dosing",
        is_vancomyzer_prior: true,
      },
      { name: "Thomson 2009 (via Tucuxi)", mean_auc24_mg_h_l: 517, sd_auc24_mg_h_l: 164 },
    ],
    our_position:
      `Vancomyzer uses ${COLIN_2019.shortName} for dosing. This card shows published values only. Vancomyzer was not run on this cohort, so how its estimates would compare with these results is not known.`,
  },
};
