import { creatinineClearance } from "@/lib/creatinineClearance";
import type { NormalizedPatient, NormalizedRegimen } from "../types";

export const ADULT_VANCOMYCIN_PRIOR_MODEL = {
  id: "colin-2019-two-compartment",
  label: "Colin 2019 two-compartment adult population prior",
  structuralModel: "two-compartment intermittent IV infusion",
  clearance: {
    equation: "CL (L/h) = 4.10 * (WT/70)^0.75 * (CrCl/120)^0.75 (approximate scaling)",
    source: "Colin PJ et al. Clin Pharmacokinet. 2019.",
  },
  volume: {
    equation: "V1 (L) = 42.9 * (WT/70), V2 (L) = 41.7 * (WT/70)",
    subgroupRange: "Typical values for 70kg adult",
    source: "Colin PJ et al. Clin Pharmacokinet. 2019.",
  },
  notes: [
    "Two-compartment adult population prior based on Colin 2019.",
    "CrCl estimated separately with Cockcroft-Gault in shared code.",
  ],
} as const;

export interface PriorParameters {
  CL: number;
  V1: number;
  Q: number;
  V2: number;
  crcl: number;
}

const MIN_BODY_SIZE_KG = 30;

function allometricWeightKg(patient: NormalizedPatient): number {
  return Math.max(MIN_BODY_SIZE_KG, patient.weight_kg);
}

export function buildPriorParameters(
  patient: NormalizedPatient,
  _regimen: NormalizedRegimen
): PriorParameters {
  const crcl = creatinineClearance({
    age: patient.age,
    sex: patient.sex,
    height_cm: patient.height_cm,
    weight_kg: patient.weight_kg,
    serum_creatinine_mg_dl: patient.serum_creatinine_mg_dl,
  });
  
  const wt = allometricWeightKg(patient);
  const wt_ratio = wt / 70;
  
  // Normalized CrCl: Colin reference patient was 0.83 mg/dL, 70kg, 35yo -> CrCl ~123 mL/min
  // We'll scale CL based on the patient's CrCl relative to 120 mL/min for stability
  const crcl_ratio = Math.max(10, crcl) / 120;
  
  const CL = 4.10 * Math.pow(wt_ratio, 0.75) * Math.pow(crcl_ratio, 0.75);
  const V1 = 42.9 * wt_ratio;
  const V2 = 41.7 * wt_ratio;
  const Q = 3.22 * Math.pow(wt_ratio, 0.75);
  
  return { CL, V1, Q, V2, crcl };
}
