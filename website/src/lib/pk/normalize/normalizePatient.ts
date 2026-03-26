import type { NormalizedPatient } from "../types";

export interface RawPatient {
  age?: unknown;
  weight_kg?: unknown;
  serum_creatinine_mg_dl?: unknown;
}

export function normalizePatient(raw: RawPatient): NormalizedPatient {
  const age = Math.max(0, Math.min(120, Number(raw.age) || 0));
  const weight_kg = Math.max(20, Math.min(300, Number(raw.weight_kg) || 70));
  const serum_creatinine_mg_dl = Math.max(0.1, Number(raw.serum_creatinine_mg_dl) ?? 1);
  return { age, weight_kg, serum_creatinine_mg_dl };
}
