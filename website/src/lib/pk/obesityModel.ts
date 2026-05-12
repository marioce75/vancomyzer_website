/**
 * Vancomyzer Obesity Model — FFM-Based PK for BMI ≥ 40 kg/m²
 *
 * This module provides:
 * 1. BMI calculation
 * 2. Fat-Free Mass (FFM) calculation (Janmahasatian 2005)
 * 3. Obesity-specific population PK parameters (derived from Smit 2020 + Zhang 2023)
 * 4. Model selection logic
 *
 * References:
 * - Janmahasatian S et al. Clin Pharmacokinet. 2005;44(10):1051-65. DOI: 10.2165/00003088-200544100-00004
 * - Smit C et al. Br J Clin Pharmacol. 2020;86(2):303-317. DOI: 10.1111/bcp.14144
 * - Zhang T et al. Clin Pharmacokinet. 2024;63:79-91. DOI: 10.1007/s40262-023-01324-5
 *
 * IMPORTANT: This model does NOT replace Colin 2019 for non-obese patients.
 * It activates ONLY when BMI ≥ 40 kg/m².
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BMI_OBESITY_THRESHOLD = 40;

// ---------------------------------------------------------------------------
// BMI Calculation
// ---------------------------------------------------------------------------

export function calculateBMI(weight_kg: number, height_cm: number): number {
  if (weight_kg <= 0 || height_cm <= 0) return 0;
  const height_m = height_cm / 100;
  return weight_kg / (height_m * height_m);
}

// ---------------------------------------------------------------------------
// Fat-Free Mass — Janmahasatian 2005 (public domain equations)
// ---------------------------------------------------------------------------

/**
 * Calculate Fat-Free Mass (FFM) using the Janmahasatian 2005 equations.
 *
 * Male:   FFM = (9270 × TBW) / (6680 + 216 × BMI)
 * Female: FFM = (9270 × TBW) / (8780 + 244 × BMI)
 *
 * Reference: Janmahasatian S et al. Clin Pharmacokinet. 2005;44(10):1051-65.
 * DOI: 10.2165/00003088-200544100-00004
 */
export function calculateFFM(weight_kg: number, height_cm: number, sex: "male" | "female"): number {
  if (weight_kg <= 0 || height_cm <= 0) return 0;
  const bmi = calculateBMI(weight_kg, height_cm);
  if (bmi <= 0) return 0;

  if (sex === "male") {
    return (9270 * weight_kg) / (6680 + 216 * bmi);
  } else {
    return (9270 * weight_kg) / (8780 + 244 * bmi);
  }
}

// ---------------------------------------------------------------------------
// Cockcroft-Gault CrCl (using TBW — standard for obesity dosing)
// ---------------------------------------------------------------------------

export function calculateCrCl(
  age: number,
  weight_kg: number,
  scr_mg_dl: number,
  sex: "male" | "female"
): number {
  if (age <= 0 || weight_kg <= 0 || scr_mg_dl <= 0) return 0;
  const base = ((140 - age) * weight_kg) / (72 * scr_mg_dl);
  return sex === "female" ? base * 0.85 : base;
}

// ---------------------------------------------------------------------------
// Obesity Model PK Parameters
// ---------------------------------------------------------------------------

export interface ObesityPKPriors {
  CL: number;
  V1: number;
  Q: number;
  V2: number;
  /** Age-decline factor applied to CL. 1.0 for very young adults; approaches
   *  zero as age increases past ~80. Exposed so the UI can show the
   *  pre/post-decline CL values for clinical transparency. */
  fdecline_factor: number;
  /** CL before FDecline was applied — useful for the multi-method comparison
   *  display when the clinician wants to see the underlying Smit/Zhang
   *  formula output. */
  CL_before_fdecline: number;
}

/**
 * Colin 2019's age-decline function — applied here to bridge the obesity-model
 * literature gap. Smit 2020 and Zhang 2024 derived their CL formula on cohorts
 * that under-represented geriatric obese patients, so applying their formula
 * without an age-decline factor over-predicts CL in elderly obese patients.
 * FDecline is a separate physiological covariate independent of body habitus
 * (geriatric renal decline beyond what SCr alone captures, especially in
 * sarcopenic obesity) and can be safely composed with the Smit/Zhang CL
 * scaling. Sigmoid form approaches 1.0 for younger adults and ~0.4 at age 70.
 *
 *   FDecline = 1 / (1 + (age / 61.6)^2.24)
 *
 * Source: Colin PJ et al. Clin Pharmacokinet. 2019;58(6):767-780. Eq 12.
 */
function obesityFDecline(age: number): number {
  if (age <= 0) return 1.0;
  return 1 / (1 + Math.pow(age / 61.6, 2.24));
}

/**
 * Calculate population PK priors for the Vancomyzer Obesity Model.
 *
 * CL = (0.0571 × CrCl + 0.0158 × TBW) × FDecline(age)
 *      [Smit/Zhang body-scaling × Colin 2019 age-decline]
 * V1 = 0.287 × FFM                       [FFM — adipose excluded]
 * Q  = 1.23 L/h                           [fixed intercompartmental clearance]
 * V2 = 0.89 × FFM                        [FFM — adipose excluded]
 *
 * Derived from:
 * - Smit C et al. Br J Clin Pharmacol. 2020;86(2):303-317. DOI: 10.1111/bcp.14144
 * - Zhang T et al. Clin Pharmacokinet. 2024;63:79-91. DOI: 10.1007/s40262-023-01324-5
 * - Colin PJ et al. Clin Pharmacokinet. 2019;58(6):767-780. DOI: 10.1007/s40262-018-0727-5
 *   (age-decline composition)
 */
export function buildObesityPriors(
  age: number,
  weight_kg: number,
  height_cm: number,
  scr_mg_dl: number,
  sex: "male" | "female"
): ObesityPKPriors {
  const ffm = calculateFFM(weight_kg, height_cm, sex);
  const crcl = calculateCrCl(age, weight_kg, scr_mg_dl, sex);

  const baseCL = 0.0571 * crcl + 0.0158 * weight_kg;
  const fdecline = obesityFDecline(age);
  const CL = Math.max(0.5, baseCL * fdecline);
  const V1 = Math.max(5, 0.287 * ffm);
  const Q  = 1.23;
  const V2 = Math.max(5, 0.89 * ffm);

  return {
    CL,
    V1,
    Q,
    V2,
    fdecline_factor: fdecline,
    CL_before_fdecline: Math.max(0.5, baseCL),
  };
}

/**
 * Multi-method CrCl comparison for the obesity advisory panel.
 *
 * In obese geriatric patients the three Cockcroft-Gault variants can disagree
 * by 2-3× (e.g., 70F 127kg SCr 1.65: CG-TBW=64, CG-AdjBW=43, CG-FFM=29). Our
 * obesity-model CL uses CG-TBW (Smit/Zhang convention) but clinicians need to
 * see all three to judge whether the post-FDecline CL is appropriate or
 * whether a manual override is warranted.
 *
 * AdjBW = IBW + 0.4 × (TBW − IBW) — standard obese-adjustment used in clinical
 * practice. IBW (Devine 1974, lb→kg): 50 kg (M) or 45.5 kg (F) baseline + 2.3 kg
 * per inch over 60 inches.
 */
export interface CrClBreakdown {
  cg_tbw_ml_min: number;
  cg_adjbw_ml_min: number;
  cg_ffm_ml_min: number;
  ibw_kg: number;
  adjbw_kg: number;
  ffm_kg: number;
}

export function buildCrClBreakdown(
  age: number,
  weight_kg: number,
  height_cm: number,
  scr_mg_dl: number,
  sex: "male" | "female",
): CrClBreakdown {
  const ffm = calculateFFM(weight_kg, height_cm, sex);
  const height_in = height_cm / 2.54;
  const ibw_base = sex === "male" ? 50 : 45.5;
  const ibw_kg = Math.max(0, ibw_base + 2.3 * Math.max(0, height_in - 60));
  const adjbw_kg = weight_kg > ibw_kg ? ibw_kg + 0.4 * (weight_kg - ibw_kg) : weight_kg;

  const cgFor = (w: number): number => {
    if (age <= 0 || w <= 0 || scr_mg_dl <= 0) return 0;
    const base = ((140 - age) * w) / (72 * scr_mg_dl);
    return Math.max(0, sex === "female" ? base * 0.85 : base);
  };

  return {
    cg_tbw_ml_min: cgFor(weight_kg),
    cg_adjbw_ml_min: cgFor(adjbw_kg),
    cg_ffm_ml_min: cgFor(ffm),
    ibw_kg,
    adjbw_kg,
    ffm_kg: ffm,
  };
}

// ---------------------------------------------------------------------------
// IIV (Inter-Individual Variability) — omega values for Bayesian priors
// Used as prior log-SDs in the MAP estimation
// ---------------------------------------------------------------------------

export const OBESITY_OMEGA = {
  CL: 0.29,  // 29% IIV on CL (Smit 2020 Table 2)
  V1: 0.32,  // 32% IIV on V1
  Q:  0.50,  // Fixed — same as Colin 2019 (not estimated in Smit 2020)
  V2: 0.28,  // 28% IIV on V2
};

// ---------------------------------------------------------------------------
// Model Selection
// ---------------------------------------------------------------------------

export type PKModelName = "colin_2019" | "vancomyzer_obesity";

export function selectPKModel(bmi: number): PKModelName {
  if (bmi >= BMI_OBESITY_THRESHOLD) {
    return "vancomyzer_obesity";
  }
  return "colin_2019";
}

// ---------------------------------------------------------------------------
// Model Metadata (for display)
// ---------------------------------------------------------------------------

export const OBESITY_MODEL_META = {
  name: "Vancomyzer Obesity Model",
  label: "Vancomyzer Obesity Model — derived from Smit 2020 + Zhang 2023",
  shortLabel: "Obesity Model (BMI ≥ 40)",
  population: "Adults with BMI ≥ 40 kg/m²",
  references: [
    {
      citation: "Smit C et al. Br J Clin Pharmacol. 2020;86(2):303-317.",
      doi: "10.1111/bcp.14144",
    },
    {
      citation: "Zhang T et al. Clin Pharmacokinet. 2024;63:79-91.",
      doi: "10.1007/s40262-023-01324-5",
    },
    {
      citation: "Janmahasatian S et al. Clin Pharmacokinet. 2005;44(10):1051-65. [FFM equations]",
      doi: "10.2165/00003088-200544100-00004",
    },
  ],
};
