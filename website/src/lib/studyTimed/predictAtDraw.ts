/**
 * A priori vancomycin concentration at the actual blood-draw time, from the
 * actual finite IV dose history up to the draw. Research use only.
 *
 * What this does
 *   1. Validates one case strictly (whitelisted fields, explicit time basis,
 *      explicit units, attested complete history, no measured results).
 *   2. Computes the shipped Colin 2019 adult population parameters with
 *      buildPriorParameters (unchanged), from age, weight and the serum
 *      creatinine available at treatment start.
 *   3. Superposes the shipped single-dose two-compartment solution over the
 *      doses that STARTED BEFORE the draw, with concentrationFromHistory
 *      (unchanged). An infusion still running at the draw contributes only the
 *      drug infused up to the draw (the during-infusion branch of the shipped
 *      solution). Nothing after the draw is used.
 *
 * What this deliberately does not do
 *   - No measured concentration, prior level or outcome enters. Fields that look
 *     like one are refused, not ignored.
 *   - No steady-state assumption, no scheduled-dose substitution, no gap
 *     filling, no dose recommendation.
 *   - No guessing: an ambiguous or unsupported history is refused with reason
 *     codes and no number.
 *
 * Pure module: no I/O, no network, no environment, no clock.
 */
import { buildPriorParameters } from "../pk/posterior/buildPriorParameters";
import { concentrationFromHistory } from "../pk/doseHistory";
import type { DoseEvent } from "../pk/steadyStateTwoCompartment";
import { PREDICTION_FUNCTION_ID, RELEASE_LABEL } from "./release";

export type TimeBasis = "datetime" | "elapsed_hours";

export interface TimedDoseInput {
  start: string | number;
  dose_mg: number;
  /** Exactly one of infusion_minutes or end. */
  infusion_minutes?: number;
  end?: string | number;
}

export interface TimedCaseInput {
  study_case_id: string;
  time_basis: TimeBasis;
  age_years: number;
  weight_kg: number;
  serum_creatinine_mg_dl: number;
  scr_collected_at: string | number;
  renal_replacement_therapy: boolean;
  history_complete_attested: boolean;
  draw_time: string | number;
  doses: TimedDoseInput[];
}

export interface Reason {
  code: string;
  message: string;
}

export interface TimedPredictionResult {
  study_case_id: string | null;
  status: "predicted" | "refused";
  draw_time: string | number | null;
  /** Hours from the start of the first administered dose to the draw. */
  draw_elapsed_hours: number | null;
  /** Unrounded model prediction (mg/L). null when refused. */
  predicted_concentration_mg_l: number | null;
  doses_used: number;
  warnings: Reason[];
  reasons: Reason[];
  release: string;
  prediction_function: string;
  model_parameters: { CL_L_h: number; V1_L: number; Q_L_h: number; V2_L: number } | null;
}

/** Limits. Patient limits match the public adult calculator's request validation. */
export const LIMITS = {
  ageYears: [18, 120],
  weightKg: [30, 400],
  scrMgDl: [0.1, 10],
  doseMg: [1, 6000],
  infusionMinutes: [1, 720],
  maxDoses: 500,
  elapsedAbsHours: 1_000_000,
  longGapHours: 48,
} as const;

const CASE_FIELDS = new Set([
  "study_case_id",
  "time_basis",
  "age_years",
  "weight_kg",
  "serum_creatinine_mg_dl",
  "scr_collected_at",
  "renal_replacement_therapy",
  "history_complete_attested",
  "draw_time",
  "doses",
]);
const DOSE_FIELDS = new Set(["start", "dose_mg", "infusion_minutes", "end"]);

/**
 * Field names that suggest a measured result. Any such field is refused with
 * MEASURED_RESULT_SUPPLIED, so a measured value can never be silently carried
 * along into (or next to) a prediction input.
 */
const MEASURED_PATTERN =
  /(level|measured|observ|result|concentration|conc\b|conc_|mcg|mg_?per_?l|mg_l|\blab|trough|peak|auc|outcome|value)/i;

export const STUDY_CASE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

const DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})$/;

/** Parse an ISO 8601 date-time with an explicit offset to epoch hours, or null. */
export function parseDatetimeHours(value: string): number | null {
  const m = DATETIME_PATTERN.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, off] = m;
  const year = Number(y), month = Number(mo), day = Number(d);
  const hour = Number(h), minute = Number(mi), second = s === undefined ? 0 : Number(s);
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return null;
  const local = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(local);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  let offsetMin = 0;
  if (off !== "Z") {
    const sign = off[0] === "-" ? -1 : 1;
    const oh = Number(off.slice(1, 3)), om = Number(off.slice(4, 6));
    if (oh > 14 || om > 59) return null;
    offsetMin = sign * (oh * 60 + om);
  }
  return (local - offsetMin * 60_000) / 3_600_000;
}

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function refused(id: string | null, draw: string | number | null, reasons: Reason[], warnings: Reason[] = []): TimedPredictionResult {
  return {
    study_case_id: id,
    status: "refused",
    draw_time: draw,
    draw_elapsed_hours: null,
    predicted_concentration_mg_l: null,
    doses_used: 0,
    warnings,
    reasons,
    release: RELEASE_LABEL,
    prediction_function: PREDICTION_FUNCTION_ID,
    model_parameters: null,
  };
}

/** Field-name screen shared by the batch readers (CSV headers, JSON keys). */
export function screenFieldName(name: string, allowed: ReadonlySet<string>, scope: string): Reason | null {
  if (allowed.has(name)) return null;
  if (MEASURED_PATTERN.test(name)) {
    return {
      code: "MEASURED_RESULT_SUPPLIED",
      message: `${scope} field "${name}" looks like a measured result. Measured concentrations and prior levels must stay outside the prediction input.`,
    };
  }
  return { code: "UNKNOWN_FIELD", message: `${scope} field "${name}" is not part of the input format.` };
}

export const ALLOWED_CASE_FIELDS: ReadonlySet<string> = CASE_FIELDS;
export const ALLOWED_DOSE_FIELDS: ReadonlySet<string> = DOSE_FIELDS;

export function predictAtDraw(raw: unknown): TimedPredictionResult {
  if (!isObj(raw)) return refused(null, null, [{ code: "INVALID_CASE", message: "Each case must be an object." }]);
  const id = typeof raw.study_case_id === "string" && STUDY_CASE_ID_PATTERN.test(raw.study_case_id) ? raw.study_case_id : null;
  const drawRaw = typeof raw.draw_time === "string" || isNum(raw.draw_time) ? raw.draw_time : null;
  const reasons: Reason[] = [];
  const add = (code: string, message: string) => reasons.push({ code, message });

  for (const key of Object.keys(raw)) {
    const r = screenFieldName(key, CASE_FIELDS, "Case");
    if (r) reasons.push(r);
  }
  if (id === null) add("INVALID_STUDY_CASE_ID", "study_case_id is required: 1-64 letters, digits, '.', '_' or '-'. Use the study code, never a medical record number.");

  const basis = raw.time_basis;
  if (basis !== "datetime" && basis !== "elapsed_hours") {
    add("INVALID_TIME_BASIS", 'time_basis must be "datetime" (ISO 8601 with offset) or "elapsed_hours".');
  }
  const toHours = (v: unknown, field: string): number | null => {
    if (basis === "datetime") {
      if (typeof v !== "string") { add("INVALID_TIME", `${field} must be an ISO 8601 date-time with an explicit offset, e.g. 2030-01-05T08:00-06:00.`); return null; }
      const h = parseDatetimeHours(v);
      if (h === null) add("INVALID_TIME", `${field} "${v}" is not a valid ISO 8601 date-time with an explicit offset (Z or ±HH:MM).`);
      return h;
    }
    if (basis === "elapsed_hours") {
      if (!isNum(v) || Math.abs(v) > LIMITS.elapsedAbsHours) { add("INVALID_TIME", `${field} must be a finite number of hours.`); return null; }
      return v;
    }
    return null;
  };

  const numberIn = (v: unknown, field: string, [lo, hi]: readonly [number, number], code = "OUT_OF_RANGE"): number | null => {
    if (!isNum(v)) { add("MISSING_OR_INVALID_NUMBER", `${field} is required and must be a number.`); return null; }
    if (v < lo || v > hi) { add(code, `${field} ${v} is outside the supported range ${lo}-${hi}.`); return null; }
    return v;
  };
  const age = numberIn(raw.age_years, "age_years", LIMITS.ageYears, "UNSUPPORTED_POPULATION");
  const weight = numberIn(raw.weight_kg, "weight_kg", LIMITS.weightKg);
  const scr = numberIn(raw.serum_creatinine_mg_dl, "serum_creatinine_mg_dl", LIMITS.scrMgDl);

  if (raw.renal_replacement_therapy !== false) {
    if (raw.renal_replacement_therapy === true) add("UNSUPPORTED_RRT", "Renal replacement therapy is outside the Colin 2019 adult population; no prediction is made.");
    else add("MISSING_OR_INVALID_FLAG", "renal_replacement_therapy must be true or false.");
  }
  if (raw.history_complete_attested !== true) {
    add("HISTORY_NOT_ATTESTED", "history_complete_attested must be true: every vancomycin administration from the first dose up to the draw (including any loading dose and outside-hospital doses) is listed with actual times. Missing doses are never inferred.");
  }

  const draw = raw.draw_time === undefined ? (add("MISSING_DRAW_TIME", "draw_time is required."), null) : toHours(raw.draw_time, "draw_time");
  const scrAt = raw.scr_collected_at === undefined ? (add("MISSING_SCR_TIME", "scr_collected_at is required."), null) : toHours(raw.scr_collected_at, "scr_collected_at");

  // ── Doses ────────────────────────────────────────────────────────────────
  type Dose = { start: number; end: number; mg: number; index: number };
  const doses: Dose[] = [];
  if (!Array.isArray(raw.doses) || raw.doses.length === 0) {
    add("NO_DOSES", "doses must list at least one administered IV dose.");
  } else if (raw.doses.length > LIMITS.maxDoses) {
    add("TOO_MANY_DOSES", `At most ${LIMITS.maxDoses} doses per case.`);
  } else {
    raw.doses.forEach((d, i) => {
      const label = `doses[${i}]`;
      if (!isObj(d)) { add("INVALID_DOSE", `${label} must be an object.`); return; }
      for (const key of Object.keys(d)) {
        const r = screenFieldName(key, DOSE_FIELDS, `Dose ${i + 1}`);
        if (r) reasons.push(r);
      }
      const start = d.start === undefined ? (add("MISSING_DOSE_START", `${label}.start is required.`), null) : toHours(d.start, `${label}.start`);
      const mg = numberIn(d.dose_mg, `${label}.dose_mg`, LIMITS.doseMg);
      const hasMin = d.infusion_minutes !== undefined && d.infusion_minutes !== null;
      const hasEnd = d.end !== undefined && d.end !== null;
      let minutes: number | null = null;
      if (hasMin === hasEnd) {
        add("AMBIGUOUS_INFUSION_DURATION", `${label}: give exactly one of infusion_minutes or end.`);
      } else if (hasMin) {
        if (!isNum(d.infusion_minutes) || d.infusion_minutes <= 0) add("INVALID_INFUSION_DURATION", `${label}.infusion_minutes must be a positive number.`);
        else minutes = d.infusion_minutes;
      } else {
        const end = toHours(d.end, `${label}.end`);
        if (end !== null && start !== null) {
          if (!(end > start)) add("INVALID_INFUSION_DURATION", `${label}: end must be after start.`);
          else minutes = (end - start) * 60;
        }
      }
      if (minutes !== null && (minutes < LIMITS.infusionMinutes[0] || minutes > LIMITS.infusionMinutes[1])) {
        add("UNSUPPORTED_INFUSION_DURATION", `${label}: infusion of ${Number(minutes.toFixed(3))} min is outside the supported intermittent-infusion range ${LIMITS.infusionMinutes[0]}-${LIMITS.infusionMinutes[1]} min.`);
        minutes = null;
      }
      if (start !== null && mg !== null && minutes !== null) doses.push({ start, end: start + minutes / 60, mg, index: i });
    });
  }

  if (reasons.length) return refused(id, drawRaw, reasons);
  // All fields valid from here on.
  const drawH = draw as number;

  const sorted = [...doses].sort((a, b) => a.start - b.start || a.index - b.index);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], cur = sorted[i];
    if (cur.start === prev.start) add("DUPLICATE_DOSE_TIME", `Doses ${prev.index + 1} and ${cur.index + 1} start at the same time; possible duplicate charting.`);
    else if (cur.start < prev.end) add("OVERLAPPING_INFUSIONS", `Dose ${cur.index + 1} starts before dose ${prev.index + 1} has finished infusing; the record is ambiguous.`);
  }
  const atDraw = sorted.filter((d) => d.start === drawH);
  if (atDraw.length) add("DOSE_STARTS_AT_DRAW", `Dose ${atDraw[0].index + 1} starts exactly at the draw time; whether the sample preceded it is ambiguous.`);
  const used = sorted.filter((d) => d.start < drawH);
  if (!used.length) add("NO_DOSE_BEFORE_DRAW", "No dose started before the draw; there is no exposure to predict.");
  if ((scrAt as number) > sorted[0].start) {
    add("SCR_AFTER_TREATMENT_START", "scr_collected_at is after the first dose started. Use the serum creatinine available at treatment start.");
  }
  if (reasons.length) return refused(id, drawRaw, reasons);

  const warnings: Reason[] = [];
  const after = sorted.length - used.length;
  if (after > 0) warnings.push({ code: "DOSES_AFTER_DRAW_EXCLUDED", message: `${after} dose(s) starting after the draw were excluded.` });
  const last = used[used.length - 1];
  if (drawH < last.end) {
    warnings.push({
      code: "INFUSION_IN_PROGRESS_AT_DRAW",
      message: `Dose ${last.index + 1} was still infusing at the draw; only the ${Number(((drawH - last.start) * 60).toFixed(3))} of ${Number(((last.end - last.start) * 60).toFixed(3))} min infused before the draw is counted.`,
    });
  }
  for (let i = 1; i < used.length; i++) {
    const gap = used[i].start - used[i - 1].start;
    if (gap > LIMITS.longGapHours) warnings.push({ code: "LONG_GAP_BETWEEN_DOSES", message: `${Number(gap.toFixed(3))} h between doses ${used[i - 1].index + 1} and ${used[i].index + 1}; used as recorded.` });
  }

  // ── Shipped calculation ──────────────────────────────────────────────────
  const t0 = used[0].start;
  const prior = buildPriorParameters(
    { age: age as number, weight_kg: weight as number, height_cm: 0, sex: "", serum_creatinine_mg_dl: scr as number },
    { dose_mg: used[0].mg, interval_hours: 12, infusion_duration_hours: used[0].end - used[0].start },
  );
  const events: DoseEvent[] = used.map((d) => ({ time: d.start - t0, dose_mg: d.mg, T_inf: d.end - d.start }));
  const params = { CL: prior.CL, V1: prior.V1, Q: prior.Q, V2: prior.V2 };
  const c = concentrationFromHistory(params, events, drawH - t0);
  if (!Number.isFinite(c)) return refused(id, drawRaw, [{ code: "NUMERICAL_FAILURE", message: "The model returned a non-finite value." }], warnings);

  return {
    study_case_id: id,
    status: "predicted",
    draw_time: drawRaw,
    draw_elapsed_hours: drawH - t0,
    predicted_concentration_mg_l: c,
    doses_used: used.length,
    warnings,
    reasons: [],
    release: RELEASE_LABEL,
    prediction_function: PREDICTION_FUNCTION_ID,
    model_parameters: { CL_L_h: prior.CL, V1_L: prior.V1, Q_L_h: prior.Q, V2_L: prior.V2 },
  };
}
