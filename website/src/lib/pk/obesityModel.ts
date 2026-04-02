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
}

/**
 * Calculate population PK priors for the Vancomyzer Obesity Model.
 *
 * CL = 0.0571 × CrCl + 0.0158 × TBW   [TBW retained — renal elimination]
 * V1 = 0.287 × FFM                       [FFM — adipose excluded]
 * Q  = 1.23 L/h                           [fixed intercompartmental clearance]
 * V2 = 0.89 × FFM                        [FFM — adipose excluded]
 *
 * Derived from:
 * - Smit C et al. Br J Clin Pharmacol. 2020;86(2):303-317. DOI: 10.1111/bcp.14144
 * - Zhang T et al. Clin Pharmacokinet. 2024;63:79-91. DOI: 10.1007/s40262-023-01324-5
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

  const CL = Math.max(0.5, 0.0571 * crcl + 0.0158 * weight_kg);
  const V1 = Math.max(5, 0.287 * ffm);
  const Q  = 1.23;
  const V2 = Math.max(5, 0.89 * ffm);

  return { CL, V1, Q, V2 };
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
