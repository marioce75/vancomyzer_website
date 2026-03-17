/**
 * Shared Cockcroft-Gault creatinine clearance.
 * Used by initial_regimen and existing_regimen.
 *
 * Weight selection policy is explicit and bounded:
 * - underweight: actual body weight
 * - non-obese: ideal body weight
 * - obese (actual > 120% of IBW): adjusted body weight
 */

export interface PatientForCrCl {
  age: number;
  sex: string;
  height_cm: number;
  weight_kg: number;
  serum_creatinine_mg_dl: number;
}

const MIN_SCR_MG_DL = 0.4;
const MIN_BODY_WEIGHT_KG = 30;

export function idealBodyWeightKg(patient: Pick<PatientForCrCl, "sex" | "height_cm">): number {
  const heightInches = patient.height_cm / 2.54;
  const inchesOverFiveFeet = Math.max(0, heightInches - 60);
  const base = patient.sex.toLowerCase() === "female" ? 45.5 : 50;
  return Math.max(MIN_BODY_WEIGHT_KG, base + 2.3 * inchesOverFiveFeet);
}

export function adjustedBodyWeightKg(actualWeightKg: number, idealWeightKg: number): number {
  return idealWeightKg + 0.4 * Math.max(0, actualWeightKg - idealWeightKg);
}

export function cockcroftGaultWeightKg(patient: Pick<PatientForCrCl, "sex" | "height_cm" | "weight_kg">): number {
  const actualWeightKg = Math.max(patient.weight_kg, MIN_BODY_WEIGHT_KG);
  const idealWeightKg = idealBodyWeightKg(patient);

  if (actualWeightKg < idealWeightKg) {
    return actualWeightKg;
  }
  if (actualWeightKg > idealWeightKg * 1.2) {
    return adjustedBodyWeightKg(actualWeightKg, idealWeightKg);
  }
  return idealWeightKg;
}

/**
 * Cockcroft-Gault CrCl (mL/min).
 * Uses SCr minimum to avoid division issues and a transparent adult weight-selection rule.
 */
export function creatinineClearance(patient: PatientForCrCl): number {
  const { age, sex, serum_creatinine_mg_dl } = patient;
  const scr = Math.max(serum_creatinine_mg_dl, MIN_SCR_MG_DL);
  const weightKg = cockcroftGaultWeightKg(patient);
  let crcl = ((140 - age) * weightKg) / (72 * scr);
  if (sex.toLowerCase() === "female") crcl *= 0.85;
  return Math.max(0, Math.round(crcl * 10) / 10);
}
