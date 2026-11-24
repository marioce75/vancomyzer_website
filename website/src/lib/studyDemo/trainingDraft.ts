/** Only transforms preloaded, fictional training cases. No I/O or browser storage. */
import { concentrationFromHistory } from "../pk/doseHistory";
import { parseDatetimeHours, type TimedCaseInput, type TimedPredictionResult } from "../studyTimed/predictAtDraw";

const FICTIONAL_UTC_START = Date.UTC(2030, 0, 5, 14);
const HOUR_MS = 3_600_000;

export type TrainingDose = { key: number; start: string; mg: string; minutes: string };
export type TrainingDraft = { draw: string; doses: TrainingDose[]; complete: boolean };

function utcEditorValue(value: string | number) {
  const ms = typeof value === "number" ? FICTIONAL_UTC_START + value * HOUR_MS : Date.parse(value);
  return new Date(ms).toISOString().slice(0, 19);
}

export function draftFromPreset(input: TimedCaseInput): TrainingDraft {
  return {
    draw: utcEditorValue(input.draw_time),
    complete: input.history_complete_attested,
    doses: input.doses.map((dose, key) => ({
      key,
      start: utcEditorValue(dose.start),
      mg: String(dose.dose_mg),
      minutes: String(dose.infusion_minutes ?? Number(((Date.parse(utcEditorValue(dose.end!) + "Z") -
        Date.parse(utcEditorValue(dose.start) + "Z")) / 60_000).toFixed(6))),
    })),
  };
}

const utcStamp = (v: string) => v ? v + "Z" : "";
const numeric = (v: string) => v.trim() === "" ? Number.NaN : Number(v);

export function trainingInput(preset: TimedCaseInput, draft: TrainingDraft): TimedCaseInput {
  return {
    study_case_id: preset.study_case_id,
    time_basis: "datetime",
    age_years: preset.age_years,
    weight_kg: preset.weight_kg,
    serum_creatinine_mg_dl: preset.serum_creatinine_mg_dl,
    scr_collected_at: utcEditorValue(preset.scr_collected_at) + "Z",
    renal_replacement_therapy: preset.renal_replacement_therapy,
    history_complete_attested: draft.complete,
    draw_time: utcStamp(draft.draw),
    doses: draft.doses.map((d) => ({ start: utcStamp(d.start), dose_mg: numeric(d.mg), infusion_minutes: numeric(d.minutes) })),
  };
}

/** Validated actual history curve only, ending at the draw. No candidate/AUC/steady-state plot. */
export function trainingCurve(input: TimedCaseInput, result: TimedPredictionResult) {
  if (result.status !== "predicted" || !result.model_parameters || result.draw_elapsed_hours === null) return [];
  const draw = parseDatetimeHours(String(input.draw_time));
  if (draw === null) return [];
  const raw = input.doses.flatMap((d) => {
    const start = parseDatetimeHours(String(d.start));
    if (start === null || start >= draw || d.infusion_minutes === undefined) return [];
    return [{ start, dose_mg: d.dose_mg, duration: d.infusion_minutes / 60 }];
  }).sort((a, b) => a.start - b.start);
  if (!raw.length) return [];
  const first = raw[0].start;
  const events = raw.map((d) => ({ time: d.start - first, dose_mg: d.dose_mg, T_inf: (d.start + d.duration) - d.start }));
  const until = draw - first;
  const times = new Set(Array.from({ length: 97 }, (_, i) => until * i / 96));
  for (const d of events) {
    times.add(d.time);
    if (d.time + d.T_inf < until) times.add(d.time + d.T_inf);
  }
  const p = result.model_parameters;
  return Array.from(times).sort((a, b) => a - b).map((hour) => ({
    hour,
    concentration: hour === until ? result.predicted_concentration_mg_l! : concentrationFromHistory(
      { CL: p.CL_L_h, V1: p.V1_L, Q: p.Q_L_h, V2: p.V2_L }, events, hour,
    ),
  }));
}
