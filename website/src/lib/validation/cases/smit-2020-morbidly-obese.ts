/**
 * Smit 2020 — morbidly obese adult prior reproduction.
 *
 * Tests the Vancomyzer Obesity Model branch (Smit 2020 + Zhang 2024 +
 * Janmahasatian FFM) against the Smit 2020 derivation paper's predicted
 * clearance for a 130 kg adult.
 *
 * Source: Smit C et al. Br J Clin Pharmacol. 2020;86(2):303-317.
 * Final-model clearance covariate: CL = 5.72 × (TBW/70)^0.535 L/h.
 * For TBW = 130 kg: CL = 5.72 × (130/70)^0.535 ≈ 7.93 L/h.
 *
 * For a 35 mg/kg/day regimen at 130 kg ≈ 4550 mg/day, the population-
 * typical AUC₂₄ = TDD/CL = 4550 / 7.93 ≈ 574 mg·h/L. This sits within
 * the paper's reported target exposure range.
 *
 * The 2275 mg q12h regimen reflects a clinically realistic
 * approximation (TDD 4550 mg) consistent with the paper's dosing
 * simulations for the 130 kg subgroup.
 */

import type { PublishedCase } from "../types";

export const SMIT_2020_MORBIDLY_OBESE: PublishedCase = {
  id: "smit-2020-morbidly-obese",
  what_it_tests:
    "Obesity-model activation: at BMI ~47, our Vancomyzer Obesity Model should produce a CL close to the Smit 2020 covariate prediction (7.93 L/h at 130 kg).",
  source: {
    citation:
      "Smit C, Wasmann RE, Goulooze SC, et al. Population pharmacokinetics of vancomycin in obesity: Finding the optimal dose for (morbidly) obese individuals. Br J Clin Pharmacol. 2020;86(2):303-317",
    doi: "10.1111/bcp.14144",
    url: "https://doi.org/10.1111/bcp.14144",
    specific_reference:
      "Table 2 final-model parameter estimates (CL = 5.72 × (TBW/70)^0.535) + Results section on dosing simulation for the 130 kg subgroup",
    verified: true,
    verification_note:
      "Final-model CL covariate confirmed from PMC7015748 full text. At TBW 130 kg the equation evaluates to 7.93 L/h. Population-typical AUC₂₄ derived analytically as TDD/CL = 4550/7.93 ≈ 574 mg·h/L. Trough midpoint of 10 mcg/mL is taken from the paper's stated 'troughs of 5.7–14.6 correspond to target exposure' Results sentence.",
  },
  patient: {
    age_years: 35,
    weight_kg: 130,
    serum_creatinine_mg_dl: 0.8,
    sex: "F",
    height_cm: 165,
    indication: "Skin/soft-tissue infection in morbidly obese adult",
    notes:
      "Population-typical morbidly obese individual from Smit 2020 simulations (TBW 130 kg, normal renal function, BMI ≈ 47.7).",
  },
  regimen: {
    dose_mg: 2275,
    interval_hours: 12,
    infusion_duration_hours: 2.0,
    doses_given: 6,
  },
  levels: [],
  published: {
    auc24_mg_h_l: 574,
    peak_mcg_ml: null,
    // Smit's "10 mcg/mL" came from the prose statement "troughs of 5.7–14.6
    // correspond to the target exposure" — that's a range midpoint reflecting
    // population variability, not a point prediction at this specific regimen
    // and patient. Comparing our point-predicted trough against it would be
    // misleading on a credibility page, so we deliberately omit trough from
    // this card and compare AUC₂₄ only, which IS a defensible point match.
    trough_mcg_ml: null,
    clearance_l_h: 7.93,
    v1_l: null,
    source_kind: "population_simulation",
    extraction_method:
      "CL evaluated from the published Smit 2020 covariate equation: 5.72 × (130/70)^0.535 ≈ 7.93 L/h. AUC₂₄ derived as TDD/CL = 4550/7.93. Trough was intentionally omitted from comparison because the paper reports only a range midpoint, not a regimen-specific prediction.",
    tolerance_rationale:
      "Wide tolerance (35% AUC) is required because the Vancomyzer Obesity Model composes Smit 2020 with Zhang 2024 refinements and Janmahasatian FFM scaling — it is intentionally NOT pure Smit. The realized delta against pure Smit is about -25% (our composite produces a higher CL and lower AUC at 130 kg) and this case exists to make that principled drift visible and bounded, not to claim point reproduction. Catastrophic drift (>35%) would indicate the composite has broken; modest drift (10–30%) is the by-design behavior.",
  },
  tolerance: {
    auc24_pct: 35,
    peak_pct: 25,
    trough_pct: 25,
  },
  notes_for_page:
    "Visible by design: our Vancomyzer Obesity Model composes Smit 2020 with Zhang 2024 + Janmahasatian FFM, so it produces a higher CL (~25% AUC lower) than pure Smit at 130 kg/normal renal function. We publish that drift here transparently. The wide tolerance bounds catastrophic regression; the modest realized delta IS the documented design.",
  workflow_type: "prior_at_regimen",
};
