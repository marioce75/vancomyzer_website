/**
 * Colin 2019: typical-adult reproduction (same model as the engine).
 *
 * Source: Colin PJ, et al. Clin Pharmacokinet. 2019;58(6):767-780, abstract:
 * a 35-year-old, 70-kg patient with a serum creatinine of 0.83 mg/dL has
 * V1 42.9 L, V2 41.7 L, CL 4.10 L/h and Q 3.22 L/h.
 *
 * The case compares the engine's Colin 2019 prior for that patient with the
 * published CL and V1, and with the steady-state AUC₂₄ the published CL
 * implies at 1000 mg every 12 h: AUC₂₄ = 2000 mg / 4.10 L/h = 487.8 mg·h/L.
 * Steady-state AUC₂₄ depends only on the daily dose and CL, so the infusion
 * duration (2 h, keeping the rate at or below 10 mg/min) does not change it.
 */

import { COLIN_2019 } from "@/lib/pk/modelRegistry";
import type { PublishedCase } from "../types";

// Literal values from the Colin 2019 abstract on purpose: expected values must not
// move if someone edits the model registry the engine reads.
const PUBLISHED_CL_L_H = 4.1;
const PUBLISHED_V1_L = 42.9;
const DAILY_DOSE_MG = 2000;

export const COLIN_2019_TYPICAL_ADULT: PublishedCase = {
  id: "colin-2019-typical-adult",
  what_it_tests:
    `The engine's ${COLIN_2019.shortName} prior for the published typical adult (35 y, 70 kg, SCr 0.83 mg/dL) should match the published CL (4.10 L/h), V1 (42.9 L) and the AUC₂₄ that CL implies at 1000 mg every 12 h, each within 1%.`,
  source: {
    citation: COLIN_2019.citation,
    doi: COLIN_2019.doi,
    url: `https://doi.org/${COLIN_2019.doi}`,
    specific_reference: `${COLIN_2019.shortName}, abstract — typical adult (35 y, 70 kg, SCr 0.83 mg/dL)`,
    verified: true,
    verification_note:
      "V1 42.9 L, V2 41.7 L, CL 4.10 L/h and Q 3.22 L/h for a 35-year-old, 70-kg patient with SCr 0.83 mg/dL are stated in the abstract (PMID 30656565). AUC₂₄ is derived as daily dose divided by the published CL.",
  },
  patient: {
    age_years: 35,
    weight_kg: 70,
    serum_creatinine_mg_dl: 0.83,
    sex: "M",
    height_cm: null,
    indication: "Illustrative",
    inputs_status: "published",
    notes:
      "Model-typical individual from the Colin 2019 abstract, not a real patient. Colin 2019 has no sex covariate; sex is entered only because the calculator asks for it.",
  },
  regimen: {
    dose_mg: 1000,
    interval_hours: 12,
    infusion_duration_hours: 2.0,
    doses_given: 4,
  },
  levels: [],
  published: {
    auc24_mg_h_l: Math.round((DAILY_DOSE_MG / PUBLISHED_CL_L_H) * 10) / 10, // 487.8
    peak_mcg_ml: null,
    trough_mcg_ml: null,
    clearance_l_h: PUBLISHED_CL_L_H,
    v1_l: PUBLISHED_V1_L,
    source_kind: "model_typical_value",
    extraction_method:
      "CL and V1 read from the published abstract. AUC₂₄ derived from the published CL: 2000 mg/day / 4.10 L/h = 487.8 mg·h/L.",
    tolerance_rationale:
      "±1% on CL, V1 and AUC₂₄. The published values come from the same equations the engine implements, so the only expected difference is rounding of the published values (CL 4.10 L/h is rounded to about ±0.12%). A larger difference means the implementation changed and must be investigated.",
  },
  comparison_kind: "same_model_reproduction",
  tolerance: {
    auc24_pct: 1,
    peak_pct: 1,
    trough_pct: 1,
    clearance_pct: 1,
    v1_pct: 1,
  },
  notes_for_page:
    "Same model as the engine. The published values describe a model-typical individual, not a real patient, so this checks that the equations are implemented as published; it does not test clinical accuracy.",
  workflow_type: "prior_at_regimen",
};
