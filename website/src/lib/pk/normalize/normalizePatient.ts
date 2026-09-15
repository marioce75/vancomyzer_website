import type { NormalizedPatient } from "../types";

export interface RawPatient {
  age?: unknown;
  weight_kg?: unknown;
  height_cm?: unknown;
  sex?: unknown;
  serum_creatinine_mg_dl?: unknown;
}

export function normalizePatient(raw: RawPatient): NormalizedPatient {
  const age = Math.max(0, Math.min(120, Number(raw.age) || 0));
  const weight_kg = Math.max(20, Math.min(300, Number(raw.weight_kg) || 70));
  const height_cm = Math.max(0, Math.min(250, Number(raw.height_cm) || 0));
  const sexRaw = String(raw.sex ?? "").toLowerCase();
  const sex = (sexRaw === "male" || sexRaw === "female") ? sexRaw : "" as const;
  // `||` not `??`: Number(undefined) and Number("abc") are NaN, which `??` does
  // not replace (it only catches null/undefined), so the fallback was dead and
  // a missing SCr propagated NaN through every downstream dose calculation.
  const serum_creatinine_mg_dl = Math.max(0.1, Number(raw.serum_creatinine_mg_dl) || 1);
  return { age, weight_kg, height_cm, sex, serum_creatinine_mg_dl };
}
