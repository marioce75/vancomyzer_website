/**
 * Engine text regressions found by the independent review of the live release
 * (main at db32b1c). Synthetic inputs only. Wording and response assembly; no
 * numerical method is involved, and the tests below check that the numbers do
 * not move.
 *
 *  1. A suggested dose that has not been given (the Empiric loading-dose
 *     simulation: doses_given = 1, levels = [], regimen.suggested_dose_not_given)
 *     is never called "recorded", and nothing in the response refers to a level
 *     that was not entered.
 *  2. A recorded single dose with no level keeps "recorded" and likewise claims
 *     no level; a recorded dose with a real level reads as it did before.
 *  3. A result that is both blocked and on review hold states both reasons in
 *     the interpretation and in the two documentation texts, and no dose advice.
 *     One gate alone reads as it did before.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { runExistingRegimenPipeline } from "../runExistingRegimenPipeline";

type R = Record<string, any>;
const std = { age: 55, weight_kg: 75, height_cm: 175, sex: "male", serum_creatinine_mg_dl: 1.0 };
const frail = { age: 80, weight_kg: 60, sex: "female", serum_creatinine_mg_dl: 6 };
const lvl = (v: number, t: number) => ({ value_mcg_ml: v, collection_time: `2026-09-16T${String(Math.floor(t)).padStart(2, "0")}:${String(Math.round((t % 1) * 60)).padStart(2, "0")}:00Z`, time_since_last_dose_hours: t });
const single = (dose = 2000, infusionHours = 2): R => ({ dose_mg: dose, interval_hours: 12, infusion_duration_hours: infusionHours, doses_given: 1, target_auc24: 450 });
const raw = (patient: R, regimen: R, levels: R[]): R => runExistingRegimenPipeline({ patient, regimen, levels }) as R;
function run(patient: R, regimen: R, levels: R[]): R {
  const r = raw(patient, regimen, levels);
  assert.ok(r.recommendation_type, `pipeline error: ${JSON.stringify(r.field_errors)}`);
  return r;
}

/** Every piece of prose in a response, with where it came from. */
function prose(r: R): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  const add = (where: string, v: unknown) => {
    if (typeof v === "string") out.push({ where, text: v });
    else if (Array.isArray(v)) v.forEach((x, i) => add(`${where}[${i}]`, x));
  };
  add("interpretation_summary", r.interpretation_summary);
  add("quick_summary", r.documentation_preview?.quick_summary);
  add("clinical_note", r.documentation_preview?.clinical_note);
  add("assumptions", r.assumptions);
  add("limitations", r.limitations);
  add("key_inputs", r.calculation_details?.key_inputs);
  (r.frequency_options ?? []).forEach((o: R, i: number) => {
    add(`option[${i}].interpretation_summary`, o.interpretation_summary);
    add(`option[${i}].quick_summary`, o.quick_summary);
    add(`option[${i}].clinical_note`, o.clinical_note);
  });
  return out;
}
const none = (r: R, pattern: RegExp, why: string) => {
  for (const p of prose(r)) assert.doesNotMatch(p.text, pattern, `${why} (${p.where})`);
};
/** Every number in a response, by path. Strings are left out. */
function numbers(v: unknown, path = "", out: Record<string, number | boolean | null> = {}): Record<string, number | boolean | null> {
  if (typeof v === "number" || typeof v === "boolean" || v === null) out[path] = v;
  else if (Array.isArray(v)) v.forEach((x, i) => numbers(x, `${path}[${i}]`, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) numbers(x, path ? `${path}.${k}` : k, out);
  return out;
}

// Phrases that assert an administered dose or a measured level.
const RECORDED = /recorded single dose|Recorded single dose/;
const LEVEL_CLAIM = /estimated from one pre-steady-state level|estimated from this one level|single pre-steady-state level|Measured levels are displayed|Estimate based on (one|\d+) measured level/;

test("suggested dose, no level: never 'recorded', and no level is claimed anywhere", () => {
  const r = run(std, { ...single(), suggested_dose_not_given: true }, []);
  none(r, RECORDED, "a suggested dose is not a recorded dose");
  none(r, LEVEL_CLAIM, "no level was entered");
  none(r, /existing regimen evaluation/, "a simulation is not the evaluation of an existing regimen");

  assert.match(r.interpretation_summary, /^Suggested dose, not given: 2000 mg, one dose only\. /);
  assert.match(r.interpretation_summary, /No dose has been recorded and no level has been measured\. If this dose is given, draw the first level/);
  assert.match(r.documentation_preview.clinical_note, /^Vancomycin suggested-dose simulation \(Initial population estimate\)\.\n/);
  for (const text of [r.documentation_preview.quick_summary, r.documentation_preview.clinical_note]) {
    assert.match(text, /Maintenance projection after a suggested single dose of 2000 mg that has not been given; no prior maintenance interval is implied\./);
  }
  assert.ok(r.calculation_details.key_inputs.includes("Suggested single dose 2000 mg (not given)"));
  assert.ok(r.calculation_details.key_inputs.includes("0 measured levels"));
  assert.ok(r.assumptions.some((a: string) => a.startsWith("Single-dose (pulse dose) projection from the population prior: no measured level was entered")));
  assert.ok(r.assumptions.some((a: string) => a.startsWith("Suggested dose, not given: this is a simulation.")));
  assert.ok(r.limitations.some((l: string) => l.startsWith("Simulation of a suggested dose: no dose has been recorded as given")));
  assert.ok(r.limitations.some((l: string) => l.startsWith("Population estimate only: no measured level was entered.")));
  // Every candidate row's own texts follow the same rule (checked by `none` above); there are candidates.
  assert.ok(r.frequency_options.length > 0);
});

test("the flag changes wording only: every number in the response is identical with and without it", () => {
  for (const [patient, regimen] of [[std, single()], [std, single(1500, 1.5)], [{ ...std, weight_kg: 120, serum_creatinine_mg_dl: 2.2 }, single(2500, 2.5)], [frail, single(1000, 1)]] as [R, R][]) {
    const plain = run(patient, regimen, []);
    const flagged = run(patient, { ...regimen, suggested_dose_not_given: true }, []);
    assert.deepEqual(numbers(flagged), numbers(plain), "numbers");
    assert.equal(flagged.recommended_dose, plain.recommended_dose);
    assert.deepEqual(flagged.curve, plain.curve);
    assert.deepEqual(flagged.frequency_options.map((o: R) => [o.dose_mg, o.interval_hours, o.infusion_duration_hours, o.auc24, o.peak, o.trough, o.is_recommended]),
      plain.frequency_options.map((o: R) => [o.dose_mg, o.interval_hours, o.infusion_duration_hours, o.auc24, o.peak, o.trough, o.is_recommended]));
    assert.equal(Boolean(flagged.adjustment_dosing_blocked), Boolean(plain.adjustment_dosing_blocked), "the same safety gate applies");
  }
});

test("suggested dose under a safety block: the block is stated, the dose is still not 'recorded'", () => {
  const r = run(frail, { ...single(1500), suggested_dose_not_given: true }, []);
  assert.ok(r.adjustment_dosing_blocked, "this synthetic patient has no automatic regimen");
  assert.match(r.interpretation_summary, /^Suggested dose, not given: 1500 mg\. /);
  assert.ok(r.interpretation_summary.includes(r.adjustment_dosing_blocked.safety_message));
  assert.ok(r.interpretation_summary.includes(r.adjustment_dosing_blocked.recommended_action));
  assert.match(r.interpretation_summary, /No dose has been recorded and no level has been measured\./);
  none(r, RECORDED, "a suggested dose is not a recorded dose");
  none(r, LEVEL_CLAIM, "no level was entered");
  assert.equal(r.frequency_options.length, 0, "no candidates when blocked");
});

test("the flag is refused unless it is a boolean on a single dose with no level", () => {
  const bad = (regimen: R, levels: R[], message: RegExp) => {
    const r = raw(std, regimen, levels);
    assert.equal(r.ok, false);
    assert.equal(r.error_type, "validation_error");
    assert.match(r.field_errors["regimen.suggested_dose_not_given"], message);
  };
  bad({ ...single(), suggested_dose_not_given: "yes" }, [], /Must be true or false/);
  bad({ ...single(), suggested_dose_not_given: 1 }, [], /Must be true or false/);
  bad({ dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1.5, doses_given: 3, steady_state_confirmed: false, suggested_dose_not_given: true }, [lvl(15, 10)], /single-dose simulation/);
  bad({ ...single(), suggested_dose_not_given: true }, [lvl(18, 4)], /cannot have measured levels/);
  // false is the same as absent.
  const off = run(std, { ...single(), suggested_dose_not_given: false }, []);
  const absent = run(std, single(), []);
  assert.equal(off.interpretation_summary, absent.interpretation_summary);
  assert.deepEqual(off.documentation_preview, absent.documentation_preview);
});

test("recorded single dose, no level: still 'recorded', and no level is claimed", () => {
  const r = run(std, single(), []);
  assert.match(r.interpretation_summary, /^Single-dose analysis: 2000 mg, one dose only\. /);
  assert.match(r.interpretation_summary, /No level entered yet: draw the first level/);
  assert.match(r.documentation_preview.clinical_note, /^Vancomycin existing regimen evaluation \(Initial population estimate\)\.\n/);
  assert.match(r.documentation_preview.clinical_note, /Maintenance projection after a recorded single dose of 2000 mg; no prior maintenance interval is implied\./);
  assert.ok(r.calculation_details.key_inputs.includes("Recorded single dose 2000 mg"));
  none(r, LEVEL_CLAIM, "no level was entered");
  none(r, /[Ss]uggested dose, not given|suggested-dose simulation|suggested single dose/, "a recorded dose is not a suggestion");
  assert.ok(r.limitations.some((l: string) => l.startsWith("Population estimate only: no measured level was entered.")));
  assert.ok(!r.limitations.some((l: string) => l.startsWith("Simulation of a suggested dose")));
});

test("recorded single dose with a real level: reads exactly as before", () => {
  const r = run(std, single(2000, 200 / 60), [lvl(18, 6)]);
  assert.match(r.interpretation_summary, /^Single-dose analysis: 2000 mg, one dose only\. /);
  assert.match(r.interpretation_summary, /Estimate based on one measured level after this single dose; confirm with a follow-up level after further doses\./);
  assert.match(r.documentation_preview.clinical_note, /^Vancomycin existing regimen evaluation \(Posterior-updated estimate\)\.\n/);
  assert.match(r.documentation_preview.clinical_note, /Maintenance projection after a recorded single dose of 2000 mg; no prior maintenance interval is implied\./);
  assert.ok(r.calculation_details.key_inputs.includes("Recorded single dose 2000 mg"));
  assert.ok(r.calculation_details.key_inputs.includes("1 measured level"));
  assert.ok(r.assumptions.includes("Single-dose (pulse dose) Bayesian estimation: AUC24 and maintenance recommendations are projected from individual PK parameters estimated from one pre-steady-state level. Steady-state is NOT assumed."));
  assert.ok(r.assumptions.includes("Level must be drawn in the post-distributive elimination phase (≥2 h after infusion completion) for valid single-dose PK estimation per ASHP/IDSA/SIDP 2020."));
  assert.ok(r.limitations.includes("Bayesian estimate based on single pre-steady-state level — monitor and confirm with a follow-up level after additional doses."));
  assert.ok(r.limitations.includes("Pulse-dose / single-dose workflow: projected AUC24 and recommended maintenance dose assume steady-state PK will match the individual parameters estimated from this one level."));
  none(r, /no measured level was entered|No dose has been recorded|not given/, "a dose was recorded and a level was measured");
});

// ── Safety block and review hold ──────────────────────────────────────────────
const three = { dose_mg: 750, interval_hours: 24, infusion_duration_hours: 1, doses_given: 3, steady_state_confirmed: false };
const steady = { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1.5, doses_given: 6, steady_state_confirmed: true };
// Dose advice: a recommendation line, a change summary, or "<n> mg every <n> h" other than the regimen entered.
const ADVICE = /Recommended adjustment|Suggested maintenance regimen|Recommendation: \S|Change summary|Change rationale|Selected regimen/;
const texts = (r: R) => [r.interpretation_summary, r.documentation_preview.quick_summary, r.documentation_preview.clinical_note] as string[];
function noDoseAdvice(r: R, entered: { dose_mg: number; interval_hours: number }) {
  for (const text of texts(r)) {
    assert.doesNotMatch(text, ADVICE);
    const regimens = Array.from(text.matchAll(/(\d+(?:\.\d+)?) mg every (\d+(?:\.\d+)?) h/g), (m) => `${m[1]}/${m[2]}`);
    for (const g of regimens) assert.equal(g, `${entered.dose_mg}/${entered.interval_hours}`, "the only regimen named is the one entered");
  }
  assert.equal(r.frequency_options.length, 0, "no candidate regimen");
  assert.equal(r.recommended_interval_hours, 0);
  assert.doesNotMatch(String(r.recommended_dose), /\d/, "no recommended dose");
  for (const k of ["predicted_auc24", "predicted_peak", "predicted_trough"]) assert.equal(r[k], undefined, k);
}

test("blocked AND on review hold: the interpretation and both documentation texts state both reasons, and no dose advice", () => {
  const r = run(frail, three, [lvl(30, 20), lvl(20, 20)]);
  const blocked = r.adjustment_dosing_blocked;
  const hold = r.review_hold;
  assert.ok(blocked && hold, "this synthetic case is blocked and on hold at once");
  assert.equal(hold.reason, "discordant_duplicate_samples");
  for (const text of texts(r)) {
    assert.ok(text.includes(blocked.safety_message), "the safety block's explanation");
    assert.ok(text.includes(blocked.recommended_action), "the safety block's action");
    assert.ok(text.includes(hold.message), "the review hold's reconciliation reason");
    assert.match(text, /Recommendation withheld/);
    assert.ok(text.indexOf(blocked.safety_message) < text.indexOf(hold.message), "the block is stated first, then the hold");
  }
  assert.match(r.documentation_preview.clinical_note, /\nRecommendation withheld: no dose adjustment is presented until the entered levels are reconciled\.\n/);
  noDoseAdvice(r, three);
  // The exposure estimates and the fit diagnostics stay visible for review.
  assert.match(r.interpretation_summary, /^Current regimen: 750 mg every 24 h\. .*AUC24 [\d.]+ mg·h\/L; peak [\d.]+ mg\/L; trough [\d.]+ mg\/L\./);
});

test("blocked only: the block's reason and action, no mention of a hold, no dose advice", () => {
  const r = run(frail, three, [lvl(30, 20)]);
  assert.ok(r.adjustment_dosing_blocked && !r.review_hold);
  for (const text of texts(r)) {
    assert.ok(text.includes(r.adjustment_dosing_blocked.safety_message));
    assert.ok(text.includes(r.adjustment_dosing_blocked.recommended_action));
    assert.doesNotMatch(text, /Recommendation withheld|discordant|reconciled/);
    assert.doesNotMatch(text, ADVICE);
  }
  assert.equal(r.frequency_options.length, 0);
});

test("review hold only: the hold's reason, no block text, no dose advice", () => {
  const r = run(std, steady, [lvl(18, 10), lvl(12, 10)]);
  assert.ok(r.review_hold && !r.adjustment_dosing_blocked);
  for (const text of texts(r)) {
    assert.ok(text.includes(r.review_hold.message));
    assert.match(text, /Recommendation withheld/);
    assert.doesNotMatch(text, /Pharmacy review required|Maintenance dosing held|No suitable regimen/);
  }
  noDoseAdvice(r, steady);
});

test("neither gate: the recommendation is stated as before", () => {
  const r = run(std, steady, [lvl(15, 10)]);
  assert.ok(!r.review_hold && !r.adjustment_dosing_blocked);
  assert.match(r.interpretation_summary, /Recommended adjustment: \d+ mg every \d+ h infused over \d+ minutes\./);
  assert.match(r.documentation_preview.clinical_note, /\nRecommendation: \d+ mg every \d+ h infused over \d+ minutes\n/);
  for (const text of texts(r)) assert.doesNotMatch(text, /Recommendation withheld|Pharmacy review required|Maintenance dosing held/);
  assert.ok(r.frequency_options.length > 0);
});
