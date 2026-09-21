/**
 * Carreno 2017: cross-model reference (cohort result from other models).
 *
 * Carreno JJ, et al. Antimicrob Agents Chemother. 2017;61(5):e02478-16
 * (abstract): 12 obese adults (median age 61 years, median creatinine
 * clearance 86 mL/min, median BMI 45 kg/m²), five concentrations per patient,
 * four population models used as Bayesian priors in ADAPT V. Full-data
 * AUC₂₄ estimates ranged from 437 to 489 mg·h/L across the four analyses.
 * Peak-and-trough estimates approximated the full-data AUC best; trough-only
 * and midpoint-and-trough estimates tended to overestimate it.
 *
 * This card runs the engine's Colin 2019 Bayesian fit on two ILLUSTRATIVE
 * levels for an ILLUSTRATIVE patient and shows the result next to that
 * published range. Different model — difference shown for context, not a
 * pass/fail test. Per-patient data were not available, so the patient
 * values, regimen and levels below were chosen by Vancomyzer and are not
 * from the paper. The range midpoint (463) is derived for display.
 *
 * Infusion: 1250 mg over 2.5 h keeps the rate at or below 10 mg/min; the
 * first level is drawn 1 h after the end of the infusion.
 */

import { COLIN_2019 } from "@/lib/pk/modelRegistry";
import type { PublishedCase } from "../types";

export const CARRENO_2017_SPARSE_BAYESIAN_OBESE: PublishedCase = {
  id: "carreno-2017-sparse-bayesian-obese",
  what_it_tests:
    `The calculator's ${COLIN_2019.shortName} Bayesian AUC₂₄ from two illustrative levels, next to the range of full-data AUC₂₄ estimates (437–489 mg·h/L) that Carreno 2017 reported across four other population models in 12 obese adults.`,
  source: {
    citation:
      "Carreno JJ, Lomaestro B, Tietjan J, Lodise TP. Pilot Study of a Bayesian Approach To Estimate Vancomycin Exposure in Obese Patients with Limited Pharmacokinetic Sampling. Antimicrob Agents Chemother. 2017;61(5):e02478-16",
    doi: "10.1128/AAC.02478-16",
    url: "https://doi.org/10.1128/AAC.02478-16",
    specific_reference: "Carreno 2017 abstract — full-data AUC₂₄ range across four population models, obese adults (different models)",
    verified: true,
    verification_note:
      "Checked against the PubMed abstract (PMID 28289024): n = 12, median age 61 years, median creatinine clearance 86 mL/min (the abstract does not state the method), median BMI 45 kg/m², full-data AUC₂₄ estimates 437–489 mg·h/L across four models. Per-patient data were not available.",
  },
  patient: {
    age_years: 61,
    weight_kg: 130,
    serum_creatinine_mg_dl: 1.0,
    sex: "M",
    height_cm: 170,
    indication: "Suspected or confirmed Gram-positive infection (illustrative)",
    inputs_status: "illustrative",
    notes:
      "Illustrative values chosen by Vancomyzer, not from the paper. Age 61 years and BMI 45 match the published cohort medians; weight, height, sex and SCr do not come from the paper. Cockcroft-Gault with total body weight gives about 143 mL/min for these inputs, not the published median of 86 mL/min.",
  },
  regimen: {
    dose_mg: 1250,
    interval_hours: 12,
    infusion_duration_hours: 2.5,
    doses_given: 5,
  },
  // Illustrative levels chosen by Vancomyzer (not from the paper).
  levels: [
    { value_mcg_ml: 25, time_since_last_dose_hours: 3.5 },
    { value_mcg_ml: 10, time_since_last_dose_hours: 11.5 },
  ],
  published: {
    auc24_mg_h_l: 463,
    auc24_range: { low: 437, high: 489, description: "range of full-data estimates across four population models; 463 is the midpoint, derived for display" },
    peak_mcg_ml: null,
    trough_mcg_ml: null,
    clearance_l_h: null,
    v1_l: null,
    source_kind: "cohort_summary",
    extraction_method:
      "Range of full-data AUC₂₄ estimates (437–489 mg·h/L) read from the abstract; midpoint 463 derived by Vancomyzer. The levels on this card (25 mg/L 3.5 h after the start of the dose, 1 h after the end of a 2.5 h infusion; 10 mg/L at 11.5 h) are illustrative and were chosen by Vancomyzer.",
    tolerance_rationale: "Not applicable: cross-model reference (cohort result from other models, illustrative inputs), no pass/fail.",
  },
  comparison_kind: "cross_model_reference",
  tolerance: null,
  notes_for_page:
    "Carreno 2017 found that Bayesian estimates from a peak and a trough approximated the full-data AUC better than trough-only or midpoint-and-trough estimates. The published range is a cohort result for real patients and other models, while this card's patient values and levels are illustrative, so the difference is context only.",
  workflow_type: "existing",
};
