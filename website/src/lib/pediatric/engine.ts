import { researchRegimens, type ResearchRegimens } from './researchRegimens';
/**
 * Pediatric vancomycin research engine (Colin 2019, admin-only preview).
 *
 * Responsibilities, in order:
 *   1. validate raw input (units, ranges, timestamps) — nothing is repaired;
 *   2. refuse unsupported populations (RRT, ECMO, non-IV, adults) and refuse
 *      any request whose postmenstrual age falls in the pooled dataset's
 *      pediatric gap (no acknowledgement can override this);
 *   3. population (prior-only) parameters and exposure;
 *   4. MAP posterior from measured levels when a dose history and levels exist;
 *   5. forecast AUC24 (next 24 h, actual history continued with the planned
 *      regimen) kept separate from the steady-state AUC24 of that regimen;
 *   6. candidate regimen table with the same parameters;
 *   7. assumptions, limitations and research-only labelling in every result.
 *
 * No adult module is modified; the generic two-compartment solver and dose
 * history helpers from src/lib/pk are reused read-only.
 */

import { aucFromHistory, concentrationFromHistory } from "@/lib/pk/doseHistory";
import { computeExposure, terminalHalfLifeHours, type DoseEvent, type TwoCompartmentParameters } from "@/lib/pk/steadyStateTwoCompartment";
import {
  ACTIVE_FORMULATION,
  COLIN_2019_DATASET_SUPPORT as SUPPORT,
  PEDIATRIC_MODEL_MANIFEST_VERSION,
  PEDIATRIC_RESEARCH_NOTICE,
  PEDIATRIC_SCOPE as SCOPE,
  type Colin2019Formulation,
} from "./colin2019/manifest";
import { drawEta, fitEta, IS_MIN_ESS, posteriorDraws, summariseDraws, summariseWeightedDraws, type FitResult, type Interval, type Observation } from "./colin2019/fit";
import { clinicalPostmenstrualAgeWeeks, DAYS_PER_YEAR, individualParameters, postmenstrualAgeYears, typicalParameters, WEEKS_PER_MODEL_YEAR, type Eta, type PediatricCovariates, type TypicalParameters } from "./colin2019/prior";
import { weightForAge } from "./growth/weightForAge";

// ── Request / response contracts ─────────────────────────────────────────────

export type AgeUnit = "days" | "weeks" | "months" | "years";
export type WeightUnit = "kg" | "g";
export type CreatinineUnit = "mg/dL" | "umol/L";

export interface PediatricRequest {
  patient: {
    postnatal_age: { value: number; unit: AgeUnit };
    /** Completed weeks (decimal allowed) at birth. Required below 1 year postnatal age. */
    gestational_age_weeks?: number;
    weight: { value: number; unit: WeightUnit };
    serum_creatinine: { value: number; unit: CreatinineUnit };
    renal_replacement_therapy?: boolean;
    ecmo?: boolean;
    route?: "iv" | "other";
    unstable_renal_function?: boolean;
  };
  /**
   * Current or planned maintenance regimen (used for steady-state and forecast
   * exposure). `next_dose_start` (ISO timestamp with offset) anchors the
   * forecast and is required with a dose history. No next-dose time is inferred, and
   * any level at or after that time is rejected rather than forecast over.
   */
  research_regimen_context?: { serious_mrsa_mic1: boolean; normal_stable_renal_function: boolean };
  regimen: { dose_mg: number; interval_hours: number; infusion_minutes: number; next_dose_start?: string };
  /** Actual administrations; order in the array is irrelevant (timestamps are absolute); required when levels are supplied. */
  doses?: Array<{ start: string; dose_mg: number; infusion_minutes: number }>;
  levels?: Array<{ time: string; concentration_mg_l: number }>;
  /**
   * Set to true after the administrator has checked every "verify" item of a
   * needs_verification response against the chart. Not an eligibility override:
   * it only confirms data entry for values that are unusual for age.
   */
  inputs_verified?: boolean;
}

/** Review categories (docs/pediatric/CLINICAL-REVIEW.md §3): impossible/invalid inputs are refused and never appear here. */
export type InputReviewCategory = "verify" | "outside_model_population" | "clinical_validity_unknown";
export interface InputReviewItem { field: string; category: InputReviewCategory; message: string; source: string }

export type EstimateBasis = "prior_only" | "posterior_one_level" | "posterior_two_level" | "posterior_multi_level";

export interface ExposureBlock {
  /** Daily dose / CL for the planned regimen at steady state. */
  steady_state_auc24: number;
  steady_state_peak: number;
  steady_state_trough: number;
  /** AUC over the 24 h starting at the next planned dose, actual history continued. Null without a dose history. */
  forecast_auc24_next24h: number | null;
  /** AUC over the 24 h before the forecast window, from the recorded history only. Null without history. */
  observed_window_auc24: number | null;
  terminal_half_life_hours: number;
  steady_state_auc24_interval?: Interval;
  forecast_auc24_interval?: Interval | null;
}

export interface ParameterBlock extends TwoCompartmentParameters {
  eta?: Eta;
}

export interface CandidateRegimen {
  dose_mg: number;
  dose_mg_per_kg: number;
  interval_hours: number;
  infusion_minutes: number;
  daily_dose_mg_per_kg: number;
  auc24: number;
  peak: number;
  trough: number;
  in_target: boolean;
  flags: string[];
}

export interface PediatricResult {
  status: "ok";
  research_only: true;
  notice: string;
  manifest_version: string;
  model: "colin_2019";
  formulation: Colin2019Formulation;
  estimate_basis: EstimateBasis;
  level_count: number;
  derived: {
    postnatal_age_days: number;
    postnatal_age_years: number;
    gestational_age_weeks: number;
    gestational_age_assumed: boolean;
    /** Model PMA expressed in weeks (pma_years × 52). */
    pma_weeks: number;
    /** Model covariate: postnatal years (365.25 d) + gestational weeks / 52. */
    pma_years: number;
    /** Clinical PMA: gestational weeks + postnatal days / 7. */
    pma_weeks_clinical: number;
    age_convention: string;
    weight_kg: number;
    scr_mg_dl: number;
    scr_std_mg_dl: number;
    covariate_factors: TypicalParameters["factors"];
  };
  prior: { parameters: ParameterBlock; exposure: ExposureBlock };
  posterior?: {
    parameters: ParameterBlock;
    exposure: ExposureBlock;
    fit: {
      success: boolean;
      converged: boolean;
      iterations: number;
      starts: number;
      objective: number;
      nll: number;
      prior_penalty: number;
      /** Laplace (normal-approximation) SDs of η at the MAP; diagnostic only. */
      eta_sd: FitResult["etaSd"];
      /** How the credible intervals were obtained. */
      posterior_sampling: { method: string; draws: number; effective_sample_size: number } | null;
      predicted_at_levels: FitResult["predictedAtObservations"];
      warnings: string[];
    };
  };
  sensitivity: {
    article_transcription: { CL: number; steady_state_auc24: number };
    clearance_ratio_fitted_to_article: number;
  };
  target: { auc24_low: number; auc24_high: number; statement: string };
  candidate_regimens: CandidateRegimen[];
  research_regimens?: ResearchRegimens;
  /** Input review: unusual values to verify, model-population boundaries crossed, and inputs whose clinical validity is unknown. */
  input_review: { items: InputReviewItem[]; verified: boolean };
  timeline?: {
    origin: string;
    /** Recorded doses in chronological order with their original row numbers (1-based) as supplied. */
    doses: Array<{ row: number; start: string; end: string; start_hours: number; dose_mg: number; infusion_minutes: number }>;
    levels: Array<{ row: number; time: string; time_hours: number; concentration_mg_l: number }>;
    last_dose_start_hours: number;
    next_planned_dose_hours: number;
    next_planned_dose: string;
    /** The explicitly entered next-dose timestamp. */
    next_dose_anchor: "regimen.next_dose_start";
    /** Forecast AUC24 window; always starts after every level used for the fit. */
    forecast_window: { start_hours: number; end_hours: number; start: string; end: string };
    last_level_hours: number | null;
  };
  warnings: string[];
  assumptions: string[];
  limitations: string[];
}

export interface PediatricRefusal {
  status: "invalid" | "unsupported";
  message: string;
  field_errors: Record<string, string>;
}

/** Inputs are valid and supported but unusual for age; no dosing result is produced until they are verified. */
export interface PediatricVerificationRequired {
  status: "needs_verification";
  message: string;
  input_review: InputReviewItem[];
  /** The "verify" items keyed by field, for form highlighting. */
  field_errors: Record<string, string>;
}

export type PediatricOutcome = PediatricResult | PediatricRefusal | PediatricVerificationRequired;

// ── Validation ───────────────────────────────────────────────────────────────
//
// Fail-closed rules (docs/pediatric/INPUT-VALIDATION.md):
//  - every unit is matched against a fixed list (never `in` on an object, so
//    inherited names such as "toString" cannot pass);
//  - every required number must be a finite JS number (null, strings, NaN and
//    ±Infinity are rejected);
//  - timestamps are ISO 8601 `YYYY-MM-DDTHH:MM[:SS[.sss]]` followed by `Z` or a
//    `±HH:MM` offset, checked field by field (real calendar day incl. leap
//    years, 00-23 h, 00-59 min/s, |offset| ≤ 14:00); local times without an
//    offset are rejected because they are ambiguous across daylight-saving
//    transitions;
//  - hard limits reject impossible inputs ("invalid"); model-population limits
//    from the source dataset are warned, never silently applied;
//  - the forecast is anchored strictly after every level used for the fit, or
//    the request is rejected (no dose is moved, no history is inferred).

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const AGE_UNITS: readonly AgeUnit[] = ["days", "weeks", "months", "years"];
const WEIGHT_UNITS: readonly WeightUnit[] = ["kg", "g"];
const CREATININE_UNITS: readonly CreatinineUnit[] = ["mg/dL", "umol/L"];
const isAgeUnit = (u: unknown): u is AgeUnit => typeof u === "string" && AGE_UNITS.includes(u as AgeUnit);
const isWeightUnit = (u: unknown): u is WeightUnit => typeof u === "string" && WEIGHT_UNITS.includes(u as WeightUnit);
const isCreatinineUnit = (u: unknown): u is CreatinineUnit => typeof u === "string" && CREATININE_UNITS.includes(u as CreatinineUnit);

/** Chronological conversions: postnatal age is normalised to days with a 365.25-day year. */
const AGE_DAYS: Readonly<Record<AgeUnit, number>> = { days: 1, weeks: 7, months: DAYS_PER_YEAR / 12, years: DAYS_PER_YEAR };

export const TIMESTAMP_FORMAT = "ISO 8601 date-time: YYYY-MM-DDTHH:MM[:SS[.sss]] followed by Z or an explicit ±HH:MM offset (e.g. 2026-10-29T08:00:00-05:00). Local times without an offset are rejected.";
const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/;
const YEAR_MIN = 1900, YEAR_MAX = 2199;

export type ParsedTimestamp = { ok: true; ms: number } | { ok: false; reason: string };

/** Strict ISO 8601 parser: every field is range-checked; nothing is normalised. */
export function parseStrictTimestamp(s: unknown): ParsedTimestamp {
  if (typeof s !== "string") return { ok: false, reason: `A timestamp string is required. ${TIMESTAMP_FORMAT}` };
  const m = ISO.exec(s);
  if (!m) return { ok: false, reason: `Unrecognised timestamp "${s}". ${TIMESTAMP_FORMAT}` };
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]), hour = Number(m[4]), minute = Number(m[5]);
  const second = m[6] === undefined ? 0 : Number(m[6]);
  const ms = m[7] === undefined ? 0 : Number(m[7].padEnd(3, "0"));
  if (year < YEAR_MIN || year > YEAR_MAX) return { ok: false, reason: `Year ${year} is outside ${YEAR_MIN}-${YEAR_MAX}.` };
  if (month < 1 || month > 12) return { ok: false, reason: `Month ${m[2]} is not a calendar month (01-12).` };
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate(); // day 0 of the next month
  if (day < 1 || day > daysInMonth) return { ok: false, reason: `Day ${m[3]} does not exist in ${m[1]}-${m[2]} (that month has ${daysInMonth} days${month === 2 ? `; ${year} is ${daysInMonth === 29 ? "" : "not "}a leap year` : ""}).` };
  if (hour > 23) return { ok: false, reason: `Hour ${m[4]} is not valid (00-23; use 00:00 of the next day instead of 24:00).` };
  if (minute > 59) return { ok: false, reason: `Minute ${m[5]} is not valid (00-59).` };
  if (second > 59) return { ok: false, reason: `Second ${m[6]} is not valid (00-59).` };
  let offsetMinutes = 0;
  if (m[8] !== "Z") {
    const sign = m[8][0] === "-" ? -1 : 1;
    const oh = Number(m[8].slice(1, 3)), om = Number(m[8].slice(4, 6));
    if (oh > 14 || om > 59 || oh * 60 + om > 14 * 60) return { ok: false, reason: `UTC offset ${m[8]} is not valid (between -14:00 and +14:00).` };
    offsetMinutes = sign * (oh * 60 + om);
  }
  const utc = Date.UTC(year, month - 1, day, hour, minute, second, ms) - offsetMinutes * 60000;
  if (!Number.isFinite(utc)) return { ok: false, reason: `Timestamp "${s}" could not be interpreted.` };
  return { ok: true, ms: utc };
}

/**
 * Hard limits (docs/pediatric/CLINICAL-REVIEW.md §3). Only two weight rules go
 * beyond the input domain, and both rest on documented human extremes, not on
 * percentiles: no newborn heavier than 9.98 kg is documented (Guinness World
 * Records, heaviest birth, 1879), and a 2022 registry reported a minimum of 212 g (Tiniest
 * Babies Registry, University of Iowa; 2018 case). Every other unusual weight
 * is flagged for verification by WHO/CDC z-score, never refused as impossible.
 */
export const HARD_LIMITS = {
  /** Below the smallest documented surviving birth weight (212 g), with margin. */
  weightKgMin: 0.2,
  /** Above the heaviest documented birth (9.98 kg), with margin; applied in the first 28 days. */
  newbornMaxKg: 11,
  /** Verification thresholds on weight-for-age z (WHO 2006 / CDC 2000): |z| > 3 unusual, |z| > 5 very likely a unit or age error. */
  zVerify: 3,
  zStrong: 5,
} as const;

interface Normalised {
  postnatalDays: number;
  gestationalWeeks: number;
  gestationalAssumed: boolean;
  weightKg: number;
  scrMgDl: number;
  regimen: { dose_mg: number; interval_hours: number; infusion_minutes: number };
  /** Explicit start of the next planned dose (epoch ms) or null without a dose history. */
  nextDoseStartMs: number | null;
  doses: Array<{ startMs: number; dose_mg: number; infusion_minutes: number; index: number }>;
  levels: Array<{ timeMs: number; concentration: number; index: number }>;
  flags: { unstableRenal: boolean };
}

export function validatePediatricRequest(raw: unknown): { ok: true; value: Normalised } | { ok: false; refusal: PediatricRefusal } {
  const errors: Record<string, string> = {};
  const unsupported: Record<string, string> = {};
  if (!isObj(raw)) return { ok: false, refusal: { status: "invalid", message: "A request object is required.", field_errors: { request: "A request object is required." } } };
  const p = isObj(raw.patient) ? raw.patient : undefined;
  if (!p) errors.patient = "Patient inputs are required.";
  let postnatalDays = Number.NaN;
  let gestationalWeeks = 40;
  let gestationalAssumed = true;
  let weightKg = Number.NaN;
  let scrMgDl = Number.NaN;
  if (p) {
    const age = isObj(p.postnatal_age) ? p.postnatal_age : undefined;
    if (!age || !num(age.value) || !isAgeUnit(age.unit)) errors["patient.postnatal_age"] = `Enter the postnatal age as a finite number with unit ${AGE_UNITS.join(", ")}.`;
    else {
      postnatalDays = age.value * AGE_DAYS[age.unit];
      if (!Number.isFinite(postnatalDays) || postnatalDays < 0) { errors["patient.postnatal_age"] = "Postnatal age must be zero or positive."; postnatalDays = Number.NaN; }
      else if (postnatalDays / DAYS_PER_YEAR >= SCOPE.postnatalAgeMaxYears) unsupported["patient.postnatal_age"] = "18 years and older: use the adult calculator. The pediatric preview stops at 18 years.";
    }
    if (p.gestational_age_weeks !== undefined && p.gestational_age_weeks !== null) {
      if (!num(p.gestational_age_weeks) || p.gestational_age_weeks < SCOPE.gestationalAgeWeeksMin || p.gestational_age_weeks > SCOPE.gestationalAgeWeeksMax)
        errors["patient.gestational_age_weeks"] = `Gestational age at birth must be a finite number of ${SCOPE.gestationalAgeWeeksMin}-${SCOPE.gestationalAgeWeeksMax} weeks.`;
      else { gestationalWeeks = p.gestational_age_weeks; gestationalAssumed = false; }
    } else if (Number.isFinite(postnatalDays) && postnatalDays / DAYS_PER_YEAR < SCOPE.gestationalAgeRequiredBelowYears) {
      errors["patient.gestational_age_weeks"] = "Gestational age at birth is required below 1 year of postnatal age (postmenstrual age drives maturation).";
    }
    const w = isObj(p.weight) ? p.weight : undefined;
    if (!w || !num(w.value) || !isWeightUnit(w.unit)) errors["patient.weight"] = "Enter weight as a finite number in kg or g.";
    else {
      weightKg = w.unit === "g" ? w.value / 1000 : w.value;
      const years = postnatalDays / DAYS_PER_YEAR;
      if (weightKg < HARD_LIMITS.weightKgMin) errors["patient.weight"] = `Weight ${weightKg} kg is below the smallest documented surviving birth weight (212 g; Tiniest Babies Registry); hard limit ${HARD_LIMITS.weightKgMin} kg. Check the unit.`;
      else if (weightKg > SCOPE.weightKgMax) errors["patient.weight"] = `Weight ${weightKg} kg exceeds the preview's upper limit of ${SCOPE.weightKgMax} kg (a research scope limit; the source range includes adults and does not establish a pediatric maximum). Check the unit; heavier patients are outside the pediatric preview.`;
      else if (Number.isFinite(postnatalDays) && postnatalDays < 28 && weightKg > HARD_LIMITS.newbornMaxKg) errors["patient.weight"] = `Weight ${weightKg} kg in the first 28 days of life exceeds the heaviest documented human birth weight (9.98 kg; Guinness World Records); hard limit ${HARD_LIMITS.newbornMaxKg} kg. Check whether grams were entered as kg.`;
      void years;
    }
    const s = isObj(p.serum_creatinine) ? p.serum_creatinine : undefined;
    if (!s || !num(s.value) || !isCreatinineUnit(s.unit)) errors["patient.serum_creatinine"] = "Enter serum creatinine as a finite number in mg/dL or umol/L.";
    else {
      scrMgDl = s.unit === "umol/L" ? s.value / SCOPE.umolPerMgDl : s.value;
      if (scrMgDl < SCOPE.scrMgDlMin || scrMgDl > SCOPE.scrMgDlMax) errors["patient.serum_creatinine"] = `Serum creatinine must be ${SCOPE.scrMgDlMin}-${SCOPE.scrMgDlMax} mg/dL (${(SCOPE.scrMgDlMin * SCOPE.umolPerMgDl).toFixed(0)}-${(SCOPE.scrMgDlMax * SCOPE.umolPerMgDl).toFixed(0)} umol/L).`;
    }
    for (const key of ["renal_replacement_therapy", "ecmo", "unstable_renal_function"]) {
      if (p[key] !== undefined && typeof p[key] !== "boolean") errors[`patient.${key}`] = "Must be true or false.";
    }
    if (p.route !== undefined && p.route !== "iv" && p.route !== "other") errors["patient.route"] = 'Route must be "iv" or "other".';
    if (p.renal_replacement_therapy === true) unsupported["patient.renal_replacement_therapy"] = "Haemodialysis, haemodiafiltration and CRRT were excluded from the Colin 2019 dataset; no calculation is available.";
    if (p.ecmo === true) unsupported["patient.ecmo"] = "ECMO was excluded from the Colin 2019 dataset; no calculation is available.";
    if (p.route === "other") unsupported["patient.route"] = "Only intravenous administration is modelled; non-IV routes were excluded from the dataset.";
  }
  const r = isObj(raw.regimen) ? raw.regimen : undefined;
  let nextDoseStartMs: number | null = null;
  if (!r) errors.regimen = "A current or planned maintenance regimen is required (dose, interval, infusion duration).";
  else {
    if (!num(r.dose_mg) || r.dose_mg < SCOPE.doseMgMin || r.dose_mg > SCOPE.doseMgMax) errors["regimen.dose_mg"] = `Dose must be a finite number of ${SCOPE.doseMgMin}-${SCOPE.doseMgMax} mg (enter mg, not mg/kg).`;
    if (!num(r.interval_hours) || r.interval_hours < SCOPE.intervalHoursMin || r.interval_hours > SCOPE.intervalHoursMax) errors["regimen.interval_hours"] = `Interval must be a finite number of ${SCOPE.intervalHoursMin}-${SCOPE.intervalHoursMax} hours.`;
    if (!num(r.infusion_minutes) || r.infusion_minutes < SCOPE.infusionMinutesMin || r.infusion_minutes > SCOPE.infusionMinutesMax) errors["regimen.infusion_minutes"] = `Infusion duration must be a finite number of ${SCOPE.infusionMinutesMin}-${SCOPE.infusionMinutesMax} minutes.`;
    else if (num(r.interval_hours) && num(r.infusion_minutes) && r.infusion_minutes / 60 > r.interval_hours) errors["regimen.infusion_minutes"] = "Infusion duration cannot exceed the dosing interval.";
    if (r.next_dose_start !== undefined && r.next_dose_start !== null) {
      const t = parseStrictTimestamp(r.next_dose_start);
      if (!t.ok) errors["regimen.next_dose_start"] = t.reason; else nextDoseStartMs = t.ms;
    }
  }
  const doses: Normalised["doses"] = [];
  let doseListValid = true;
  if (raw.doses !== undefined) {
    if (!Array.isArray(raw.doses) || raw.doses.length > SCOPE.maxDoses) { errors.doses = `Provide an array of at most ${SCOPE.maxDoses} administered doses.`; doseListValid = false; }
    else raw.doses.forEach((d, i) => {
      const k = `doses[${i}]`;
      if (!isObj(d)) { errors[k] = "A dose object is required."; doseListValid = false; return; }
      const t = parseStrictTimestamp(d.start);
      if (!t.ok) errors[`${k}.start`] = t.reason;
      if (!num(d.dose_mg) || d.dose_mg < SCOPE.doseMgMin || d.dose_mg > SCOPE.doseMgMax) errors[`${k}.dose_mg`] = `Dose must be a finite number of ${SCOPE.doseMgMin}-${SCOPE.doseMgMax} mg.`;
      if (!num(d.infusion_minutes) || d.infusion_minutes < SCOPE.infusionMinutesMin || d.infusion_minutes > SCOPE.infusionMinutesMax) errors[`${k}.infusion_minutes`] = `Infusion duration must be a finite number of ${SCOPE.infusionMinutesMin}-${SCOPE.infusionMinutesMax} minutes.`;
      if (t.ok && num(d.dose_mg) && num(d.infusion_minutes)) doses.push({ startMs: t.ms, dose_mg: d.dose_mg, infusion_minutes: d.infusion_minutes, index: i });
      else doseListValid = false;
    });
  }
  const levels: Normalised["levels"] = [];
  let levelListValid = true;
  if (raw.levels !== undefined) {
    if (!Array.isArray(raw.levels) || raw.levels.length > SCOPE.maxLevels) { errors.levels = `Provide an array of at most ${SCOPE.maxLevels} levels.`; levelListValid = false; }
    else raw.levels.forEach((l, i) => {
      const k = `levels[${i}]`;
      if (!isObj(l)) { errors[k] = "A level object is required."; levelListValid = false; return; }
      const t = parseStrictTimestamp(l.time);
      if (!t.ok) errors[`${k}.time`] = t.reason;
      if (!num(l.concentration_mg_l) || l.concentration_mg_l < SCOPE.concentrationMgLMin || l.concentration_mg_l > SCOPE.concentrationMgLMax) errors[`${k}.concentration_mg_l`] = `Concentration must be a finite number of ${SCOPE.concentrationMgLMin}-${SCOPE.concentrationMgLMax} mg/L (mg/L = mcg/mL).`;
      if (t.ok && num(l.concentration_mg_l)) levels.push({ timeMs: t.ms, concentration: l.concentration_mg_l, index: i });
      else levelListValid = false;
    });
    if (levels.length > 0 && doses.length === 0 && !errors.doses) errors.doses = "Measured levels require the actual dose history (every administration before the levels).";
  }
  // Chronology checks run only when every dose and level parsed, so that each
  // message refers to the entries as supplied (entries are never moved).
  if (doseListValid && levelListValid && doses.length > 0) {
    const byTime = doses.slice().sort((a, b) => a.startMs - b.startMs || a.index - b.index);
    for (let i = 1; i < byTime.length; i++) {
      const prev = byTime[i - 1], cur = byTime[i];
      const prevEnd = prev.startMs + prev.infusion_minutes * 60000;
      if (cur.startMs === prev.startMs) errors[`doses[${cur.index}].start`] = `Starts at the same time as dose ${prev.index + 1}; duplicate administrations are not accepted.`;
      else if (cur.startMs < prevEnd) errors[`doses[${cur.index}].start`] = `Starts before the infusion of dose ${prev.index + 1} ends (${new Date(prevEnd).toISOString()}); overlapping infusions are not accepted.`;
    }
    const span = (byTime[byTime.length - 1].startMs - byTime[0].startMs) / 86400000;
    if (span > SCOPE.historyMaxDays) errors.doses = `The dose history spans more than ${SCOPE.historyMaxDays} days; enter the recent course only.`;
    const firstStart = byTime[0].startMs;
    const last = byTime[byTime.length - 1];
    const lastEnd = last.startMs + last.infusion_minutes * 60000;
    if (nextDoseStartMs !== null) {
      if (nextDoseStartMs < lastEnd) errors["regimen.next_dose_start"] = `The next planned dose cannot start before the last recorded infusion ends (${new Date(lastEnd).toISOString()}).`;
      else if (nextDoseStartMs > last.startMs + 7 * 86400000) errors["regimen.next_dose_start"] = "The next planned dose is more than 7 days after the last recorded dose; record the intervening doses or shorten the history.";
    }
    if (nextDoseStartMs === null) errors["regimen.next_dose_start"] ??= "Enter the next planned dose start time explicitly when a dose history is supplied; no time is inferred from the regimen.";
    const anchor = nextDoseStartMs;
    for (const l of levels) {
      const k = `levels[${l.index}].time`;
      if (l.timeMs <= firstStart) errors[k] = `Drawn at or before the first recorded dose (${new Date(firstStart).toISOString()}); a level before any modelled dose cannot be fitted.`;
      else if (l.timeMs > last.startMs + 7 * 86400000) errors[k] = "More than 7 days after the last recorded dose; outside the modelled window.";
      else if (anchor !== null && l.timeMs >= anchor) errors[k] = `Drawn at ${new Date(l.timeMs).toISOString()}, which is at or after the next planned dose (${new Date(anchor).toISOString()}); set regimen.next_dose_start after every level.`;
    }
    for (let i = 0; i < levels.length; i++) for (let j = i + 1; j < levels.length; j++) {
      if (Math.abs(levels[i].timeMs - levels[j].timeMs) < 60000 && Math.abs(levels[i].concentration - levels[j].concentration) / Math.max(levels[i].concentration, levels[j].concentration) > 0.2)
        errors[`levels[${levels[j].index}]`] = `Within a minute of level ${levels[i].index + 1} but differs by more than 20%; reconcile the entries before fitting.`;
    }
  } else if (nextDoseStartMs !== null && doses.length === 0 && doseListValid) {
    errors["regimen.next_dose_start"] = "A next-dose start time only applies when a dose history is supplied.";
  }
  if (Object.keys(unsupported).length) return { ok: false, refusal: { status: "unsupported", message: "Outside the supported population; no calculation was performed.", field_errors: { ...unsupported, ...errors } } };
  if (Object.keys(errors).length) return { ok: false, refusal: { status: "invalid", message: "Invalid inputs; no calculation was performed.", field_errors: errors } };
  return {
    ok: true,
    value: {
      postnatalDays, gestationalWeeks, gestationalAssumed, weightKg, scrMgDl,
      regimen: { dose_mg: r!.dose_mg as number, interval_hours: r!.interval_hours as number, infusion_minutes: r!.infusion_minutes as number },
      nextDoseStartMs,
      doses: doses.slice().sort((a, b) => a.startMs - b.startMs), levels: levels.slice().sort((a, b) => a.timeMs - b.timeMs),
      flags: { unstableRenal: p!.unstable_renal_function === true },
    },
  };
}

/** Paths of every non-finite number in a result (defence in depth: a successful result must contain none). */
export function nonFinitePaths(value: unknown, path = "", out: string[] = []): string[] {
  if (typeof value === "number") { if (!Number.isFinite(value)) out.push(path || "(root)"); }
  else if (Array.isArray(value)) value.forEach((v, i) => nonFinitePaths(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value as Record<string, unknown>)) nonFinitePaths(v, path ? `${path}.${k}` : k, out);
  return out;
}

/** Required numeric fields of a successful result that must never be null or non-finite. */
const REQUIRED_NUMERIC_PATHS = [
  "derived.postnatal_age_days", "derived.pma_years", "derived.pma_weeks", "derived.weight_kg", "derived.scr_mg_dl", "derived.scr_std_mg_dl",
  "prior.parameters.CL", "prior.parameters.V1", "prior.parameters.V2", "prior.parameters.Q",
  "prior.exposure.steady_state_auc24", "prior.exposure.steady_state_peak", "prior.exposure.steady_state_trough", "prior.exposure.terminal_half_life_hours",
  "prior.exposure.steady_state_auc24_interval.lower", "prior.exposure.steady_state_auc24_interval.median", "prior.exposure.steady_state_auc24_interval.upper",
  "sensitivity.article_transcription.CL", "sensitivity.article_transcription.steady_state_auc24",
];
function missingRequiredNumbers(result: PediatricResult): string[] {
  const out: string[] = [];
  for (const path of REQUIRED_NUMERIC_PATHS) {
    const v = path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), result);
    if (!num(v)) out.push(path);
  }
  if (result.posterior) for (const k of ["CL", "V1", "V2", "Q"] as const) if (!num(result.posterior.parameters[k])) out.push(`posterior.parameters.${k}`);
  if (result.posterior && !num(result.posterior.exposure.steady_state_auc24)) out.push("posterior.exposure.steady_state_auc24");
  return out;
}

// ── Exposure helpers ─────────────────────────────────────────────────────────

/** Explicit forecast anchor, or zero for a history-free illustrative regimen. */
function nextDoseHours(history: DoseEvent[], regimen: Normalised["regimen"], anchorHours: number | null): number {
  if (anchorHours !== null) return anchorHours;
  if (history.length) throw new Error("A dose history requires an explicit next-dose timestamp.");
  return 0;
}

function plannedSchedule(history: DoseEvent[], regimen: Normalised["regimen"], hours: number, anchorHours: number | null): { schedule: DoseEvent[]; nextStart: number } {
  const tau = regimen.interval_hours;
  const T_inf = regimen.infusion_minutes / 60;
  const nextStart = nextDoseHours(history, regimen, anchorHours);
  const schedule = history.slice();
  for (let t = nextStart; t < nextStart + hours + 1e-9; t += tau) schedule.push({ time: t, dose_mg: regimen.dose_mg, T_inf });
  return { schedule, nextStart };
}

function exposureFor(params: TwoCompartmentParameters, history: DoseEvent[], regimen: Normalised["regimen"], anchorHours: number | null): ExposureBlock {
  const ss = computeExposure({ ...params, dose_mg: regimen.dose_mg, tau: regimen.interval_hours, T_inf: regimen.infusion_minutes / 60 });
  let forecast: number | null = null;
  let observed: number | null = null;
  if (history.length) {
    const { schedule, nextStart } = plannedSchedule(history, regimen, 24, anchorHours);
    forecast = aucFromHistory(params, schedule, nextStart, nextStart + 24);
    observed = aucFromHistory(params, history, Math.max(0, nextStart - 24), nextStart);
  }
  return {
    steady_state_auc24: ss.auc24,
    steady_state_peak: ss.peak,
    steady_state_trough: ss.trough,
    forecast_auc24_next24h: forecast,
    observed_window_auc24: observed,
    terminal_half_life_hours: terminalHalfLifeHours(params),
  };
}

function candidateRegimens(params: TwoCompartmentParameters, weightKg: number): CandidateRegimen[] {
  const out: CandidateRegimen[] = [];
  for (const mgkg of SCOPE.candidateDosesMgPerKg) for (const tau of SCOPE.candidateIntervalsHours) {
    const dose = Math.max(1, Math.round(mgkg * weightKg));
    const minutes = Math.max(60, Math.ceil(dose / SCOPE.maxInfusionRateMgPerMin / 15) * 15);
    if (minutes / 60 > tau) continue;
    const e = computeExposure({ ...params, dose_mg: dose, tau, T_inf: minutes / 60 });
    const daily = (dose * 24) / tau / weightKg;
    const flags: string[] = [];
    if (daily > 100) flags.push("daily dose above 100 mg/kg");
    if (dose > 2000) flags.push("single dose above 2000 mg");
    if (e.trough > 20) flags.push("predicted trough above 20 mg/L");
    out.push({
      dose_mg: dose, dose_mg_per_kg: mgkg, interval_hours: tau, infusion_minutes: minutes, daily_dose_mg_per_kg: daily,
      auc24: e.auc24, peak: e.peak, trough: e.trough,
      in_target: e.auc24 >= SCOPE.targetAuc24.low && e.auc24 <= SCOPE.targetAuc24.high, flags,
    });
  }
  return out;
}

function drawExposures(cov: PediatricCovariates, formulation: Colin2019Formulation, etas: Eta[], history: DoseEvent[], regimen: Normalised["regimen"], anchorHours: number | null, weights?: number[]): { ss: Interval; forecast: Interval | null } {
  const ss: number[] = [];
  const fc: number[] = [];
  const planned = history.length ? plannedSchedule(history, regimen, 24, anchorHours) : null;
  for (const eta of etas) {
    const p = individualParameters(cov, eta, formulation);
    ss.push((regimen.dose_mg * 24) / regimen.interval_hours / p.CL);
    if (planned) fc.push(aucFromHistory(p, planned.schedule, planned.nextStart, planned.nextStart + 24));
  }
  const summarise = (v: number[]) => (weights ? summariseWeightedDraws(v, weights) : summariseDraws(v));
  return { ss: summarise(ss), forecast: planned ? summarise(fc) : null };
}

// ── Main entry ───────────────────────────────────────────────────────────────

export function runPediatricEngine(raw: unknown, formulation: Colin2019Formulation = ACTIVE_FORMULATION): PediatricOutcome {
  const v = validatePediatricRequest(raw);
  if (!v.ok) return v.refusal;
  const n = v.value;
  const warnings: string[] = [];
  const assumptions: string[] = [];
  const review: InputReviewItem[] = [];
  const inputsVerified = isObj(raw) && raw.inputs_verified === true;
  const limitations: string[] = [
    "Weight cutoffs are provisional research scope, not validated physiological boundaries. Growth-chart verification is not clinical validation; external evaluation and clinical review remain required.",
    "Colin 2019 pooled 14 studies (2554 individuals, 559 newborns, 118 children/adolescents); it is model-development data, not an external validation of this software, and inclusion of a population in the pooled fit does not establish clinical validation for that population.",
    `The pediatric data behind the model: newborns from four studies (PMA ${SUPPORT.pediatricPmaGapYears.from} years or less at inclusion) and ${SUPPORT.childrenAdolescents} children/adolescents from a single study (van der Meer et al.; PMA ${SUPPORT.pediatricPmaGapYears.to} years or more, weight 8.7 kg or more); no study contributed postmenstrual ages between those values.`,
    "The clearance parameterisation in use (supplementary NONMEM control stream) is a research candidate pending the authors' clarification of the article/supplement discrepancy; the article transcription is shown as a sensitivity row.",
    "Pediatric exposure-response evidence for AUC24 400-600 mg·h/L is largely extrapolated from adults; nephrotoxicity thresholds in children are not established by this model.",
    "Serum creatinine enters the model directly (mg/dL) relative to an age-standardised creatinine; no creatinine-clearance equation is used and neonatal creatinine in the first days reflects maternal creatinine.",
    "Point estimates are MAP (posterior mode) parameters; credible intervals come from importance sampling of the exact posterior and carry parameter uncertainty only, not assay error of a future level. The posterior median AUC24 (reported with the interval) sits a few percent above the MAP value.",
    "Study-specific covariates of the published model (heel-prick sampling, haematological malignancy) are implemented in the engine but not offered as patient inputs in this preview.",
    "Dialysis, haemodiafiltration, CRRT, ECMO and non-intravenous administration are refused because they were excluded from the source dataset.",
  ];

  const pmaYears = postmenstrualAgeYears(n.gestationalWeeks, n.postnatalDays);
  const pmaWeeks = pmaYears * WEEKS_PER_MODEL_YEAR;
  const pmaWeeksClinical = clinicalPostmenstrualAgeWeeks(n.gestationalWeeks, n.postnatalDays);
  const fieldErrors: Record<string, string> = {};
  if (pmaWeeks < SCOPE.pmaWeeksMin) fieldErrors["patient.gestational_age_weeks"] = `Postmenstrual age ${pmaWeeks.toFixed(1)} weeks is below the lowest value in the Colin 2019 dataset (${SCOPE.pmaWeeksMin} weeks); no calculation is available.`;
  const gap = SUPPORT.pediatricPmaGapYears;
  if (pmaYears > gap.from && pmaYears < gap.to) {
    // Postnatal-age equivalents of the gap for the entered gestational age (chronological days).
    const pnaFrom = Math.max(0, (gap.from - n.gestationalWeeks / WEEKS_PER_MODEL_YEAR) * DAYS_PER_YEAR);
    const pnaTo = (gap.to - n.gestationalWeeks / WEEKS_PER_MODEL_YEAR) * DAYS_PER_YEAR;
    fieldErrors["patient.postnatal_age"] = `Postmenstrual age ${pmaYears.toFixed(3)} years falls in the Colin 2019 dataset gap: no component study enrolled individuals with a postmenstrual age above ${gap.from} years (${gap.fromEvidence}) and below ${gap.to} years (${gap.toEvidence}). For a gestational age of ${n.gestationalWeeks} weeks that is a postnatal age of ${pnaFrom.toFixed(0)} to ${pnaTo.toFixed(0)} days (${(pnaFrom / DAYS_PER_YEAR).toFixed(2)}-${(pnaTo / DAYS_PER_YEAR).toFixed(2)} years). The preview refuses to extrapolate; no acknowledgement can override this.`;
  }
  if (Object.keys(fieldErrors).length) return { status: "unsupported", message: "Outside the supported population; no calculation was performed.", field_errors: fieldErrors };
  if (n.gestationalAssumed) assumptions.push("Gestational age at birth was not entered: 40 weeks assumed (as the authors did for subjects with missing gestational age).");
  assumptions.push(`Model postmenstrual age = postnatal age ${n.postnatalDays.toFixed(1)} days / ${DAYS_PER_YEAR} + gestational age ${n.gestationalWeeks} weeks / ${WEEKS_PER_MODEL_YEAR} = ${pmaYears.toFixed(4)} years (${pmaWeeks.toFixed(2)} model weeks); clinical PMA = ${pmaWeeksClinical.toFixed(2)} weeks. This reproduces the source model's reference individual (35 + 40/52 years) and its non-neonatal rule exactly; see AGE-CONVENTION.md.`);
  const add = (field: string, category: InputReviewCategory, message: string, source: string) => { review.push({ field, category, message, source }); warnings.push(message); };
  if (n.postnatalDays < 3) add("patient.serum_creatinine", "clinical_validity_unknown", "Postnatal age under 72 hours: newborn serum creatinine reflects maternal creatinine in the first 72 hours, so the model's creatinine term may not represent the infant's own renal function.", "Evans RE et al. Front Pediatr 2023;11:1270200 (review); Miall LS et al. Pediatrics 1999;104:e76");
  if (n.postnatalDays < DAYS_PER_YEAR && (n.postnatalDays < SUPPORT.neonatalPnaDaysMin || n.postnatalDays > SUPPORT.neonatalPnaDaysMax)) add("patient.postnatal_age", "outside_model_population", `Postnatal age ${n.postnatalDays.toFixed(0)} days is outside the neonatal datasets' postnatal range (${SUPPORT.neonatalPnaDaysMin}-${SUPPORT.neonatalPnaDaysMax} days at inclusion).`, "Colin 2019 Table 1");
  if (n.weightKg < SUPPORT.weightKgMin) add("patient.weight", "outside_model_population", `Weight ${n.weightKg.toFixed(2)} kg is below the lowest weight in the model's development data (${SUPPORT.weightKgMin} kg, Allegaert et al.).`, "Colin 2019 Table 1");
  {
    // Model-population boundary (Table 1, at inclusion): reported, never applied as eligibility.
    const neonatalBand = n.postnatalDays <= SUPPORT.neonatalPnaDaysMax;
    const band = neonatalBand ? { label: "neonates/young infants", min: 0.42, max: 4.45 } : { label: "children and adolescents", min: 8.7, max: 160 };
    if (n.weightKg < band.min || n.weightKg > band.max) add("patient.weight", "outside_model_population", `Weight ${n.weightKg.toFixed(2)} kg is outside the model population for ${band.label} (${band.min}-${band.max} kg in the source dataset at inclusion); the allometric scaling is extrapolated.`, "Colin 2019 Table 1");
  }
  {
    // Weight-for-age verification flag (WHO 2006 standard to 5 y, CDC 2000 reference to 20 y); corrected age for preterm birth under 2 years.
    const preterm = !n.gestationalAssumed && n.gestationalWeeks < 37;
    const correctedYears = preterm && n.postnatalDays < 2 * DAYS_PER_YEAR ? pmaYears - 40 / WEEKS_PER_MODEL_YEAR : n.postnatalDays / DAYS_PER_YEAR;
    if (correctedYears < 0) add("patient.weight", "clinical_validity_unknown", `Preterm infant below term-equivalent age (${pmaWeeks.toFixed(1)} model weeks PMA): no preterm growth reference is loaded, so weight-for-age was not checked. Verify the weight against the unit's preterm (Fenton 2013) chart.`, "Fenton TR, Kim JH. BMC Pediatr 2013;13:59");
    else {
      const g = weightForAge(n.weightKg, correctedYears * 12);
      if (g) {
        const z = g.zPermissive;
        const ageLabel = preterm && n.postnatalDays < 2 * DAYS_PER_YEAR ? `corrected age ${(correctedYears * 12).toFixed(1)} months` : `${(correctedYears * 12).toFixed(1)} months`;
        const src = g.source === "WHO2006" ? "WHO Child Growth Standards 2006, weight-for-age (standard, 0-5 y)" : "CDC 2000 growth charts, weight-for-age (reference, 2-20 y)";
        if (Math.abs(z) > HARD_LIMITS.zStrong) add("patient.weight", "verify", `Weight ${n.weightKg.toFixed(2)} kg at ${ageLabel} is ${z > 0 ? "above" : "below"} the reference by ${Math.abs(z).toFixed(1)} SD (z ${z.toFixed(1)}; medians ${g.medianBoysKg.toFixed(1)} kg boys / ${g.medianGirlsKg.toFixed(1)} kg girls). A value this far from the reference is most often a unit (g vs kg) or age-entry error. Verify weight, unit and age on the chart before continuing.`, src);
        else if (Math.abs(z) > HARD_LIMITS.zVerify) add("patient.weight", "verify", `Weight ${n.weightKg.toFixed(2)} kg at ${ageLabel} is ${z > 0 ? "above" : "below"} the reference by ${Math.abs(z).toFixed(1)} SD (z ${z.toFixed(1)}; medians ${g.medianBoysKg.toFixed(1)} kg boys / ${g.medianGirlsKg.toFixed(1)} kg girls). Unusual for age: verify weight, unit and age on the chart.`, src);
        if (z > 2) add("patient.weight", "clinical_validity_unknown", `Weight-for-age above +2 SD (z ${z.toFixed(1)}). Obesity cannot be classified without height. The 2020 consensus guideline makes no different mg/kg empiric recommendation for obese children but regards therapeutic monitoring as of particular value in them; the model was evaluated externally in obese adults, not obese children.`, "Rybak MJ et al. 2020 consensus guideline recs 23-24; Colin PJ et al. Ther Drug Monit 2021 (obese adults)");
      }
    }
  }
  if (n.scrMgDl < SUPPORT.scrMgDlMin || n.scrMgDl > SUPPORT.scrMgDlMax) add("patient.serum_creatinine", "outside_model_population", `Serum creatinine ${n.scrMgDl.toFixed(2)} mg/dL is outside the development data range (${SUPPORT.scrMgDlMin}-${SUPPORT.scrMgDlMax} mg/dL).`, "Colin 2019 Table 1");
  if (n.flags.unstableRenal) add("patient.unstable_renal_function", "clinical_validity_unknown", "Unstable (deteriorating or recovering) renal function: the source model was estimated with creatinine as a time-varying covariate, but this preview uses a single creatinine value and assumes constant clearance over the modelled window and the forecast. Predictions under changing renal function are not validated; the guideline calls for frequent monitoring in such patients.", "Colin 2019 Results 3.2 (time-varying SCr, ΔOFV +876 if baseline); Rybak 2020 recs 4 and 20; KDIGO 2012 AKI definition");
  if (review.some((x) => x.category === "verify") && !inputsVerified) {
    return { status: "needs_verification", message: "Some inputs are unusual for age. Verify them against the chart and resubmit with inputs_verified set to true. No calculation was performed.", input_review: review, field_errors: Object.fromEntries(review.filter((x) => x.category === "verify").map((x) => [x.field, x.message])) };
  }

  const cov: PediatricCovariates = { pmaYears, weightKg: n.weightKg, scrMgDl: n.scrMgDl };
  const prior = typicalParameters(cov, formulation);
  const article = typicalParameters(cov, "article_transcription");
  const originMs = n.doses.length ? n.doses[0].startMs : null;
  const history: DoseEvent[] = n.doses.map((d) => ({ time: (d.startMs - (originMs as number)) / 3600000, dose_mg: d.dose_mg, T_inf: d.infusion_minutes / 60 }));
  const observations: Observation[] = n.levels.map((l) => ({ timeHours: (l.timeMs - (originMs as number)) / 3600000, concentration: l.concentration }));
  const anchorHours = n.nextDoseStartMs !== null && originMs !== null ? (n.nextDoseStartMs - originMs) / 3600000 : null;
  const nextStartHours = history.length ? nextDoseHours(history, n.regimen, anchorHours) : null;
  if (history.length && observations.some((o) => o.timeHours >= (nextStartHours as number))) {
    // Validation guarantees this cannot happen; keep the engine fail-closed regardless.
    return { status: "invalid", message: "Invalid inputs; no calculation was performed.", field_errors: { levels: "A level lies at or after the forecast start." } };
  }
  observations.forEach((o, i) => {
    const during = history.find((d) => o.timeHours >= d.time && o.timeHours <= d.time + d.T_inf);
    if (during) warnings.push(`Level ${i + 1} was drawn during an infusion; it is modelled at the recorded time but is sensitive to line/timing errors.`);
    if (o.concentration < 1) warnings.push(`Level ${i + 1} (${o.concentration} mg/L) is near typical assay quantification limits; the additive error term dominates its information.`);
  });
  if (history.length && !n.levels.length) assumptions.push("No measured level: estimates are population (prior-only) predictions from the recorded doses.");
  if (!history.length) assumptions.push("No dose history: only steady-state exposure of the entered regimen is shown; no forecast is possible.");

  const priorExposure = exposureFor(prior, history, n.regimen, anchorHours);
  const priorDraws = drawEta({ CL: 0, V1: 0, V2: 0 }, null);
  const priorIntervals = drawExposures(cov, formulation, priorDraws, history, n.regimen, anchorHours);
  priorExposure.steady_state_auc24_interval = priorIntervals.ss;
  priorExposure.forecast_auc24_interval = priorIntervals.forecast;

  let posterior: PediatricResult["posterior"];
  let basis: EstimateBasis = "prior_only";
  let bestParams: TwoCompartmentParameters = prior;
  if (observations.length) {
    const fit = fitEta({ covariates: cov, formulation, schedule: history, observations });
    warnings.push(...fit.warnings);
    if (fit.success) {
      basis = observations.length === 1 ? "posterior_one_level" : observations.length === 2 ? "posterior_two_level" : "posterior_multi_level";
      bestParams = fit.parameters;
      const exposure = exposureFor(fit.parameters, history, n.regimen, anchorHours);
      // Credible intervals from the exact posterior (importance sampling), not the Laplace normal.
      const sampled = posteriorDraws(fit, { covariates: cov, formulation, schedule: history, observations });
      const iv = drawExposures(cov, formulation, sampled.etas, history, n.regimen, anchorHours, sampled.weights);
      exposure.steady_state_auc24_interval = iv.ss;
      exposure.forecast_auc24_interval = iv.forecast;
      if (sampled.effectiveSampleSize < IS_MIN_ESS) warnings.push(`Posterior sampling effective sample size is low (${sampled.effectiveSampleSize.toFixed(0)} of ${sampled.etas.length} draws); the credible intervals are imprecise.`);
      if (observations.length === 1) warnings.push("One level: clearance and central volume are not separately identifiable from a single sample; the posterior leans on the prior for volume.");
      posterior = {
        parameters: { ...pick(fit.parameters), eta: fit.eta },
        exposure,
        fit: {
          success: fit.success, converged: fit.converged, iterations: fit.iterations, starts: fit.starts, objective: fit.objective,
          nll: fit.objectiveComponents.nll, prior_penalty: fit.objectiveComponents.priorPenalty, eta_sd: fit.etaSd,
          posterior_sampling: { method: sampled.method, draws: sampled.etas.length, effective_sample_size: sampled.effectiveSampleSize },
          predicted_at_levels: fit.predictedAtObservations, warnings: fit.warnings,
        },
      };
      const bad = fit.predictedAtObservations.filter((x) => Math.abs(x.standardisedResidual) > 3);
      if (bad.length) warnings.push(`${bad.length} level(s) lie more than 3 residual SDs from the posterior prediction; check timing, units and dose entries before using the fit.`);
    } else {
      warnings.push("The posterior fit was rejected; results remain on the population prior.");
    }
  }

  const result: PediatricResult = {
    status: "ok",
    research_only: true,
    notice: PEDIATRIC_RESEARCH_NOTICE,
    manifest_version: PEDIATRIC_MODEL_MANIFEST_VERSION,
    model: "colin_2019",
    formulation,
    estimate_basis: basis,
    level_count: observations.length,
    derived: {
      postnatal_age_days: n.postnatalDays, postnatal_age_years: n.postnatalDays / DAYS_PER_YEAR,
      gestational_age_weeks: n.gestationalWeeks, gestational_age_assumed: n.gestationalAssumed,
      pma_weeks: pmaWeeks, pma_years: pmaYears, pma_weeks_clinical: pmaWeeksClinical,
      age_convention: "PMA_years = postnatal_days/365.25 + gestational_weeks/52",
      weight_kg: n.weightKg, scr_mg_dl: n.scrMgDl,
      scr_std_mg_dl: prior.factors.scrStd, covariate_factors: prior.factors,
    },
    prior: { parameters: pick(prior), exposure: priorExposure },
    posterior,
    sensitivity: {
      article_transcription: { CL: article.CL, steady_state_auc24: (n.regimen.dose_mg * 24) / n.regimen.interval_hours / article.CL },
      clearance_ratio_fitted_to_article: prior.CL / article.CL,
    },
    target: { auc24_low: SCOPE.targetAuc24.low, auc24_high: SCOPE.targetAuc24.high, statement: "AUC24 400-600 mg·h/L: serious MRSA infection, assuming MIC 1 mg/L; pediatric evidence largely extrapolated from adults." },
    candidate_regimens: candidateRegimens(bestParams, n.weightKg),
    input_review: { items: review, verified: inputsVerified },
    timeline: originMs !== null ? {
      origin: new Date(originMs).toISOString(),
      doses: n.doses.map((d, i) => ({ row: d.index + 1, start: new Date(d.startMs).toISOString(), end: new Date(d.startMs + d.infusion_minutes * 60000).toISOString(), start_hours: history[i].time, dose_mg: d.dose_mg, infusion_minutes: d.infusion_minutes })),
      levels: n.levels.map((l, i) => ({ row: l.index + 1, time: new Date(l.timeMs).toISOString(), time_hours: observations[i].timeHours, concentration_mg_l: l.concentration })),
      last_dose_start_hours: history[history.length - 1].time,
      next_planned_dose_hours: nextStartHours as number,
      next_planned_dose: new Date(originMs + (nextStartHours as number) * 3600000).toISOString(),
      next_dose_anchor: "regimen.next_dose_start",
      forecast_window: { start_hours: nextStartHours as number, end_hours: (nextStartHours as number) + 24, start: new Date(originMs + (nextStartHours as number) * 3600000).toISOString(), end: new Date(originMs + ((nextStartHours as number) + 24) * 3600000).toISOString() },
      last_level_hours: observations.length ? Math.max(...observations.map((o) => o.timeHours)) : null,
    } : undefined,
    warnings,
    assumptions: [
      ...assumptions,
      `Computed with the "${formulation}" parameterisation (supplementary control stream: θCL = clearance of the reference 35-year-old with maturation and decline normalised to that individual). This is a research candidate pending the authors' clarification; the article-transcription value is shown as a sensitivity row and is ${(100 * (1 - article.CL / prior.CL)).toFixed(1)}% lower.`,
      `Forecast AUC24 is the 24 h starting at the next planned dose${history.length ? ` (regimen.next_dose_start as entered: ${new Date((originMs as number) + (nextStartHours as number) * 3600000).toISOString()}, after every level used for the fit)` : ""}, with the recorded history continued on the entered regimen; steady-state AUC24 is daily dose divided by clearance and assumes the regimen continues unchanged to steady state.`,
    ],
    limitations,
  };
  // Defence in depth: a successful result must never carry NaN, Infinity or a missing required number.
  const bad = [...nonFinitePaths(result), ...missingRequiredNumbers(result)];
  if (bad.length) return { status: "invalid", message: "The calculation produced a non-finite or missing value and was discarded.", field_errors: { request: `Non-finite or missing result fields: ${Array.from(new Set(bad)).slice(0, 8).join(", ")}.` } };
  result.research_regimens = researchRegimens(result, raw as PediatricRequest, c => exposureFor(bestParams, history, c, anchorHours).forecast_auc24_next24h);
  return result;
}

function pick(p: TwoCompartmentParameters): TwoCompartmentParameters {
  return { CL: p.CL, V1: p.V1, Q: p.Q, V2: p.V2 };
}

/** Concentration curve for display (history + planned regimen for `hours` after the next planned dose). */
export function pediatricCurve(result: PediatricResult, raw: PediatricRequest, hours = 48): Array<{ time_hours: number; prior: number; posterior?: number }> {
  const v = validatePediatricRequest(raw);
  if (!v.ok) return [];
  const n = v.value;
  const originMs = n.doses.length ? n.doses[0].startMs : 0;
  const history: DoseEvent[] = n.doses.map((d) => ({ time: (d.startMs - originMs) / 3600000, dose_mg: d.dose_mg, T_inf: d.infusion_minutes / 60 }));
  const anchorHours = n.nextDoseStartMs !== null && n.doses.length ? (n.nextDoseStartMs - originMs) / 3600000 : null;
  const { schedule, nextStart } = plannedSchedule(history, n.regimen, hours, anchorHours);
  const end = nextStart + hours;
  const prior = result.prior.parameters;
  const post = result.posterior?.parameters;
  const pts: Array<{ time_hours: number; prior: number; posterior?: number }> = [];
  const step = Math.max(0.25, end / 400);
  for (let t = 0; t <= end + 1e-9; t += step) {
    const row: { time_hours: number; prior: number; posterior?: number } = { time_hours: t, prior: concentrationFromHistory(prior, schedule, t) };
    if (post) row.posterior = concentrationFromHistory(post, schedule, t);
    pts.push(row);
  }
  return pts;
}
