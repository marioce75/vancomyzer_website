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
  // Ceiling matches the range the API documents and validateExistingRegimenRequest
  // enforces (30-400 kg). A 300 kg clamp here silently recomputed every patient
  // from 300-400 kg at 300 kg — understating clearance by up to 25% and biasing
  // toward underdosing — while the validator's own >400 kg rejection never ran.
  //
  // A MISSING or unparseable weight is NaN, not 70 kg. Inventing a default
  // computed a dose for a patient nobody described; NaN reaches
  // validateExistingRegimenRequest, which already rejects it with a field error
  // naming the input.
  const rawWeight = Number(raw.weight_kg);
  const weight_kg = Number.isFinite(rawWeight) && rawWeight > 0
    ? Math.max(20, Math.min(400, rawWeight))
    : Number.NaN;
  const height_cm = Math.max(0, Math.min(250, Number(raw.height_cm) || 0));
  const sexRaw = String(raw.sex ?? "").toLowerCase();
  const sex = (sexRaw === "male" || sexRaw === "female") ? sexRaw : "" as const;
  // A missing or unparseable serum creatinine is NaN, not 1.0 mg/dL — the same
  // reasoning as weight above. Defaulting it silently produced a full dosing
  // recommendation from a renal function nobody supplied. The validator rejects
  // NaN with a field error.
  const rawScr = Number(raw.serum_creatinine_mg_dl);
  const serum_creatinine_mg_dl = Number.isFinite(rawScr) && rawScr > 0
    ? Math.max(0.1, rawScr)
    : Number.NaN;
  return { age, weight_kg, height_cm, sex, serum_creatinine_mg_dl };
}
