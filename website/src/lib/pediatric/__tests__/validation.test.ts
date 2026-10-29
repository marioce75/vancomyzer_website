/**
 * Regression tests for the input-validation and timing defects found in the
 * independent review of commit acb9984 (docs/pediatric/INPUT-VALIDATION.md).
 *
 * Run: node --import tsx src/lib/pediatric/__tests__/validation.test.ts
 * Synthetic inputs only. Not clinical validation.
 */
import assert from "node:assert/strict";
import { HARD_LIMITS, nonFinitePaths, parseStrictTimestamp, runPediatricEngine, type PediatricRequest, type PediatricResult, type PediatricVerificationRequired } from "../engine";

let n = 0;
const ok = (c: unknown, m: string) => { assert.ok(c, m); n++; };
const T0 = Date.UTC(2026, 9, 28, 8, 0, 0);
const iso = (h: number) => new Date(T0 + h * 3600000).toISOString();
const base = (): PediatricRequest => ({ patient: { postnatal_age: { value: 6, unit: "years" }, weight: { value: 20, unit: "kg" }, serum_creatinine: { value: 0.4, unit: "mg/dL" } }, regimen: { dose_mg: 300, interval_hours: 6, infusion_minutes: 60 } });
const doses = (hours: number[], dose = 300, minutes = 60) => hours.map((h) => ({ start: iso(h), dose_mg: dose, infusion_minutes: minutes }));
/** Asserts a refusal on `field` whose message matches `re`, and that no dosing output is present. */
const refuse = (req: unknown, field: string, re: RegExp | null = null, status: "invalid" | "unsupported" = "invalid") => {
  const r = runPediatricEngine(req);
  ok(r.status === status, `${field}: expected ${status}, got ${JSON.stringify(r.status === "ok" ? { ok: true, pma: r.derived.pma_years, CL: r.prior.parameters.CL } : r.field_errors)}`);
  if (r.status !== "ok") {
    ok(field in r.field_errors, `${field} named in ${Object.keys(r.field_errors)}`);
    if (re) ok(re.test(r.field_errors[field]), `${field} message "${r.field_errors[field]}" should match ${re}`);
    ok(!("prior" in r) && !("candidate_regimens" in r) && !("posterior" in r), "refusal carries no dosing result");
  }
};
// Existing synthetic histories now supply an explicit planned time as part of their fixture.
// Missing-time regressions call runPediatricEngine directly, without this helper.
const withPlannedTime = (req: PediatricRequest): PediatricRequest => req.doses?.length && !req.regimen.next_dose_start
  ? { ...req, regimen: { ...req.regimen, next_dose_start: new Date(Math.max(...req.doses.map(d => Date.parse(d.start))) + req.regimen.interval_hours * 3600000).toISOString() } }
  : req;
const run = (req: unknown): PediatricResult => { const r = runPediatricEngine(withPlannedTime(req as PediatricRequest)); assert.equal(r.status, "ok", JSON.stringify(r)); return r as PediatricResult; };
/** Asserts a needs_verification response (no dosing result) with a "verify" item on `field` matching `re`. */
const needsVerify = (req: unknown, field: string, re: RegExp): PediatricVerificationRequired => {
  const r = runPediatricEngine(req);
  ok(r.status === "needs_verification", `${field}: expected needs_verification, got ${r.status === "ok" ? "ok" : JSON.stringify(r)}`);
  const v = r as PediatricVerificationRequired;
  ok(v.input_review.some((it) => it.field === field && it.category === "verify" && re.test(it.message)), `${field} verify item: ${JSON.stringify(v.input_review)}`);
  ok(!("prior" in v) && !("candidate_regimens" in v) && !("posterior" in v), "needs_verification carries no dosing result");
  return v;
};

// ── 1. Units: fixed enum, inherited property names, malformed values ─────────
for (const unit of ["toString", "constructor", "__proto__", "valueOf", "hasOwnProperty", "Years", "year", "yrs", "", " days", 7, null, undefined, ["years"], { years: 1 }]) {
  refuse({ ...base(), patient: { ...base().patient, postnatal_age: { value: 6, unit } } }, "patient.postnatal_age", /days, weeks, months, years/);
}
for (const unit of ["toString", "constructor", "KG", "lb", "", null, 1]) refuse({ ...base(), patient: { ...base().patient, weight: { value: 20, unit } } }, "patient.weight", /kg or g/);
for (const unit of ["toString", "constructor", "mmol/L", "mg/l", "µmol/L", "", null]) refuse({ ...base(), patient: { ...base().patient, serum_creatinine: { value: 0.4, unit } } }, "patient.serum_creatinine", /mg\/dL or umol\/L/);
// null, non-finite, string and boolean numbers everywhere a number is required
for (const v of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "6", true, {}, []]) {
  refuse({ ...base(), patient: { ...base().patient, postnatal_age: { value: v, unit: "years" } } }, "patient.postnatal_age");
  refuse({ ...base(), patient: { ...base().patient, weight: { value: v, unit: "kg" } } }, "patient.weight");
  refuse({ ...base(), patient: { ...base().patient, serum_creatinine: { value: v, unit: "mg/dL" } } }, "patient.serum_creatinine");
  refuse({ ...base(), regimen: { ...base().regimen, dose_mg: v } }, "regimen.dose_mg");
  refuse({ ...base(), regimen: { ...base().regimen, interval_hours: v } }, "regimen.interval_hours");
  refuse({ ...base(), regimen: { ...base().regimen, infusion_minutes: v } }, "regimen.infusion_minutes");
  refuse({ ...base(), doses: [{ start: iso(0), dose_mg: v, infusion_minutes: 60 }] }, "doses[0].dose_mg");
  refuse({ ...base(), doses: [{ start: iso(0), dose_mg: 300, infusion_minutes: v }] }, "doses[0].infusion_minutes");
  refuse({ ...base(), doses: doses([0]), levels: [{ time: iso(2), concentration_mg_l: v }] }, "levels[0].concentration_mg_l");
}
refuse({ ...base(), patient: { ...base().patient, gestational_age_weeks: Number.NaN, postnatal_age: { value: 10, unit: "days" }, weight: { value: 3, unit: "kg" } } }, "patient.gestational_age_weeks");
refuse({ ...base(), patient: { ...base().patient, gestational_age_weeks: "32", postnatal_age: { value: 10, unit: "days" }, weight: { value: 3, unit: "kg" } } }, "patient.gestational_age_weeks");
refuse({ ...base(), patient: { ...base().patient, route: "oral" } }, "patient.route");
refuse({ ...base(), patient: { ...base().patient, ecmo: "yes" } }, "patient.ecmo");
refuse({ ...base(), patient: { ...base().patient, postnatal_age: { value: -1, unit: "days" } } }, "patient.postnatal_age", /zero or positive/);
// Successful results never contain NaN/Infinity/null in required numbers.
{
  const r = run({ ...base(), doses: doses([0, 6, 12, 18, 24, 30]), levels: [{ time: iso(32), concentration_mg_l: 22 }, { time: iso(35.5), concentration_mg_l: 9 }] });
  ok(nonFinitePaths(r as unknown).length === 0, "no non-finite number anywhere in a two-level result");
  ok(JSON.stringify(r.derived).indexOf("null") === -1 && JSON.stringify(r.prior).indexOf("null") === -1, "derived and prior blocks contain no null");
  ok(nonFinitePaths({ a: 1, b: [2, Number.NaN], c: { d: Number.POSITIVE_INFINITY } }).join() === "b[1],c.d", "nonFinitePaths finds nested problems");
}

// ── 2. Dates: strict calendar, time, offset ──────────────────────────────────
const bad = (s: string, re: RegExp) => { const p = parseStrictTimestamp(s); ok(!p.ok && re.test(p.reason), `"${s}" rejected: ${p.ok ? "accepted" : p.reason}`); };
const good = (s: string, expectIso: string) => { const p = parseStrictTimestamp(s); ok(p.ok && new Date(p.ms).toISOString() === expectIso, `"${s}" → ${p.ok ? new Date(p.ms).toISOString() : p.reason} (expected ${expectIso})`); };
bad("2026-02-30T08:00:00Z", /Day 30 does not exist in 2026-02/);
bad("2026-02-29T08:00:00Z", /not a leap year/);
bad("2100-02-29T08:00:00Z", /not a leap year/); // century rule
good("2024-02-29T08:00:00Z", "2024-02-29T08:00:00.000Z"); // leap day
good("2000-02-29T08:00:00Z", "2000-02-29T08:00:00.000Z"); // 400-year rule
bad("2026-04-31T08:00:00Z", /Day 31 does not exist/);
bad("2026-13-01T08:00:00Z", /Month 13/);
bad("2026-00-10T08:00:00Z", /Month 00/);
bad("2026-10-00T08:00:00Z", /Day 00/);
bad("2026-02-10T24:00:00Z", /Hour 24/);
bad("2026-02-10T08:60:00Z", /Minute 60/);
bad("2026-02-10T08:00:60Z", /Second 60/);
bad("2026-02-10T08:00:00+25:00", /offset \+25:00/);
bad("2026-02-10T08:00:00+14:01", /offset \+14:01/);
bad("2026-02-10T08:00:00-14:30", /offset -14:30/);
bad("2026-02-10T08:00:00", /Unrecognised/); // no offset: ambiguous across DST
bad("2026-02-10 08:00:00Z", /Unrecognised/);
bad("2026-2-10T08:00:00Z", /Unrecognised/);
bad("1899-12-31T08:00:00Z", /Year 1899/);
bad("2200-01-01T00:00:00Z", /Year 2200/);
good("2026-02-10T08:00:00+14:00", "2026-02-09T18:00:00.000Z");
good("2026-02-10T08:00:00-14:00", "2026-02-10T22:00:00.000Z");
good("2026-02-10T08:00-05:00", "2026-02-10T13:00:00.000Z"); // seconds optional
good("2026-02-10T08:00:00.5Z", "2026-02-10T08:00:00.500Z");
good("2026-02-10T08:00:00.123+00:00", "2026-02-10T08:00:00.123Z");
// Daylight-saving: the same local wall-clock time with the two offsets of a fall-back night maps to two different instants; without an offset it is refused.
good("2026-11-01T01:30:00-04:00", "2026-11-01T05:30:00.000Z");
good("2026-11-01T01:30:00-05:00", "2026-11-01T06:30:00.000Z");
bad("2026-11-01T01:30:00", /Unrecognised/);
refuse({ ...base(), doses: [{ start: "2026-02-30T08:00:00Z", dose_mg: 300, infusion_minutes: 60 }] }, "doses[0].start", /Day 30 does not exist/);
refuse({ ...base(), doses: doses([0]), levels: [{ time: "2026-10-28T24:00:00Z", concentration_mg_l: 10 }] }, "levels[0].time", /Hour 24/);
refuse({ ...base(), regimen: { ...base().regimen, next_dose_start: "2026-10-29T08:00:00" }, doses: doses([0]) }, "regimen.next_dose_start", /Unrecognised/);
{
  // Offsets are honoured: the same instant written in two zones gives the same timeline origin.
  const a = run({ ...base(), doses: [{ start: "2026-10-28T08:00:00Z", dose_mg: 300, infusion_minutes: 60 }] });
  const b = run({ ...base(), doses: [{ start: "2026-10-28T03:00:00-05:00", dose_mg: 300, infusion_minutes: 60 }] });
  ok(a.timeline!.origin === b.timeline!.origin && a.timeline!.origin === "2026-10-28T08:00:00.000Z", "equal instants across offsets");
}

// ── 3. Forecast timing and chronology ────────────────────────────────────────
// The reviewer's case: one dose at 0, level at 48 h, regimen q6h → implied next dose at 6 h lies before the level.
refuse({ ...base(), doses: doses([0]), levels: [{ time: iso(48), concentration_mg_l: 3 }] }, "regimen.next_dose_start", /Enter the next planned dose start time explicitly/);
// Level exactly at the implied next dose is also refused (forecast must start strictly after every level).
refuse({ ...base(), regimen: { ...base().regimen, next_dose_start: iso(6) }, doses: doses([0]), levels: [{ time: iso(6), concentration_mg_l: 3 }] }, "levels[0].time", /at or after the next planned dose/);
{
  // Repaired with an explicit next dose after the level: forecast anchored after the level, nothing moved.
  const r = run({ ...base(), regimen: { ...base().regimen, next_dose_start: iso(50) }, doses: doses([0]), levels: [{ time: iso(48), concentration_mg_l: 3 }] });
  ok(r.timeline!.next_dose_anchor === "regimen.next_dose_start" && r.timeline!.next_planned_dose_hours === 50 && r.timeline!.forecast_window.start_hours === 50 && r.timeline!.forecast_window.end_hours === 74, "forecast anchored at the explicit next dose");
  ok(r.timeline!.last_level_hours === 48 && r.timeline!.forecast_window.start_hours > r.timeline!.last_level_hours!, "forecast starts after the last level");
  ok(r.timeline!.last_dose_start_hours === 0 && r.estimate_basis === "posterior_one_level", "dose history unchanged; posterior from the level");
  ok(r.assumptions.some((a) => a.includes("regimen.next_dose_start as entered")), "assumption names the anchor");
  ok(typeof r.posterior!.exposure.forecast_auc24_next24h === "number" && r.posterior!.exposure.forecast_auc24_next24h! > 0, "forecast computed");
  // Repaired instead by recording the doses actually given.
  const r2 = run({ ...base(), doses: doses([0, 6, 12, 18, 24, 30, 36, 42]), levels: [{ time: iso(47.5), concentration_mg_l: 8 }] });
  ok(r2.timeline!.next_dose_anchor === "regimen.next_dose_start" && r2.timeline!.next_planned_dose_hours === 48 && r2.timeline!.last_level_hours === 47.5, "explicit fixture anchor is after the level");
}
// next_dose_start constraints
refuse({ ...base(), regimen: { ...base().regimen, next_dose_start: iso(0.5) }, doses: doses([0]) }, "regimen.next_dose_start", /before the last recorded infusion ends/);
refuse({ ...base(), regimen: { ...base().regimen, next_dose_start: iso(8 * 24) }, doses: doses([0]) }, "regimen.next_dose_start", /more than 7 days/);
refuse({ ...base(), regimen: { ...base().regimen, next_dose_start: iso(49) }, doses: doses([0]), levels: [{ time: iso(49), concentration_mg_l: 3 }] }, "levels[0].time", /set regimen\.next_dose_start after every level/);
refuse({ ...base(), regimen: { ...base().regimen, next_dose_start: iso(6) } }, "regimen.next_dose_start", /only applies when a dose history/);
ok(run({ ...base(), regimen: { ...base().regimen, next_dose_start: iso(1) }, doses: doses([0]) }).timeline!.next_planned_dose_hours === 1, "next dose may start exactly when the last infusion ends");
// Out-of-order and duplicate entries: arrays may be unordered (timestamps are absolute) but duplicates/overlaps are named by their supplied position.
{
  const r = run({ ...base(), doses: doses([12, 0, 6]), levels: [{ time: iso(17.5), concentration_mg_l: 9 }, { time: iso(14), concentration_mg_l: 20 }] });
  ok(r.timeline!.origin === iso(0) && r.timeline!.last_dose_start_hours === 12 && r.timeline!.next_planned_dose_hours === 18, "unordered doses are modelled by timestamp; origin is the earliest dose");
  ok(r.estimate_basis === "posterior_two_level" && r.posterior!.fit.predicted_at_levels[0].timeHours < r.posterior!.fit.predicted_at_levels[1].timeHours, "unordered levels are modelled by timestamp");
  const same = run({ ...base(), doses: doses([0, 6, 12]), levels: [{ time: iso(17.5), concentration_mg_l: 9 }, { time: iso(14), concentration_mg_l: 20 }] });
  ok(same.posterior!.parameters.CL === r.posterior!.parameters.CL, "order of entry does not change the fit");
}
refuse({ ...base(), doses: doses([0, 6, 6]) }, "doses[2].start", /same time as dose 2; duplicate/);
refuse({ ...base(), doses: doses([6, 0, 6.5]) }, "doses[2].start", /before the infusion of dose 1 ends/);
refuse({ ...base(), doses: [{ start: iso(0), dose_mg: 300, infusion_minutes: 120 }, { start: iso(1.5), dose_mg: 300, infusion_minutes: 60 }] }, "doses[1].start", /overlapping/);
ok(run({ ...base(), doses: [{ start: iso(0), dose_mg: 300, infusion_minutes: 120 }, { start: iso(2), dose_mg: 300, infusion_minutes: 60 }] }).timeline!.last_dose_start_hours === 2, "a dose may start exactly when the previous infusion ends");
refuse({ ...base(), doses: doses([0]), levels: [{ time: iso(0), concentration_mg_l: 10 }] }, "levels[0].time", /at or before the first recorded dose/);
refuse({ ...base(), doses: doses([0]), levels: [{ time: iso(-1), concentration_mg_l: 10 }] }, "levels[0].time", /at or before the first recorded dose/);
refuse({ ...base(), doses: doses([0, 22 * 24]) }, "doses", /more than 21 days/);
refuse({ ...base(), regimen: { ...base().regimen, next_dose_start: iso(8 * 24) }, doses: doses([0]), levels: [{ time: iso(7 * 24 + 1), concentration_mg_l: 1 }] }, "levels[0].time", /More than 7 days/);
refuse({ ...base(), levels: [{ time: iso(2), concentration_mg_l: 10 }] }, "doses", /require the actual dose history/);
// Infusion boundaries
refuse({ ...base(), regimen: { dose_mg: 300, interval_hours: 6, infusion_minutes: 14.9 } }, "regimen.infusion_minutes");
ok(run({ ...base(), regimen: { dose_mg: 300, interval_hours: 6, infusion_minutes: 15 } }).status === "ok", "15-minute infusion accepted");
ok(run({ ...base(), regimen: { dose_mg: 300, interval_hours: 24, infusion_minutes: 1440 } }).status === "ok", "24-hour infusion over a 24-hour interval accepted");
refuse({ ...base(), regimen: { dose_mg: 300, interval_hours: 12, infusion_minutes: 1440 } }, "regimen.infusion_minutes", /cannot exceed the dosing interval/);
refuse({ ...base(), regimen: { dose_mg: 300, interval_hours: 6, infusion_minutes: 1441 } }, "regimen.infusion_minutes");
refuse({ ...base(), doses: [{ start: iso(0), dose_mg: 300, infusion_minutes: 0 }] }, "doses[0].infusion_minutes");
refuse({ ...base(), regimen: { dose_mg: 300, interval_hours: 3.9, infusion_minutes: 60 } }, "regimen.interval_hours");
refuse({ ...base(), regimen: { dose_mg: 300, interval_hours: 48.1, infusion_minutes: 60 } }, "regimen.interval_hours");
// A valid chronological history (the standard fixture) still works end to end.
{
  const r = run({ ...base(), doses: doses([0, 6, 12, 18, 24, 30]), levels: [{ time: iso(32), concentration_mg_l: 22 }, { time: iso(35.5), concentration_mg_l: 9 }] });
  ok(r.estimate_basis === "posterior_two_level" && r.timeline!.next_planned_dose_hours === 36 && r.timeline!.forecast_window.start === iso(36) && r.timeline!.forecast_window.end === iso(60), "standard two-level history: forecast 36-60 h");
  ok(r.posterior!.exposure.forecast_auc24_next24h! > 0 && r.posterior!.exposure.forecast_auc24_interval!.lower < r.posterior!.exposure.forecast_auc24_interval!.upper, "forecast and its interval present");
}

// ── 4. Plausibility: documented hard limits refuse; unusual-for-age values require verification; model-population limits are reported ─
// Hard limits rest on documented human extremes only (CLINICAL-REVIEW.md §3).
refuse({ ...base(), patient: { ...base().patient, postnatal_age: { value: 5, unit: "days" }, gestational_age_weeks: 24, weight: { value: 190, unit: "g" } } }, "patient.weight", /smallest documented surviving birth weight/);
refuse({ ...base(), patient: { ...base().patient, postnatal_age: { value: 10, unit: "days" }, gestational_age_weeks: 40, weight: { value: 11.1, unit: "kg" } } }, "patient.weight", /heaviest documented human birth weight/);
refuse({ ...base(), patient: { ...base().patient, postnatal_age: { value: 17, unit: "years" }, weight: { value: 160.1, unit: "kg" } } }, "patient.weight", /upper limit of 160 kg/);
refuse({ ...base(), patient: { ...base().patient, postnatal_age: { value: 10, unit: "days" }, gestational_age_weeks: 38, weight: { value: 3200, unit: "kg" } } }, "patient.weight"); // grams typed as kg: caught by the 160 kg ceiling
ok(HARD_LIMITS.weightKgMin === 0.2 && HARD_LIMITS.newbornMaxKg === 11 && HARD_LIMITS.zVerify === 3 && HARD_LIMITS.zStrong === 5, "documented hard-limit constants");
// Unusual for age (WHO/CDC weight-for-age |z| > 3): no result until verified; the review item names z, the medians and the source.
{
  const twoYearOld = { ...base(), patient: { ...base().patient, postnatal_age: { value: 2, unit: "years" }, weight: { value: 0.4, unit: "kg" } } };
  const v = needsVerify(twoYearOld, "patient.weight", /below the reference by \d+\.\d SD .*unit .*or age-entry error/);
  ok(v.input_review.some((it) => /WHO Child Growth Standards 2006/.test(it.source)), "source cited (WHO standard for 2 years)");
  ok(v.input_review.some((it) => it.category === "outside_model_population" && /8\.7-160 kg/.test(it.message)), "model-population band also reported");
  const r = run({ ...twoYearOld, inputs_verified: true });
  ok(r.input_review.verified === true && r.input_review.items.some((it) => it.category === "verify") && r.warnings.some((w) => /Verify weight, unit and age/.test(w)), "after verification the result still carries the review items and warnings");
  needsVerify({ ...base(), patient: { ...base().patient, postnatal_age: { value: 10, unit: "days" }, gestational_age_weeks: 40, weight: { value: 9, unit: "kg" } } }, "patient.weight", /above the reference/);
  needsVerify({ ...base(), patient: { ...base().patient, postnatal_age: { value: 40, unit: "days" }, gestational_age_weeks: 40, weight: { value: 20.5, unit: "kg" } } }, "patient.weight", /above the reference/);
  needsVerify({ ...base(), patient: { ...base().patient, postnatal_age: { value: 10, unit: "years" }, weight: { value: 9.9, unit: "kg" } } }, "patient.weight", /below the reference/);
  const cdc = needsVerify({ ...base(), patient: { ...base().patient, postnatal_age: { value: 10, unit: "years" }, weight: { value: 9.9, unit: "kg" } } }, "patient.weight", /below the reference/);
  ok(cdc.input_review.some((it) => /CDC 2000/.test(it.source)), "CDC 2000 reference cited above 5 years");
  // Moderately unusual (3 < |z| ≤ 5) is also flagged for verification but with the milder wording.
  needsVerify({ ...base(), patient: { ...base().patient, postnatal_age: { value: 5, unit: "years" }, weight: { value: 11, unit: "kg" } } }, "patient.weight", /Unusual for age: verify/);
  // Term newborn at 1.5 kg: z about -4.8 → verify, not "impossible"; 1.2 kg for a 28-weeker is checked against corrected age (below term-equivalent → no reference, informational only).
  needsVerify({ ...base(), patient: { ...base().patient, postnatal_age: { value: 2, unit: "days" }, gestational_age_weeks: 40, weight: { value: 1.5, unit: "kg" } } }, "patient.weight", /below the reference/);
  const pre = run({ ...base(), patient: { ...base().patient, postnatal_age: { value: 2, unit: "days" }, gestational_age_weeks: 28, weight: { value: 1.2, unit: "kg" } } });
  ok(pre.input_review.items.some((it) => it.category === "clinical_validity_unknown" && /no preterm growth reference/.test(it.message) && /Fenton/.test(it.source)), "preterm below term-equivalent age: Fenton note, no verification gate");
  // Corrected age: a former 28-weeker at 90 days (PMA 40.9 weeks, corrected age ~0.2 months) weighing 3.5 kg is within the term reference at corrected age,
  // whereas the same 3.5 kg at a chronological age of 3 months would be about -2.8 SD.
  ok(run({ ...base(), patient: { ...base().patient, postnatal_age: { value: 90, unit: "days" }, gestational_age_weeks: 28, weight: { value: 3.5, unit: "kg" } } }).input_review.items.every((it) => it.category !== "verify"), "corrected-age z within range for a former preterm infant");
  // Normal values produce no verify item.
  ok(run(base()).input_review.items.every((it) => it.category !== "verify"), "6-year-old at 20 kg: nothing to verify");
  ok(run({ ...base(), patient: { ...base().patient, postnatal_age: { value: 15, unit: "years" }, weight: { value: 55, unit: "kg" } } }).input_review.items.length === 0, "15-year-old at 55 kg: no review items");
}
{
  // Model-population boundary → reported (outside_model_population), never a refusal or a verification gate on its own.
  // 2-year-old at 8.6 kg: below the development band (8.7 kg) but within the WHO reference (z about -2.4 for girls), so reported, not gated.
  const r = run({ ...base(), patient: { ...base().patient, postnatal_age: { value: 2, unit: "years" }, weight: { value: 8.6, unit: "kg" } } });
  ok(r.input_review.items.some((it) => it.category === "outside_model_population" && /8\.7-160 kg/.test(it.message) && it.source === "Colin 2019 Table 1") && r.input_review.items.every((it) => it.category !== "verify"), `8.6 kg two-year-old: outside model population only (${JSON.stringify(r.input_review.items)})`);
  // 3-year-old at 8 kg: outside the band AND unusual for age (z -4.6) → verification gate with both items reported.
  const g = needsVerify({ ...base(), patient: { ...base().patient, postnatal_age: { value: 3, unit: "years" }, weight: { value: 8, unit: "kg" } } }, "patient.weight", /below the reference by 4\.\d SD/);
  ok(g.input_review.some((it) => it.category === "outside_model_population"), "both categories reported together");
  const w = run({ ...base(), patient: { ...base().patient, postnatal_age: { value: 5, unit: "days" }, gestational_age_weeks: 24, weight: { value: 410, unit: "g" } } });
  ok(w.input_review.items.some((it) => it.category === "outside_model_population" && /0\.42/.test(it.message)), "0.41 kg neonate: below the dataset floor, reported");
  const ob = run({ ...base(), patient: { ...base().patient, postnatal_age: { value: 10, unit: "years" }, weight: { value: 60, unit: "kg" } } });
  ok(ob.input_review.items.some((it) => it.category === "clinical_validity_unknown" && /Obesity cannot be classified without height/.test(it.message) && /recs 23-24/.test(it.source)), "weight-for-age above +2 SD: obesity note with guideline source");
  const ur = run({ ...base(), patient: { ...base().patient, unstable_renal_function: true } });
  ok(ur.input_review.items.some((it) => it.category === "clinical_validity_unknown" && /time-varying covariate/.test(it.message) && /KDIGO 2012/.test(it.source)), "unstable renal function: clinical validity unknown, sources cited");
  const neo = run({ ...base(), patient: { ...base().patient, postnatal_age: { value: 2, unit: "days" }, gestational_age_weeks: 40, weight: { value: 3.4, unit: "kg" } } });
  ok(neo.input_review.items.some((it) => it.field === "patient.serum_creatinine" && /maternal creatinine/.test(it.message) && /Evans/.test(it.source)), "under 72 h: maternal creatinine note");
}
// Age and gestational-age boundaries
refuse({ ...base(), patient: { ...base().patient, postnatal_age: { value: 18, unit: "years" }, weight: { value: 70, unit: "kg" } } }, "patient.postnatal_age", null, "unsupported");
ok(run({ ...base(), patient: { ...base().patient, postnatal_age: { value: 6574, unit: "days" }, weight: { value: 70, unit: "kg" } } }).status === "ok", "6574 days (17.999 y) accepted");
refuse({ ...base(), patient: { ...base().patient, postnatal_age: { value: 6575, unit: "days" }, weight: { value: 70, unit: "kg" } } }, "patient.postnatal_age", null, "unsupported"); // 18.0014 y
refuse({ ...base(), patient: { ...base().patient, postnatal_age: { value: 1, unit: "days" }, gestational_age_weeks: 44.1, weight: { value: 4, unit: "kg" } } }, "patient.gestational_age_weeks");
refuse({ ...base(), patient: { ...base().patient, postnatal_age: { value: 1, unit: "days" }, gestational_age_weeks: 21.9, weight: { value: 0.5, unit: "kg" } } }, "patient.gestational_age_weeks");
refuse({ ...base(), patient: { ...base().patient, postnatal_age: { value: 0, unit: "days" }, gestational_age_weeks: 23, weight: { value: 0.5, unit: "kg" } } }, "patient.gestational_age_weeks", /below the lowest value/, "unsupported");
refuse({ ...base(), patient: { ...base().patient, serum_creatinine: { value: 0.09, unit: "mg/dL" } } }, "patient.serum_creatinine");
refuse({ ...base(), patient: { ...base().patient, serum_creatinine: { value: 10.01, unit: "mg/dL" } } }, "patient.serum_creatinine");
refuse({ ...base(), patient: { ...base().patient, serum_creatinine: { value: 885, unit: "umol/L" } } }, "patient.serum_creatinine");
ok(run({ ...base(), patient: { ...base().patient, serum_creatinine: { value: 884, unit: "umol/L" } } }).status === "ok", "884 umol/L = 10 mg/dL accepted");
// ── Missing and explicit forecast anchors (12-h infusion recorded, q6h regimen)
refuse({ ...base(), doses: [{ start: iso(0), dose_mg: 300, infusion_minutes: 720 }] }, "regimen.next_dose_start", /Enter the next planned dose start time explicitly/);
refuse({ ...base(), regimen: { ...base().regimen, next_dose_start: iso(6) }, doses: [{ start: iso(0), dose_mg: 300, infusion_minutes: 720 }] }, "regimen.next_dose_start", /before the last recorded infusion ends/);
{
  const r = run({ ...base(), regimen: { ...base().regimen, next_dose_start: iso(12) }, doses: [{ start: iso(0), dose_mg: 300, infusion_minutes: 720 }] });
  ok(r.timeline!.next_planned_dose_hours === 12 && r.timeline!.doses[0].end === iso(12), "explicit next dose at the end of the 12-h infusion is accepted");
  const r2 = run({ ...base(), regimen: { ...base().regimen, interval_hours: 24 }, doses: [{ start: iso(0), dose_mg: 300, infusion_minutes: 720 }] });
  ok(r2.timeline!.next_planned_dose_hours === 24 && r2.timeline!.next_dose_anchor === "regimen.next_dose_start", "explicit fixture time at 24h follows the 12-hour infusion");
  // An explicit fixture anchor at the infusion end is allowed.
  ok(run({ ...base(), regimen: { ...base().regimen, interval_hours: 12 }, doses: [{ start: iso(0), dose_mg: 300, infusion_minutes: 720 }] }).timeline!.next_planned_dose_hours === 12, "explicit fixture anchor equal to the infusion end is accepted");
  // Dose rows keep their original numbers in the audit timeline.
  const t = run({ ...base(), doses: doses([12, 0, 6]), levels: [{ time: iso(17.5), concentration_mg_l: 9 }, { time: iso(14), concentration_mg_l: 20 }] }).timeline!;
  ok(t.doses.map((d) => d.row).join() === "2,3,1" && t.doses.map((d) => d.start_hours).join() === "0,6,12" && t.levels.map((l) => l.row).join() === "2,1", `audit rows: doses ${t.doses.map((d) => d.row)} levels ${t.levels.map((l) => l.row)}`);
}
console.log(`${n} validation regression checks passed (units/inherited names, non-finite numbers, strict calendar/time/offset, explicit forecast anchoring and missing-time refusal, chronology and audit rows, infusion boundaries, hard limits and verification gate).`);

// User-entered timestamps are mandatory for every recorded event and planned forecast.
for (const missing of [undefined, null, "", "   "]) {
  refuse({ ...base(), regimen: { ...base().regimen, next_dose_start: missing }, doses: doses([0]) }, "regimen.next_dose_start");
  refuse({ ...base(), regimen: { ...base().regimen, next_dose_start: iso(6) }, doses: [{ ...doses([0])[0], start: missing }] }, "doses[0].start");
  refuse({ ...base(), regimen: { ...base().regimen, next_dose_start: iso(6) }, doses: doses([0]), levels: [{ time: missing, concentration_mg_l: 10 }] }, "levels[0].time");
}
console.log("12 missing timestamp cases refused without dosing output.");
