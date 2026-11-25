import assert from "node:assert/strict";
import { test } from "node:test";
import { manualProjection, type ManualAdministration } from "./manualHistory";
import { centralMinuteFromInstant, resolveCentralMinute } from "./centralClock";
import { predictAtDraw, type TimedCaseInput } from "../studyTimed/predictAtDraw";
import type { CalculateRequestLevel, CalculateRequestPatient, CalculateRequestRegimen } from "../../types/calculator";

const HOUR_MS = 3_600_000;
const EPOCH = Date.UTC(2030, 0, 5, 14, 5, 12);
const patient: CalculateRequestPatient = { age: 62, weight_kg: 81, height_cm: 172, sex: "female", serum_creatinine_mg_dl: 1.14 };
const basis: CalculateRequestRegimen = { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1, doses_given: 3 };
const ms = (elapsedHours: number) => EPOCH + Math.round(elapsedHours * HOUR_MS);
const row = (hours: number, dose_mg: number, infusion_minutes: number): ManualAdministration => ({ start_ms: ms(hours), dose_mg, infusion_minutes });
type ProjectionInput = Parameters<typeof manualProjection>[0];
const input = (rows: ManualAdministration[], drawHour: number, extra: Partial<ProjectionInput> = {}): ProjectionInput => ({
  patient, rrt: false, rows, drawMs: ms(drawHour), complete: true, basis, fitLevels: [], ...extra,
});
function predicted(args: ProjectionInput) {
  const result = manualProjection(args);
  assert.ok(result.ok, result.ok ? undefined : result.reason);
  return result;
}
function refused(args: ProjectionInput, message: RegExp) {
  const result = manualProjection(args);
  assert.equal(result.ok, false, "No concentration or fallback may be returned");
  if (!result.ok) assert.match(result.reason, message);
}

// Independent numerical oracle: published Colin Table 3 values and a directly
// integrated amount ODE. No released parameter builder, concentration formula,
// compartment propagator, history normalization, or study predictor is reused.
function rk4Reference(rows: ManualAdministration[], drawMs: number, queryHours: number[], maxStep = 0.002) {
  const administrations = rows.filter(r => r.start_ms < drawMs).slice().sort((a, b) => a.start_ms - b.start_ms);
  const first = administrations[0].start_ms;
  const events = administrations.map(d => ({
    start: (d.start_ms - first) / HOUR_MS,
    end: (d.start_ms - first) / HOUR_MS + d.infusion_minutes / 60,
    rate: d.dose_mg * 60 / d.infusion_minutes,
  }));
  const weeks = patient.age * 52 + 40;
  const years = weeks / 52;
  const wt = patient.weight_kg / 70;
  const scrStandard = Math.exp(-1.228 + Math.log10(years) * 0.672 + 6.27 * Math.exp(-3.11 * years));
  const cl = 5.31 * wt ** 0.75 / (1 + (46.4 / weeks) ** 2.89) / (1 + (years / 61.6) ** 2.24)
    * Math.exp(-0.649 * (patient.serum_creatinine_mg_dl - scrStandard));
  const vc = 42.9 * wt, vp = 41.7 * wt, q = 3.22 * wt ** 0.75;
  const derivative = (a: number, b: number, infusion: number) => [infusion - (cl + q) * a / vc + q * b / vp, q * a / vc - q * b / vp];
  const cuts = Array.from(new Set([...queryHours, ...events.flatMap(e => [e.start, e.end])])).sort((a, b) => a - b);
  let a = 0, b = 0, t = 0;
  const concentrations = new Map<number, number>();
  for (const stop of cuts) {
    if (stop < t) continue;
    // Split at every infusion change so an RK4 step never straddles a rate jump.
    const midpoint = (stop + t) / 2;
    const rate = events.reduce((r, e) => midpoint >= e.start && midpoint < e.end ? r + e.rate : r, 0);
    const subdivisions = Math.ceil((stop - t) / maxStep);
    const h = (stop - t) / Math.max(1, subdivisions);
    for (let i = 0; i < subdivisions; i++) {
      const [a1, b1] = derivative(a, b, rate);
      const [a2, b2] = derivative(a + h * a1 / 2, b + h * b1 / 2, rate);
      const [a3, b3] = derivative(a + h * a2 / 2, b + h * b2 / 2, rate);
      const [a4, b4] = derivative(a + h * a3, b + h * b3, rate);
      a += h * (a1 + 2 * a2 + 2 * a3 + a4) / 6;
      b += h * (b1 + 2 * b2 + 2 * b3 + b4) / 6;
    }
    t = stop;
    concentrations.set(stop, a / vc);
  }
  return queryHours.map(h => concentrations.get(h)!);
}

test("irregular no-level histories match independent RK4 at every plotted point", () => {
  const cases = [
    { name: "loading, delayed dose, changed amounts and durations", rows: [row(0, 1600, 110), row(11.375, 950, 63), row(25.255, 1275, 107), row(37.75, 825, 48)], draw: 41.1375 },
    { name: "sample while the final infusion is running", rows: [row(0, 1300, 81), row(15.5, 1010, 71), row(29.75, 1440, 120)], draw: 30.125 },
  ];
  for (const fixture of cases) {
    const result = predicted(input(fixture.rows, fixture.draw));
    const approx = rk4Reference(fixture.rows, ms(fixture.draw), result.curve.map(p => p.time_hours));
    const refined = rk4Reference(fixture.rows, ms(fixture.draw), result.curve.map(p => p.time_hours), 0.001);
    const max = Math.max(...result.curve.map((p, i) => Math.abs(p.concentration - refined[i])));
    const convergence = Math.max(...approx.map((v, i) => Math.abs(v - refined[i])));
    assert.ok(max < 1e-8, `${fixture.name}: max mg/L error ${max}`);
    assert.ok(convergence < 1e-8, `${fixture.name}: independent refinement delta ${convergence}`);
    assert.equal(result.method, "population");
    assert.equal(result.fit_levels_used, 0);
    assert.equal(result.doses_used, fixture.rows.length);
    assert.equal(result.curve[0].concentration, 0);
    assert.equal(result.curve.at(-1)?.time_hours, result.drawHour);
    assert.equal(result.curve.at(-1)?.concentration, result.concentration);
    console.log(`[manual history] ${fixture.name}: ${result.curve.length} points; max |Δ| ${max.toExponential(3)} mg/L`);
  }
});

test("only administrations before the held-out draw contribute; exact-time starts are ambiguous", () => {
  const actual = [row(0, 1800, 120), row(13.15, 1100, 75), row(27, 875, 50)];
  const known = predicted(input(actual, 28));
  assert.deepEqual(predicted(input([row(28.001, 2100, 100), ...actual], 28)), known);
  refused(input([...actual, row(28, 1000, 60)], 28), /exactly at the draw.*ambiguous/);
  refused(input([row(28.5, 1000, 60)], 28), /before the draw/);
  refused(input([row(0, 1000, 100), row(1, 1200, 80)], 3), /non-overlapping/);
});

function instant(date: string, time: string) {
  const actual = resolveCentralMinute(date,time);
  assert.ok(actual.ok, JSON.stringify(actual));
  return actual.instantMs;
}

test("strict Central HH:mm does not depend on device time zone and rejects impossible dates", () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ["America/Chicago","Asia/Tokyo","Pacific/Honolulu","Etc/UTC"]) {
      process.env.TZ = zone;
      assert.equal(instant("2030-01-05","08:00"), Date.UTC(2030,0,5,14));
      assert.equal(instant("2030-07-05","08:00"), Date.UTC(2030,6,5,13));
      assert.equal(instant("2030-01-05","19:30"), Date.UTC(2030,0,6,1,30));
      assert.deepEqual(centralMinuteFromInstant(Date.UTC(2030,0,6,1,30)), { date:"2030-01-05",time:"19:30" });
      for (const [d,t] of [["2030-02-30","08:00"],["2030-01-05","08:00:00"],["2030-01-05","24:00"],["2030-01-05","8:00"],["2030-01-05",""]]) {
        assert.deepEqual(resolveCentralMinute(d,t),{ok:false,code:"invalid"});
      }
    }
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
});

test("Central DST gaps and repeated minutes refuse without correcting or guessing", () => {
  for (const t of ["02:00","02:30","02:59"]) assert.deepEqual(resolveCentralMinute("2030-03-10",t),{ok:false,code:"gap"});
  for (const t of ["01:00","01:30","01:59"]) assert.deepEqual(resolveCentralMinute("2030-11-03",t),{ok:false,code:"repeated"});
  assert.equal(instant("2030-03-10","03:00")-instant("2030-03-10","01:59"),60_000);
  assert.equal(instant("2030-11-03","02:00")-instant("2030-11-03","00:59"),121*60_000);
});

test("Central midnight and holiday-calendar input keep elapsed concentration and formal batch aligned", () => {
  assert.equal(instant("2030-01-06","00:10")-instant("2030-01-05","23:55"),15*60_000);
  const first = instant("2030-01-05","08:00");
  const second = instant("2030-01-05","17:00");
  const draw = instant("2030-01-05","19:30");
  const rows = [{start_ms:first,dose_mg:1500,infusion_minutes:90},{start_ms:second,dose_mg:1250,infusion_minutes:90}];
  const prior = predicted(input(rows,0,{drawMs:draw,minutePrecision:true}));
  const exact: TimedCaseInput = {
    study_case_id:"TEST-CENTRAL",time_basis:"datetime",age_years:patient.age,weight_kg:patient.weight_kg,
    serum_creatinine_mg_dl:patient.serum_creatinine_mg_dl,scr_collected_at:"2030-01-05T06:00-06:00",
    renal_replacement_therapy:false,history_complete_attested:true,draw_time:"2030-01-05T19:30-06:00",
    doses:[{start:"2030-01-05T08:00-06:00",dose_mg:1500,infusion_minutes:90},{start:"2030-01-05T17:00-06:00",dose_mg:1250,infusion_minutes:90}],
  };
  const batch = predictAtDraw(exact);
  assert.equal(batch.status,"predicted");
  assert.equal(batch.doses_used,prior.doses_used);
  assert.equal(prior.drawHour,11.5);
  assert.equal(prior.curve.at(-1)?.time_hours,11.5);
  assert.ok(Math.abs(batch.predicted_concentration_mg_l!-prior.concentration)<1e-10);
});

test("minute-only study refuses uncertain ordering without changing exact-input formal computation", () => {
  const day="2030-01-05", dose=instant(day,"08:00"), draw=instant(day,"19:30");
  const rows=[{start_ms:dose,dose_mg:1500,infusion_minutes:90}];
  const extra={drawMs:draw,minutePrecision:true};
  const future = { ...rows[0], start_ms:draw+3*60_000 };
  assert.deepEqual(predicted(input([...rows,future,{...future,start_ms:future.start_ms+20_000}],0,extra)),predicted(input(rows,0,extra)));
  refused(input([...rows,{...rows[0],start_ms:draw+20_000}],0,extra),/same minute as the draw.*ambiguous/);
  refused(input([...rows,{...rows[0],start_ms:dose+20_000}],0,extra),/Two doses.*same minute.*ambiguous/);
  const one = {collection_time:"2030-01-06T01:30:30Z",time_since_last_dose_hours:11.5,value_mcg_ml:15};
  const two = {...one,collection_time:"2030-01-05T14:00:30Z"};
  refused(input(rows,0,{...extra,fitLevels:[one]}),/fit level and the draw.*same minute/);
  refused(input(rows,0,{...extra,fitLevels:[two]}),/fit level and a dose start.*same minute/);
});

test("no-level research forecast does not borrow old regimen or steady-state assumptions", () => {
  const actual = [row(0, 1700, 100), row(13, 950, 70), row(22, 1100, 110)];
  const clean = predicted(input(actual, 25));
  const unrelated = { dose_mg: 2500, interval_hours: 48, infusion_duration_hours: 5, doses_given: 90, steady_state_confirmed: true, loading_dose_mg: 3500, target_auc24: 600 };
  assert.deepEqual(predicted(input(actual, 25, { basis: unrelated })), clean);
  assert.notEqual(predicted(input(actual, 25, { patient: { ...patient, serum_creatinine_mg_dl: 1.55 } })).concentration, clean.concentration);
  refused(input(actual, 25, { complete: false }), /Confirm/);
  refused(input(actual, 25, { rrt: true }), /does not support dialysis/);
});

const sample = (hour: number, value_mcg_ml = 14): CalculateRequestLevel => ({
  collection_time: new Date(ms(hour)).toISOString(), value_mcg_ml, time_since_last_dose_hours: 999,
});
test("fit levels at or after target never enter model; irregular fitted history never falls back", () => {
  const regular = [row(0, 1000, 60), row(12, 1000, 60), row(24, 1000, 60)];
  for (const t of [33, 33 + 1 / 3600, 36]) {
    refused(input(regular, 33, { fitLevels: [sample(28), sample(t)] }), /strictly before the held-out draw/);
  }
  refused(input(regular, 33, { fitLevels: [sample(20)] }), /same most recent dosing interval/);
  const irregular = [row(0, 1250, 90), row(11.375, 950, 68), row(25.25, 1050, 60)];
  refused(input(irregular, 33, { fitLevels: [sample(30)] }), /Irregular maintenance dosing/);
  assert.equal(predicted(input(irregular, 33)).method, "population");
});
