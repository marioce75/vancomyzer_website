/**
 * Smit 2020: cross-model reference (different model from the engine).
 *
 * Vancomyzer doses every adult with Colin 2019. Smit 2020 is a published
 * three-compartment obesity model that Vancomyzer does NOT implement. This
 * card shows Smit 2020's typical clearance for a 130-kg adult next to the
 * engine's Colin 2019 value for the same inputs. Different model —
 * difference shown for context, not a pass/fail test.
 *
 * Smit 2020 final-model clearance (see PUBLISHED_OBESITY_COMPARATORS in
 * src/lib/pk/modelRegistry.ts): CL (L/h) = 5.72 × (TBW/70)^0.535, with no
 * renal-function or age covariate. At TBW 130 kg: CL = 7.97 L/h, so at
 * 4500 mg/day (2250 mg every 12 h, about 35 mg/kg/day; the usual maximum
 * daily dose in obese adults per the 2020 guideline) the steady-state
 * AUC₂₄ = 4500 / 7.97 = 565 mg·h/L.
 *
 * Infusion: 2250 mg over 4 h keeps the rate at or below 10 mg/min. It does
 * not change steady-state AUC₂₄.
 */

import { COLIN_2019, PUBLISHED_OBESITY_COMPARATORS } from "@/lib/pk/modelRegistry";
import type { PublishedCase } from "../types";

const SMIT_2020 = PUBLISHED_OBESITY_COMPARATORS.find((m) => m.id === "smit_2020")!;

const TBW_KG = 130;
/** Smit 2020 final-model typical clearance, evaluated at the case weight. */
const SMIT_CL_L_H = 5.72 * Math.pow(TBW_KG / 70, 0.535); // 7.966
const DAILY_DOSE_MG = 4500;

export const SMIT_2020_MORBIDLY_OBESE: PublishedCase = {
  id: "smit-2020-morbidly-obese",
  what_it_tests:
    `${SMIT_2020.shortName}'s typical clearance at 130 kg (5.72 × (130/70)^0.535 = ${SMIT_CL_L_H.toFixed(2)} L/h) and the AUC₂₄ it implies at 2250 mg every 12 h, next to the calculator's ${COLIN_2019.shortName} values for the same inputs.`,
  source: {
    citation: SMIT_2020.citation,
    doi: SMIT_2020.doi,
    url: `https://doi.org/${SMIT_2020.doi}`,
    specific_reference: `${SMIT_2020.shortName} final-model clearance at 130 kg (different model)`,
    verified: true,
    verification_note:
      "Final-model clearance equation CL = 5.72 × (TBW/70)^0.535 checked against the PMC7015748 full text. The value for this card is evaluated from that equation at TBW 130 kg.",
  },
  patient: {
    age_years: 35,
    weight_kg: TBW_KG,
    serum_creatinine_mg_dl: 0.8,
    sex: "F",
    height_cm: 165,
    indication: "Illustrative",
    inputs_status: "illustrative",
    notes:
      `Only body weight enters the ${SMIT_2020.shortName} clearance equation. Age, sex, height (BMI 47.8) and SCr were chosen by Vancomyzer to describe a younger adult with normal renal function; they change only the ${COLIN_2019.shortName} value. ${SMIT_2020.shortName} population: ${SMIT_2020.population}`,
  },
  regimen: {
    dose_mg: 2250,
    interval_hours: 12,
    infusion_duration_hours: 4.0,
    doses_given: 6,
  },
  levels: [],
  published: {
    auc24_mg_h_l: Math.round((DAILY_DOSE_MG / SMIT_CL_L_H) * 10) / 10, // 564.9
    peak_mcg_ml: null,
    trough_mcg_ml: null,
    clearance_l_h: Math.round(SMIT_CL_L_H * 100) / 100, // 7.97
    v1_l: null,
    source_kind: "model_typical_value",
    extraction_method:
      "CL evaluated from the Smit 2020 final-model equation at TBW 130 kg: 5.72 × (130/70)^0.535 = 7.97 L/h. AUC₂₄ derived as daily dose / CL = 4500 / 7.97 = 565 mg·h/L.",
    tolerance_rationale: "Not applicable: cross-model reference (different model), no pass/fail.",
  },
  comparison_kind: "cross_model_reference",
  tolerance: null,
  notes_for_page:
    `Vancomyzer does not use ${SMIT_2020.shortName}; it is shown because it is a published obesity model. ${SMIT_2020.shortName} was developed in adults undergoing bariatric surgery with normal renal function and in non-obese volunteers, with no ICU patients. The difference shows how far two published models can disagree for the same weight; it does not show which is more accurate for a given patient.`,
  workflow_type: "prior_at_regimen",
};
