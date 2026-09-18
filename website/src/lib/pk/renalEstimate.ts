/**
 * Renal-function estimates shown to the clinician, and the augmented-renal-
 * clearance (ARC) advisory trigger.
 *
 * NONE of this enters the dose. Colin 2019 takes serum creatinine directly as
 * its renal covariate (see modelRegistry.renalCovariate); creatinine clearance
 * is decision support only.
 *
 * Display and detection deliberately use DIFFERENT body weights, because the
 * evidence points in opposite directions:
 *
 *   Displayed value — Cockcroft-Gault on total body weight is indefensible in
 *   obesity: 12.9% of estimates fall within 30% of measured clearance at a mean
 *   BMI of 50, with a bias of 107 mL/min (Demirovic 2009, Am J Health Syst Pharm
 *   66:642-8). Adjusted body weight is the best-supported weight inside C-G —
 *   bias +1.6 mL/min and 79% within 30% against 51Cr-EDTA measured GFR, versus
 *   +25 mL/min and 56.8% for total body weight (Bouquegneau 2016, Br J Clin
 *   Pharmacol 81:349-61) — and was least biased for overweight through morbidly
 *   obese in the largest comparison, n = 3678 (Winter 2012, Pharmacotherapy
 *   32:604-12). Winter also found actual body weight unbiased in underweight
 *   adults (-0.22 mL/min) and ideal body weight unbiased at normal weight
 *   (-1.3 mL/min), which is the stratification applied here.
 *
 *   ARC trigger — the same substitution makes detection worse. In ICU patients
 *   with measured ARC, C-G accuracy was 70% on total body weight but 61% on
 *   adjusted and 38% on lean body weight, with bias widening from -21.6 to
 *   -58.5 mL/min: every lean-weight substitution under-detects the condition
 *   the advisory exists to catch (Cucci 2023, Pharmacotherapy 43:1131-8). The
 *   trigger therefore stays on total body weight.
 *
 * The 0.4 adjustment factor traces to a 13-patient aminoglycoside
 * volume-of-distribution study (Schwartz 1978, J Infect Dis 138:499-505), not to
 * a clearance study; the 0.3 variant has no traceable primary derivation. The
 * choice between them is conventional and the comparative studies disagree.
 *
 * No cap is applied to the displayed value: no primary evidence supports any
 * specific ceiling.
 */

import { calculateBMI, idealBodyWeightKg, adjustedBodyWeightKg } from "./obesityModel";

/**
 * ARC is defined as a creatinine clearance of 130 mL/min/1.73 m2 or more,
 * consistently across Udy 2013 (Crit Care 17:R35), Barletta 2017 (J Trauma Acute
 * Care Surg 82:665-71) and Cucci 2023. The threshold is INDEXED to body surface
 * area; Cockcroft-Gault returns an absolute clearance, so the two must be put on
 * the same basis before they are compared.
 */
export const ARC_THRESHOLD_ML_MIN_1_73 = 130;

export type CrClWeightDescriptor = "actual" | "ideal" | "adjusted";

export interface DisplayedCrCl {
  /** Value at the entered sex, or at the assumed sex when `sex_assumed` is set. */
  crcl_ml_min: number;
  /** Set only when sex was blank: the value if the patient is female. */
  crcl_if_female_ml_min?: number;
  /** Set only when sex was blank, naming the assumption behind crcl_ml_min. */
  sex_assumed?: "male";
  descriptor: CrClWeightDescriptor;
  weight_used_kg: number;
  /** Clinician-facing line naming the weight used and the basis. */
  label: string;
}

/** Cockcroft-Gault. `weight_kg` is whichever body weight the caller selected. */
function cockcroftGault(
  age: number,
  weight_kg: number,
  scr_mg_dl: number,
  sex: "male" | "female" | "",
): number {
  if (age <= 0 || weight_kg <= 0 || scr_mg_dl <= 0) return 0;
  const base = ((140 - age) * weight_kg) / (72 * scr_mg_dl);
  // Blank sex is treated as male, unchanged from the previous behaviour. This
  // overstates the estimate by ~18% for women who leave the field empty and is
  // tracked separately as an open item.
  return sex === "female" ? base * 0.85 : base;
}

/**
 * Body surface area, Du Bois & Du Bois 1916:
 *   BSA (m2) = 0.007184 x weight(kg)^0.425 x height(cm)^0.725
 * The NKF 2025 workgroup notes this "continues to be the most used formula for
 * calculating BSA in adults" and is the one used in the original eGFR studies.
 */
export function bodySurfaceAreaM2(weight_kg: number, height_cm: number): number | null {
  if (weight_kg <= 0 || height_cm <= 0) return null;
  return 0.007184 * Math.pow(weight_kg, 0.425) * Math.pow(height_cm, 0.725);
}

/**
 * Convert an absolute Cockcroft-Gault clearance (mL/min) to the indexed basis
 * the ARC definition uses (mL/min/1.73 m2). Returns null when height is absent,
 * because BSA cannot be derived without it.
 */
export function indexToBsa(
  crcl_ml_min: number,
  weight_kg: number,
  height_cm: number,
): number | null {
  const bsa = bodySurfaceAreaM2(weight_kg, height_cm);
  if (bsa === null || bsa <= 0) return null;
  return (crcl_ml_min * 1.73) / bsa;
}

/**
 * The clearance used for the ARC trigger only: Cockcroft-Gault on TOTAL body
 * weight, per Cucci 2023 (see file header).
 */
export function crclOnTotalBodyWeight(patient: {
  age: number;
  weight_kg: number;
  sex: "male" | "female" | "";
  serum_creatinine_mg_dl: number;
}): number {
  return cockcroftGault(patient.age, patient.weight_kg, patient.serum_creatinine_mg_dl, patient.sex || "male");
}

/**
 * The clearance shown to the clinician, with the body weight chosen by BMI
 * stratum (Winter 2012). Falls back to actual body weight — the previous
 * behaviour — when height or sex is missing, because ideal body weight cannot be
 * derived without both. The label always names the weight actually used.
 */
export function displayedCrCl(patient: {
  age: number;
  weight_kg: number;
  height_cm: number;
  sex: "male" | "female" | "";
  serum_creatinine_mg_dl: number;
}): DisplayedCrCl | null {
  const { age, weight_kg, height_cm, sex, serum_creatinine_mg_dl } = patient;

  const canDeriveIbw = height_cm > 0 && (sex === "male" || sex === "female");
  let descriptor: CrClWeightDescriptor = "actual";
  let weight_used_kg = weight_kg;

  if (canDeriveIbw) {
    const bmi = calculateBMI(weight_kg, height_cm);
    const ibw = idealBodyWeightKg(height_cm, sex);
    if (bmi >= 25) {
      descriptor = "adjusted";
      weight_used_kg = adjustedBodyWeightKg(weight_kg, ibw);
    } else if (bmi >= 18.5) {
      descriptor = "ideal";
      weight_used_kg = ibw;
    }
  }

  // Sex is not a Colin 2019 covariate, so the dose does not need it; the
  // contextual Cockcroft-Gault value does (×0.85 for women). A single number
  // with an unstated male assumption overstated the estimate by ~18% for women
  // who left the field blank, so when sex is missing BOTH values are shown and
  // the assumption is explicit.
  const sexKnown = sex === "male" || sex === "female";
  const crcl_ml_min = cockcroftGault(age, weight_used_kg, serum_creatinine_mg_dl, sex || "male");
  if (!(crcl_ml_min > 0)) return null;
  const crcl_if_female_ml_min = sexKnown ? undefined : crcl_ml_min * 0.85;

  const weightPhrase =
    descriptor === "adjusted"
      ? `adjusted body weight ${Math.round(weight_used_kg)} kg`
      : descriptor === "ideal"
        ? `ideal body weight ${Math.round(weight_used_kg)} kg`
        : canDeriveIbw
          ? `actual body weight ${Math.round(weight_used_kg)} kg`
          : `actual body weight ${Math.round(weight_used_kg)} kg; height or sex not entered`;

  const valuePhrase = sexKnown
    ? `Estimated CrCl ${Math.round(crcl_ml_min)} mL/min`
    : `Estimated CrCl ${Math.round(crcl_ml_min)} mL/min if male / ${Math.round(crcl_if_female_ml_min ?? 0)} mL/min if female (sex not entered)`;
  return {
    crcl_ml_min,
    crcl_if_female_ml_min,
    sex_assumed: sexKnown ? undefined : "male",
    descriptor,
    weight_used_kg,
    label:
      `${valuePhrase} ` +
      `(Cockcroft-Gault, ${weightPhrase}; absolute, not indexed to 1.73 m²) — ` +
      `shown for context; the dose is calculated from serum creatinine and does not use this value`,
  };
}
