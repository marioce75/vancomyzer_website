/** Local research prototype: elapsed-dose projection uses the exact released
 * Colin parameters and doseHistory kernel. No I/O or dosage advice. */
import { runExistingRegimenPipeline, type ExistingRegimenPipelineInput } from "../pk/runExistingRegimenPipeline";
import { buildPriorParameters } from "../pk/posterior/buildPriorParameters";
import { concentrationFromHistory } from "../pk/doseHistory";
import { parseDatetimeHours } from "../studyTimed/predictAtDraw";
import type { CalculateRequestLevel, CalculateRequestPatient } from "../../types/calculator";

const MS_H = 3_600_000, MS_MIN = 60_000;
const same = (a: number, b: unknown) => typeof b === "number" && Math.abs(a - b) < 1e-8;
const bounded = (v: number, low: number, high: number) => Number.isFinite(v) && v >= low && v <= high;
export interface ManualAdministration { start_ms: number; dose_mg: number; infusion_minutes: number }
type Basis = ExistingRegimenPipelineInput["regimen"];
type Failed = { ok: false; reason: string };
const failed = (reason: string): Failed => ({ ok: false, reason });

function orderedValid(rows: ManualAdministration[]) {
  if (!rows.length || rows.length > 500) return null;
  const sorted = [...rows].sort((a, b) => a.start_ms - b.start_ms);
  for (let i=0; i<sorted.length; i++) {
    const row = sorted[i];
    if (!Number.isSafeInteger(row.start_ms) || !bounded(row.dose_mg, 1, 6000) || !bounded(row.infusion_minutes, 1, 720)) return null;
    if (i && row.start_ms < sorted[i-1].start_ms + sorted[i-1].infusion_minutes * MS_MIN - 0.001) return null;
  }
  return sorted;
}

/** Lossless adapter for histories the published bedside request can represent.
 * Returns no equivalent request for irregular maintenance or ambiguous loading.
 * This pure mapping preserves unrelated release options already explicitly set. */
export function manualRegimenFromRows(rows: ManualAdministration[], basis: Basis): Failed | { ok: true; regimen: Basis } {
  const sorted = orderedValid(rows);
  if (!sorted) return failed("The actual dose history is invalid or contains overlapping administrations.");
  if (basis.suggested_dose_not_given === true) return failed("A suggested but unadministered dose is not an actual administration.");
  const last = sorted[sorted.length-1];
  const interval = typeof basis.interval_hours === "number" && basis.interval_hours > 0 ? basis.interval_hours : 0;
  if (!interval) return failed("The published level-fitting workflow requires a documented maintenance interval.");
  const loading = sorted.length > 1 && typeof basis.loading_dose_mg === "number" && basis.loading_dose_mg > 0;
  if (loading) {
    const first = sorted[0];
    const startGap = (sorted[1].start_ms - first.start_ms) / MS_H;
    if (!same(first.dose_mg,basis.loading_dose_mg)
      || !same(first.infusion_minutes/60,basis.loading_infusion_duration_hours ?? basis.infusion_duration_hours)
      || !same(startGap,basis.loading_to_maintenance_hours ?? interval)) {
      return failed("The first dose is not the documented loading dose or does not match its duration or gap. The published posterior cannot fit this timeline safely.");
    }
  }
  const maintenance = loading ? sorted.slice(1) : sorted;
  for (let i=0; i<maintenance.length; i++) {
    const a=maintenance[i];
    if (!same(a.dose_mg,last.dose_mg) || !same(a.infusion_minutes,last.infusion_minutes)
      || (i && !same((a.start_ms-maintenance[i-1].start_ms)/MS_H,interval))) {
      return failed("Irregular maintenance dosing cannot be represented by the published level-fitting workflow. No posterior curve was drawn.");
    }
  }
  if (last.infusion_minutes/60 >= interval) return failed("Infusion duration must be less than the documented maintenance interval.");
  // Same values are retained byte-for-byte when equivalent; the exact elapsed
  // history is still used by the separate finite curve through the requested draw.
  const sameHistory = same(last.dose_mg,basis.dose_mg) && same(last.infusion_minutes/60,basis.infusion_duration_hours)
    && same(sorted.length,basis.doses_given);
  const regimen: Basis = {
    ...basis,
    dose_mg: same(last.dose_mg,basis.dose_mg) ? basis.dose_mg : last.dose_mg,
    interval_hours: interval,
    infusion_duration_hours: same(last.infusion_minutes/60,basis.infusion_duration_hours) ? basis.infusion_duration_hours : last.infusion_minutes/60,
    doses_given: sorted.length,
    steady_state_confirmed: sameHistory ? basis.steady_state_confirmed : false,
  };
  return { ok: true, regimen };
}

export function exactUtc(date: string, time: string) {
  if (!date || !time) return null;
  const elapsed = parseDatetimeHours(date + "T" + time + "Z");
  return elapsed === null ? null : Math.round(elapsed * MS_H);
}

export type ManualProjection = Failed | {
  ok: true; method: "population" | "posted-earlier-levels"; drawHour: number; concentration: number;
  curve: { time_hours: number; concentration: number }[]; doses_used: number; fit_levels_used: number;
};

/** Plot recorded doses through an exact held-out draw. No network; no future
 * doses, no target concentration and no steady-state projection on this plot. */
export function manualProjection(input: {
  patient: CalculateRequestPatient; rrt: boolean | null; rows: ManualAdministration[];
  drawMs: number; complete: boolean; basis: Basis; fitLevels: CalculateRequestLevel[];
}): ManualProjection {
  const { patient, rrt, rows, drawMs, complete, basis, fitLevels } = input;
  if (!complete) return failed("Confirm that all doses actually given through the draw are listed.");
  if (rrt !== false) return failed("Select No for renal replacement therapy. This adult research forecast does not support dialysis.");
  if (!bounded(patient.age,18,120) || !bounded(patient.weight_kg,30,400) || !bounded(patient.serum_creatinine_mg_dl,0.1,10))
    return failed("Complete age, weight and serum creatinine in the supported adult calculator range.");
  if (!Number.isSafeInteger(drawMs) || rows.some(r => !Number.isSafeInteger(r.start_ms))) return failed("Select an exact UTC date and time for every start and the draw.");
  if (rows.some(r => r.start_ms === drawMs)) return failed("A dose starts exactly at the draw. Its ordering is ambiguous.");
  const given = orderedValid(rows.filter(r => r.start_ms < drawMs));
  if (!given) return failed("Provide a valid, non-overlapping actual dose history before the draw.");
  const first = given[0].start_ms;
  const drawHour = (drawMs - first) / MS_H;
  const events = given.map(r => ({ time: (r.start_ms - first)/MS_H, dose_mg: r.dose_mg, T_inf: r.infusion_minutes/60 }));
  let params: { CL:number; V1:number; Q:number; V2:number };
  if (fitLevels.length) {
    if (fitLevels.length > 2) return failed("Only one or two earlier levels are supported in this research prototype.");
    const mapped = manualRegimenFromRows(given,basis);
    if (!mapped.ok) return mapped;
    const last = given[given.length-1];
    const levels: CalculateRequestLevel[] = [];
    for (const sample of fitLevels) {
      const hours = parseDatetimeHours(sample.collection_time.replace(/\.000Z$/,"Z"));
      const ms = hours === null ? null : Math.round(hours * MS_H);
      if (ms === null || ms >= drawMs) return failed("Every fit level needs a real collection time strictly before the held-out draw. The target level is never used.");
      if (ms < last.start_ms) return failed("The current live posterior requires earlier fit samples from the same most recent dosing interval.");
      levels.push({ ...sample, time_since_last_dose_hours: (ms-last.start_ms)/MS_H });
    }
    // Dataset-level same-input parity compares the entire recommendation response
    // separately. This manual chart requests finite history, never steady state.
    const response = runExistingRegimenPipeline({ patient, regimen: { ...mapped.regimen, steady_state_confirmed: false }, levels });
    if ("ok" in response && response.ok === false)
      return failed(typeof response.message === "string" ? response.message : "The published timing validator refused these inputs.");
    const pk = ("pk_parameters" in response ? response.pk_parameters : undefined) as (typeof params & { used_posterior_refinement?: boolean }) | undefined;
    if (!pk?.used_posterior_refinement || ![pk.CL, pk.V1, pk.Q, pk.V2].every(v => Number.isFinite(v) && v > 0))
      return failed("The published fit did not provide a usable posterior. No prior-only value was substituted for these levels.");
    params = pk;
  } else {
    const p = buildPriorParameters({ ...patient, sex: patient.sex ?? "", height_cm: patient.height_cm ?? 0 },
      { dose_mg: given[0].dose_mg, interval_hours: 12, infusion_duration_hours: given[0].infusion_minutes/60 });
    params = p;
  }
  const times = new Set(Array.from({length: 161}, (_,i)=>drawHour*i/160));
  for (const e of events) {
    times.add(e.time);
    const end=e.time+e.T_inf;
    if (end<drawHour) times.add(end);
  }
  const curve = Array.from(times).sort((a,b)=>a-b).map(time_hours => ({time_hours,concentration:concentrationFromHistory(params,events,time_hours)}));
  if (curve.some(p => !Number.isFinite(p.concentration))) return failed("The released solver did not produce a finite concentration.");
  return { ok: true, method: fitLevels.length ? "posted-earlier-levels" : "population", drawHour,
    concentration: curve[curve.length-1].concentration, curve, doses_used: events.length, fit_levels_used: fitLevels.length };
}
