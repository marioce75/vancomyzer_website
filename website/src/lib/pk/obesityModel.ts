/**
 * Body-size utilities — BMI, fat-free mass and Cockcroft-Gault variants.
 *
 * INFORMATIONAL ONLY. Nothing in this file feeds a dosing calculation.
 * Vancomyzer doses every adult with the Colin 2019 model (see
 * pk/modelRegistry.ts). The custom BMI ≥ 40 "obesity model" that used these
 * helpers to build clearance and FFM-scaled volumes was retired from dosing on
 * 2026-09-15; its equations and the reasons for retirement are recorded in
 * modelRegistry.ts (VANCOMYZER_CUSTOM_OBESITY_MODEL_RETIRED).
 *
 * Remaining uses: the obesity advisory panel (CrCl on TBW / AdjBW / FFM for
 * clinician context), research-mode enrichment, and research SCr records.
 *
 * References:
 * - Janmahasatian S et al. Clin Pharmacokinet. 2005;44(10):1051-65. DOI: 10.2165/00003088-200544100-00004
 * - Cockcroft DW, Gault MH. Nephron. 1976;16(1):31-41.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** BMI at which the advisory panel is shown. Not a model switch. */
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
// Cockcroft-Gault CrCl on total body weight (informational / research only)
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

/**
 * Multi-method CrCl comparison for the obesity advisory panel.
 *
 * In obese geriatric patients the three Cockcroft-Gault variants can disagree
 * by 2-3× (e.g., 70F 127kg SCr 1.65: CG-TBW=64, CG-AdjBW=43, CG-FFM=29).
 * Shown so clinicians can see how uncertain body-size-based renal estimates
 * are. None of these values enters the Colin 2019 calculation, which uses
 * serum creatinine directly.
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

/**
 * Ideal body weight, Devine 1974 (lb -> kg): 50 kg (M) or 45.5 kg (F) plus
 * 2.3 kg per inch over 60 inches. Exported so the displayed creatinine-clearance
 * estimate and this advisory panel share one definition.
 *
 * Note the provenance: the Devine formula "is not referenced to a particular
 * data set, but was instead based on the empiric estimates of Devine's mentor"
 * (Pai & Paloucek 2000, Ann Pharmacother 34:1066-9).
 */
export function idealBodyWeightKg(height_cm: number, sex: "male" | "female"): number {
  const height_in = height_cm / 2.54;
  const base = sex === "male" ? 50 : 45.5;
  return Math.max(0, base + 2.3 * Math.max(0, height_in - 60));
}

/**
 * Adjusted body weight = IBW + factor x (TBW - IBW). The 0.4 factor traces to
 * Schwartz 1978 (J Infect Dis 138:499-505), a 13-patient aminoglycoside
 * volume-of-distribution study — not a clearance study.
 */
export function adjustedBodyWeightKg(weight_kg: number, ibw_kg: number, factor = 0.4): number {
  return weight_kg > ibw_kg ? ibw_kg + factor * (weight_kg - ibw_kg) : weight_kg;
}

export function buildCrClBreakdown(
  age: number,
  weight_kg: number,
  height_cm: number,
  scr_mg_dl: number,
  sex: "male" | "female",
): CrClBreakdown {
  const ffm = calculateFFM(weight_kg, height_cm, sex);
  const ibw_kg = idealBodyWeightKg(height_cm, sex);
  const adjbw_kg = adjustedBodyWeightKg(weight_kg, ibw_kg);

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
