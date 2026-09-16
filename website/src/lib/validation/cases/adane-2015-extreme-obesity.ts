/**
 * Adane 2015: cross-model reference (cohort statistic from a different model).
 *
 * Adane ED, et al. Pharmacotherapy. 2015;35(2):127-139 (abstract): 31 adults
 * with BMI ≥ 40 receiving vancomycin for suspected or confirmed
 * Staphylococcus aureus infection; peak, midpoint and trough concentrations
 * at steady state; one-compartment NONMEM model. Median weight 147.9 kg,
 * BMI 49.5 kg/m², Cockcroft-Gault ClCr 124.8 mL/min/1.73 m² (as reported);
 * median dose 4000 mg/day; median AUC₂₄ 582.9 mg·h/L (IQR 513.8–726.2);
 * population mean V 0.51 L/kg and CL 6.54 L/h.
 *
 * The card shows those cohort values next to the engine's Colin 2019 values
 * for one approximated cohort-median patient. Different model — difference
 * shown for context, not a pass/fail test.
 *
 * Inputs: weight is the published median; height 173 cm gives BMI 49.4.
 * Age 50 years, SCr 0.9 mg/dL and female sex are approximations chosen by
 * Vancomyzer. They have not been verified against the paper's Table 1.
 *
 * Infusion: 2000 mg over 3.5 h keeps the rate at or below 10 mg/min. It does
 * not change steady-state AUC₂₄.
 */

import { COLIN_2019 } from "@/lib/pk/modelRegistry";
import type { PublishedCase } from "../types";

export const ADANE_2015_EXTREME_OBESITY: PublishedCase = {
  id: "adane-2015-extreme-obesity",
  what_it_tests:
    `The published cohort median AUC₂₄ (583 mg·h/L, IQR 514–726) and population clearance (6.54 L/h, one-compartment model) in 31 adults with BMI ≥ 40, next to the engine's ${COLIN_2019.shortName} values for one approximated cohort-median patient at 2000 mg every 12 h.`,
  source: {
    citation:
      "Adane ED, Herald M, Koura F. Pharmacokinetics of Vancomycin in Extremely Obese Patients with Suspected or Confirmed Staphylococcus aureus Infections. Pharmacotherapy. 2015;35(2):127-139",
    doi: "10.1002/phar.1531",
    url: "https://doi.org/10.1002/phar.1531",
    specific_reference: "Adane 2015 abstract — cohort median AUC₂₄ and population clearance, BMI ≥ 40 (different model)",
    verified: true,
    verification_note:
      "Cohort values checked against the PubMed abstract (PMID 25644478): n = 31, median weight 147.9 kg, BMI 49.5 kg/m², Cockcroft-Gault ClCr 124.8 mL/min/1.73 m², median dose 4000 mg/day, median AUC₂₄ 582.9 mg·h/L (IQR 513.8–726.2), population mean V 0.51 L/kg and CL 6.54 L/h. The abstract also states that 24-hour urine creatinine clearance was collected. Patient-level values (Table 1) were not checked.",
  },
  patient: {
    age_years: 50,
    weight_kg: 147.9,
    serum_creatinine_mg_dl: 0.9,
    sex: "F",
    height_cm: 173,
    indication: "Suspected or confirmed Staphylococcus aureus infection",
    inputs_status: "approximated",
    notes:
      "Weight (147.9 kg) is the published cohort median; height 173 cm gives BMI 49.4 (published median 49.5). Age 50 years, SCr 0.9 mg/dL and female sex are approximations chosen by Vancomyzer and have not been verified against the paper.",
  },
  regimen: {
    dose_mg: 2000,
    interval_hours: 12,
    infusion_duration_hours: 3.5,
    doses_given: 6,
  },
  levels: [],
  published: {
    auc24_mg_h_l: 582.9,
    auc24_range: { low: 513.8, high: 726.2, description: "interquartile range" },
    peak_mcg_ml: null,
    trough_mcg_ml: null,
    clearance_l_h: 6.54,
    v1_l: null,
    source_kind: "cohort_summary",
    extraction_method:
      "Median AUC₂₄ 582.9 mg·h/L (IQR 513.8–726.2) at a median dose of 4000 mg/day, and population mean CL 6.54 L/h from a one-compartment model, read from the abstract. These summarize the cohort; they are not values for this card's inputs.",
    tolerance_rationale: "Not applicable: cross-model reference (cohort statistic, different model), no pass/fail.",
  },
  comparison_kind: "cross_model_reference",
  tolerance: null,
  notes_for_page:
    "Adane 2015 measured three steady-state concentrations per patient in 31 adults with BMI ≥ 40 at one hospital and fitted a one-compartment model. The published AUC and CL summarize that cohort, while the engine value is for one approximated patient, so they are not expected to match and the difference is not a test of accuracy.",
  workflow_type: "prior_at_regimen",
};
