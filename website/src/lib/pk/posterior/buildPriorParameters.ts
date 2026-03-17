/**
 * Build adult population prior parameters for first-pass posterior fitting.
 *
 * Explicit prior model used here:
 * - Clearance prior from Ducharme et al. (Ther Drug Monit. 1994):
 *   CL_vanco (mL/min) = 0.771 * CrCl + 18.9
 *   where CrCl is Cockcroft-Gault creatinine clearance.
 * - Volume prior from the same adult dataset:
 *   V = 0.69 L/kg * ideal body weight (IBW)
 *
 * Implementation bounds are kept explicit and conservative:
 * - V/IBW bounded to the subgroup range reported in the abstract (0.58-1.17 L/kg IBW)
 * - Ke bounded to a broad numerical guardrail for fitter stability
 *
 * These are transparent adult priors for a bounded first-pass engine, not a claim of
 * a validated commercial Bayesian model across all adult subpopulations.
 */

import { creatinineClearance } from "@/lib/creatinineClearance";
import type { NormalizedPatient, NormalizedRegimen } from "../types";

const DUCHARME_CLEARANCE_SLOPE = 0.771;
const DUCHARME_CLEARANCE_INTERCEPT_ML_MIN = 18.9;
const DUCHARME_VOLUME_L_PER_KG_IBW = 0.69;
const DUCHARME_VOLUME_MIN_L_PER_KG_IBW = 0.58;
const DUCHARME_VOLUME_MAX_L_PER_KG_IBW = 1.17;

const KE_MIN = 0.002;
const KE_MAX = 0.2;
const MIN_BODY_SIZE_KG = 30;

export const ADULT_VANCOMYCIN_PRIOR_MODEL = {
  id: "ducharme-1994-adult-one-compartment",
  label: "Ducharme 1994 adult population prior",
  structuralModel: "one-compartment intermittent IV infusion",
  clearance: {
    equation: "CL_vanco (mL/min) = 0.771 * CrCl + 18.9",
    source: "Ducharme MP et al. Ther Drug Monit. 1994;16(5):513-518.",
  },
  volume: {
    equation: "V (L) = 0.69 * IBW_kg",
    subgroupRange: "0.58-1.17 L/kg IBW reported across adult subgroups in abstract",
    source: "Ducharme MP et al. Ther Drug Monit. 1994;16(5):513-518.",
  },
  notes: [
    "Adult population prior only.",
    "CrCl estimated separately with Cockcroft-Gault in shared code.",
    "Numerical Ke guardrails are implementation safety bounds, not literature claims.",
  ],
} as const;

export interface PriorParameters {
  Ke: number;
  V: number;
  crcl: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function idealBodyWeightKg(patient: NormalizedPatient): number {
  const heightInches = patient.height_cm / 2.54;
  const inchesOverFiveFeet = Math.max(0, heightInches - 60);
  const sex = patient.sex.toLowerCase();
  const base = sex === "female" ? 45.5 : 50;
  return Math.max(MIN_BODY_SIZE_KG, base + 2.3 * inchesOverFiveFeet);
}

function clearanceLPerHourFromCrCl(crcl: number): number {
  const clMlMin = DUCHARME_CLEARANCE_SLOPE * Math.max(0, crcl) + DUCHARME_CLEARANCE_INTERCEPT_ML_MIN;
  return (clMlMin * 60) / 1000;
}

function keFromClAndV(clearanceLPerHour: number, volumeL: number): number {
  if (clearanceLPerHour <= 0 || volumeL <= 0) return KE_MIN;
  return clamp(clearanceLPerHour / volumeL, KE_MIN, KE_MAX);
}

function volumeL(patient: NormalizedPatient): number {
  const ibwKg = idealBodyWeightKg(patient);
  const litersPerKg = clamp(
    DUCHARME_VOLUME_L_PER_KG_IBW,
    DUCHARME_VOLUME_MIN_L_PER_KG_IBW,
    DUCHARME_VOLUME_MAX_L_PER_KG_IBW
  );
  return litersPerKg * ibwKg;
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
  const V = volumeL(patient);
  const clearanceLPerHour = clearanceLPerHourFromCrCl(crcl);
  const Ke = keFromClAndV(clearanceLPerHour, V);
  return { Ke, V, crcl };
}
