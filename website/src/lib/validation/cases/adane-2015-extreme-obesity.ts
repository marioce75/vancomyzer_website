/**
 * Adane 2015 — extreme obesity, real measured AUC.
 *
 * 31 BMI ≥40 adults with suspected/confirmed Staph aureus infection,
 * dosed to clinical practice (median 4 g/day), sampled at steady state
 * with measured 24-h urine creatinine clearance. The cohort median
 * AUC₂₄ was 583 mg·h/L (IQR 514–726). This is one of the few
 * vancomycin papers that publishes a real measured AUC (not a
 * population-typical simulation), making it a much stronger
 * reproducibility test than purely simulation-derived cases.
 *
 * We use the cohort-median patient as the test point. Real per-patient
 * demographics are in the paper's Table 1, behind paywall. The
 * demographics chosen (50y/F/147.9kg/SCr 0.9/173cm) approximate the
 * cohort's published medians (BMI 49.5, ClCr 124.8 mL/min via 24-h
 * urine — note: Cockcroft-Gault on these inputs gives ~175 mL/min,
 * which differs from the paper's measured ClCr because C-G overestimates
 * in obesity; that's exactly why measured ClCr was used in the paper).
 *
 * Source: Adane ED et al. Pharmacotherapy. 2015;35(2):127-139.
 */

import type { PublishedCase } from "../types";

export const ADANE_2015_EXTREME_OBESITY: PublishedCase = {
  id: "adane-2015-extreme-obesity",
  what_it_tests:
    "Real-patient cohort obesity test: cohort-median AUC₂₄ of 583 mg·h/L (IQR 514–726) from 31 prospectively sampled BMI ≥40 adults. Our Vancomyzer Obesity Model should land inside the published IQR.",
  source: {
    citation:
      "Adane ED, Herald M, Koura F. Pharmacokinetics of Vancomycin in Extremely Obese Patients with Suspected or Confirmed Staphylococcus aureus Infections. Pharmacotherapy. 2015;35(2):127-139",
    doi: "10.1002/phar.1531",
    url: "https://doi.org/10.1002/phar.1531",
    specific_reference:
      "Results — n=31 BMI ≥40 adults; median TBW 147.9 kg, BMI 49.5; measured 24-h urine ClCr 124.8 mL/min/1.73m²; median dose 4000 mg/day; measured cohort-median AUC₂₄ 582.9 mg·h/L (IQR 513.8–726.2); NONMEM popPK CL 6.54 L/h, V 0.51 L/kg",
    verified: true,
    verification_note:
      "All numbers verified verbatim from the PMID 25644478 abstract. Prospective cohort with steady-state sampling and 24-h urine ClCr — this is a real measured AUC, not a simulation.",
  },
  patient: {
    age_years: 50,
    weight_kg: 147.9,
    serum_creatinine_mg_dl: 0.9,
    sex: "F",
    height_cm: 173,
    indication: "Suspected or confirmed Staphylococcus aureus infection",
    notes:
      "Cohort-median patient — age and SCr are approximations of the paper's reported medians; the published cohort had a 24-h urine measured ClCr of 124.8 mL/min/1.73m² that Cockcroft-Gault would overestimate at this weight (exactly why the paper used measured ClCr). Real per-patient demographics are in the paper's Table 1.",
  },
  regimen: {
    dose_mg: 2000,
    interval_hours: 12,
    infusion_duration_hours: 1.5,
    doses_given: 6,
  },
  levels: [],
  published: {
    auc24_mg_h_l: 582.9,
    peak_mcg_ml: null,
    trough_mcg_ml: null,
    clearance_l_h: 6.54,
    v1_l: null,
    source_kind: "individual_observed",
    extraction_method:
      "Cohort-median AUC₂₄ (582.9 mg·h/L) and population PK parameters (V = 0.51 L/kg → ~75 L; CL = 6.54 L/h) read verbatim from the PMID 25644478 abstract. AUC is the measured/NONMEM-derived value at the cohort median, not an analytic TDD/CL.",
    tolerance_rationale:
      "±25% AUC. The Vancomyzer Obesity Model is a composite (Smit + Zhang 2024 + Janmahasatian FFM); Adane is a pure one-compartment NONMEM fit with TBW on V and ClCr on CL. The published IQR (513.8–726.2 mg·h/L) corresponds to roughly ±22% around 583, so a 25% tolerance bounds the published cohort variability while still flagging catastrophic engine drift.",
  },
  tolerance: {
    auc24_pct: 25,
    peak_pct: 30,
    trough_pct: 30,
  },
  notes_for_page:
    "Real prospective cohort: 31 BMI ≥40 adults sampled at steady state with measured 24-h urine ClCr. Median AUC₂₄ 583 mg·h/L (published IQR 514–726). Our obesity-model branch should land inside the published IQR for a cohort-median patient at 2 g q12h.",
  workflow_type: "prior_at_regimen",
};
