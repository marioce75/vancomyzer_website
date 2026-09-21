/**
 * Colin 2019: older adult with mildly reduced renal function (same model as
 * the engine).
 *
 * Source: Colin PJ, et al. Clin Pharmacokinet. 2019;58(6):767-780,
 * Discussion (p. 8): "typical vancomycin clearance in a 60-year-old, 65-kg
 * patient with a SCR of 0.97 mg dL⁻¹ (85.7 μmol L⁻¹) is 2.55 L h⁻¹
 * (0.039 L h⁻¹ kg⁻¹)."
 *
 * This checks how the engine combines the Colin 2019 age-decline term
 * (clearance halved at 61.6 years), the serum creatinine term and weight
 * scaling. The model equations evaluate to about 2.551 L/h for this patient.
 *
 * Regimen: 750 mg every 12 h (1500 mg/day) over 1.5 h (8.3 mg/min). The
 * published CL implies a steady-state AUC₂₄ of 1500 / 2.55 = 588.2 mg·h/L.
 */

import { COLIN_2019 } from "@/lib/pk/modelRegistry";
import type { PublishedCase } from "../types";

const PUBLISHED_CL_L_H = 2.55;
const DAILY_DOSE_MG = 1500;

export const COLIN_2019_ELDERLY_MILD_CKD: PublishedCase = {
  id: "colin-2019-elderly-mild-ckd",
  what_it_tests:
    `The calculator's ${COLIN_2019.shortName} prior for a 60-year-old, 65-kg patient with SCr 0.97 mg/dL should match the published CL (2.55 L/h) and the AUC₂₄ it implies at 750 mg every 12 h, each within 1%. This exercises the age-decline and serum creatinine terms together.`,
  source: {
    citation: COLIN_2019.citation,
    doi: COLIN_2019.doi,
    url: `https://doi.org/${COLIN_2019.doi}`,
    specific_reference: `${COLIN_2019.shortName}, Discussion (p. 8) — 60 y, 65 kg, SCr 0.97 mg/dL`,
    verified: true,
    verification_note:
      "Checked against the open Colin 2019 PDF (Discussion, page 8). Quote: \"vancomycin clearance in a 60-year-old, 65-kg patient with a SCR of 0.97 mg dL⁻¹ (85.7 μmol L⁻¹) is 2.55 L h⁻¹ (0.039 L h⁻¹ kg⁻¹).\"",
  },
  patient: {
    age_years: 60,
    weight_kg: 65,
    serum_creatinine_mg_dl: 0.97,
    sex: "M",
    height_cm: null,
    indication: "Illustrative",
    inputs_status: "published",
    notes:
      "Model-typical patient described in the Colin 2019 Discussion, not a real patient. Colin 2019 has no sex covariate; sex is entered only because the calculator asks for it. Height is not specified.",
  },
  regimen: {
    dose_mg: 750,
    interval_hours: 12,
    infusion_duration_hours: 1.5,
    doses_given: 5,
  },
  levels: [],
  published: {
    auc24_mg_h_l: Math.round((DAILY_DOSE_MG / PUBLISHED_CL_L_H) * 10) / 10, // 588.2
    peak_mcg_ml: null,
    trough_mcg_ml: null,
    clearance_l_h: PUBLISHED_CL_L_H,
    v1_l: null,
    source_kind: "model_typical_value",
    extraction_method:
      "CL (2.55 L/h) read from page 8. AUC₂₄ derived from the published CL: 1500 mg/day / 2.55 L/h = 588.2 mg·h/L.",
    tolerance_rationale:
      "±1% on CL and AUC₂₄. The published CL comes from the same equations the calculator implements; it is rounded to three significant figures (about ±0.2%). A larger difference means the age-decline or serum creatinine term changed and must be investigated.",
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
    "Same model as the calculator. Colin 2019 states CL = 2.55 L/h for this patient; the calculator's equations give about 2.551 L/h. This checks that the age and renal terms are implemented as published; it does not test clinical accuracy.",
  workflow_type: "prior_at_regimen",
};
