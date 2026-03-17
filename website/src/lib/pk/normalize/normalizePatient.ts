import type { NormalizedPatient } from "../types";

export interface RawPatient {
  age?: unknown;
  sex?: unknown;
  weight_kg?: unknown;
  serum_creatinine_mg_dl?: unknown;
  height_cm?: unknown;
}

export function normalizePatient(raw: RawPatient): NormalizedPatient {
  const age = Math.max(0, Math.min(120, Number(raw.age) || 0));
  const sex = String(raw.sex ?? "").trim() || "male";
  const weight_kg = Math.max(20, Math.min(300, Number(raw.weight_kg) || 70));
  const serum_creatinine_mg_dl = Math.max(0.1, Number(raw.serum_creatinine_mg_dl) ?? 1);
  const height_cm = Math.max(100, Math.min(250, Number(raw.height_cm) || 170));
  return { age, sex, weight_kg, serum_creatinine_mg_dl, height_cm };
}
