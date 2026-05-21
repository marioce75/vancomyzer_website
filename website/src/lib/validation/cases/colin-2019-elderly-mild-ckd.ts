/**
 * Colin 2019 — elderly mild-CKD prior reproduction.
 *
 * Verbatim from Colin PJ et al. Clin Pharmacokinet. 2019;58(6):767-780,
 * page 8: "According to our model, typical vancomycin clearance in a
 * 60-year-old, 65-kg patient with a SCR of 0.97 mg dL⁻¹ (85.7 μmol·L⁻¹)
 * is 2.55 L h⁻¹ (0.039 L·h⁻¹·kg⁻¹)."
 *
 * This is a separately-published verifiable number — a specific
 * elderly + mild-renal-impairment patient with a stated clearance
 * value. It tests our engine's composition of the Colin 2019 FDecline
 * age function (50% CL decline by 61.6 years) with the FSCR renal
 * function, on top of the size-allometric scaling.
 *
 * Tests:
 *   - Implementation correctness of FDecline at age 60 (predicted CL
 *     should be ~50% of the typical young-adult max)
 *   - Implementation correctness of FSCR at SCr 0.97 vs reference 0.83
 *   - Allometric size scaling at 65 kg (slightly below the 70 kg
 *     reference weight)
 *
 * Picked regimen 750 mg q12h × 5 doses (TDD 1500 mg/day) because at
 * the published CL of 2.55 L/h this lands AUC₂₄ = 1500 / 2.55 ≈ 588
 * mg·h/L — within the target band, defensibly close to the AUC₂₄ mid
 * (500) but on the upper end where elderly mild-CKD patients commonly
 * sit. A more aggressive regimen would push us above the 650 cap and
 * trip the safety wrapper, which is itself the correct behavior but
 * defeats the reproducibility-test purpose of this card.
 */

import type { PublishedCase } from "../types";

export const COLIN_2019_ELDERLY_MILD_CKD: PublishedCase = {
  id: "colin-2019-elderly-mild-ckd",
  what_it_tests:
    "Implementation correctness of FDecline × FSCR composition at age 60 with SCr 0.97 mg/dL — verifies the engine's age-decline function (50% CL by 61.6y) and SCr covariate compose correctly against Colin 2019's published per-patient clearance.",
  source: {
    citation:
      "Colin PJ, Allegaert K, Thomson AH, et al. Vancomycin Pharmacokinetics Throughout Life: Results from a Pooled Population Analysis and Evaluation of Current Dosing Recommendations. Clin Pharmacokinet. 2019;58(6):767-780",
    doi: "10.1007/s40262-018-0727-5",
    url: "https://doi.org/10.1007/s40262-018-0727-5",
    specific_reference:
      "Page 8, Section 4 Discussion: verbatim text describing predicted CL for a 60y/65kg/SCr 0.97 mg/dL patient",
    verified: true,
    verification_note:
      "Verified directly from the open Colin 2019 PDF (Section 4 Discussion, page 8). Exact quote: \"vancomycin clearance in a 60-year-old, 65-kg patient with a SCR of 0.97 mg dL⁻¹ (85.7 μmol L⁻¹) is 2.55 L h⁻¹ (0.039 L h⁻¹ kg⁻¹).\" This is a separately-published per-patient point estimate, not derived from the cohort means in Table 3.",
  },
  patient: {
    age_years: 60,
    weight_kg: 65,
    serum_creatinine_mg_dl: 0.97,
    sex: "M",
    height_cm: null,
    indication: "MRSA bacteremia (illustrative)",
    notes:
      "Population-typical elderly patient with mild renal impairment from Colin 2019's discussion text. Sex not specified by the paper — assumed male by Colin's convention. Height not specified.",
  },
  regimen: {
    dose_mg: 750,
    interval_hours: 12,
    infusion_duration_hours: 1.5,
    doses_given: 5,
  },
  levels: [],
  published: {
    auc24_mg_h_l: 588.2,
    peak_mcg_ml: null,
    trough_mcg_ml: null,
    clearance_l_h: 2.55,
    v1_l: null,
    source_kind: "population_simulation",
    extraction_method:
      "AUC₂₄ derived analytically from the paper's verbatim published CL: TDD/CL = (750 × 24/12) / 2.55 = 1500 / 2.55 ≈ 588.2 mg·h/L. The CL value itself (2.55 L/h) is read verbatim from page 8.",
    tolerance_rationale:
      "Tight ±5% AUC. The published CL is a deterministic function of our engine's covariate equations — implementation correctness should match within rounding. If drift exceeds 5%, either the FDecline curve or the FSCR covariate has regressed against the Colin 2019 published equations.",
  },
  tolerance: {
    auc24_pct: 5,
    peak_pct: 15,
    trough_pct: 20,
  },
  notes_for_page:
    "Verifies our engine's composition of the Colin 2019 age-decline (FDecline, 50% at 61.6y) and SCr (FSCR) covariates on top of size-allometric scaling. At 60y/65kg/SCr 0.97, Colin published CL = 2.55 L/h verbatim — at 750 mg q12h, AUC₂₄ should land near 588 mg·h/L.",
  workflow_type: "prior_at_regimen",
};
