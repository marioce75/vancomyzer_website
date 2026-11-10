/**
 * Note, copied text, PDF and form regressions found by the independent review
 * of the live release (main at db32b1c). Synthetic inputs only; real engine
 * responses, built into the note and the report the way the workspace builds
 * them (clinicalNote.ts, exportReport.ts, generateReport.ts).
 *
 *  1. A suggested loading dose that has not been given (the Empiric preview)
 *     never reads as a dose given or recorded, and a result with no measured
 *     level never says a level was drawn: note, copied text and PDF.
 *  2. The "confirm the loading dose given" form accepts fractions (90.5
 *     minutes) without rounding, its button is enabled exactly when the entry
 *     can be recorded, and it has no native number input.
 *  3. A result that is both blocked and on review hold prints both reasons and
 *     no regimen to give, and the note and the PDF agree with the response.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import type { CalculateRequestRegimen, CalculateResponse, FrequencyOption } from "@/types/calculator";
import { runExistingRegimenPipeline } from "@/lib/pk/runExistingRegimenPipeline";
import { generateReportHTML } from "@/lib/generateReport";
import { parseClinicalNumber } from "@/lib/parseClinicalNumber";
import { buildReportData } from "./exportReport";
import { buildClinicalNote, SUGGESTED_DOSE_SIMULATION_NOTICE } from "./clinicalNote";
import type { SingleDoseStatus } from "./DoseRecommendationCard";
import { confirmedGivenDose, GIVEN_DOSE_MIN_MG, GIVEN_INFUSION_MIN_MINUTES, requestRegimen, summarizeDosingHistory } from "./dosingHistory";

type Level = { value_mcg_ml: number; collection_time: string; time_since_last_dose_hours: number };
const std = { age: 55, weight_kg: 75, height_cm: 175, sex: "male", serum_creatinine_mg_dl: 1.0 };
const frail = { age: 80, weight_kg: 60, height_cm: 160, sex: "female", serum_creatinine_mg_dl: 6 };
const lvl = (v: number, t: number): Level => ({ value_mcg_ml: v, collection_time: `2026-09-16T${String(Math.floor(t)).padStart(2, "0")}:${String(Math.round((t % 1) * 60)).padStart(2, "0")}:00Z`, time_since_last_dose_hours: t });

/** The regimen the Empiric loading-dose preview holds (CalculatorWorkspace: 2000 mg, one dose). */
const previewRegimen = (dose = 2000, infusionHours = 2): CalculateRequestRegimen => ({ dose_mg: dose, interval_hours: 12, infusion_duration_hours: infusionHours, doses_given: 1, target_auc24: 450 });
/** The regimen recorded by "Record as given and enter level" (handleConfirmLoadingDoseGiven). */
const recordedLoad = (dose: number, infusionHours: number): CalculateRequestRegimen => ({
  dose_mg: dose, interval_hours: 12, infusion_duration_hours: infusionHours, doses_given: 1, target_auc24: 450,
  steady_state_confirmed: false, loading_dose_mg: dose, loading_infusion_duration_hours: infusionHours,
});

function run(patient: typeof std, regimen: CalculateRequestRegimen, levels: Level[]): CalculateResponse {
  const r = runExistingRegimenPipeline({ patient, regimen, levels }) as unknown as CalculateResponse & { field_errors?: unknown };
  assert.ok(r.recommendation_type, `pipeline error: ${JSON.stringify(r.field_errors)}`);
  return r;
}
const plainText = (html: string) =>
  html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&quot;/g, '"').replace(/\s+/g, " ");

/** The note and the report exactly as the workspace builds them for the active row. */
function build(patient: typeof std, regimen: CalculateRequestRegimen, levels: Level[], response: CalculateResponse, singleDoseStatus: SingleDoseStatus, activeOption: FrequencyOption | null, activeIsCurrent: boolean) {
  const entered = levels.map((l) => ({ value_mcg_ml: l.value_mcg_ml, time_since_last_dose_hours: l.time_since_last_dose_hours }));
  const { note, summary } = buildClinicalNote({ regimen, response, activeOption, activeIsCurrent, singleDoseStatus, levels: entered });
  const data = buildReportData({ patient, regimen, levels: entered, response, activeOption, activeIsCurrent, singleDoseStatus });
  const pdf = plainText(generateReportHTML(data, "pro", "en"));
  return { note, summary, data, pdf };
}
/** Both rows a clinician can view: the dose as entered, and the engine's recommendation. */
function views(patient: typeof std, regimen: CalculateRequestRegimen, levels: Level[], response: CalculateResponse, status: SingleDoseStatus) {
  const recommended = response.frequency_options?.find((o) => o.is_recommended) ?? null;
  return [
    { name: "dose as entered", ...build(patient, regimen, levels, response, status, null, true) },
    ...(recommended ? [{ name: "engine recommendation", ...build(patient, regimen, levels, response, status, recommended, false) }] : []),
  ];
}

// Wording that asserts an administered or recorded dose, or a level that was drawn or measured.
const GIVEN_CLAIM = /recorded single dose|Recorded single dose|Dose already given|dose already given|Loading dose given|Single dose given|\(as entered\)|Infused over|existing regimen evaluation|Existing Regimen \(Bayesian\)/;
const LEVEL_CLAIM = /Level drawn after|Measured level \d|Level \d: |one pre-steady-state level|this one level|Measured levels are displayed|One measured level/;

// ── 1. Suggested dose that has not been given ────────────────────────────────
test("preview request: the suggested dose is marked as not given, and only in the preview with no level", () => {
  const regimen = previewRegimen();
  assert.deepEqual(requestRegimen(regimen, { suggestedDoseNotGiven: true }), { ...regimen, suggested_dose_not_given: true });
  assert.deepEqual(requestRegimen(regimen), regimen, "outside the preview the request is unchanged");
  assert.deepEqual(requestRegimen(regimen, { suggestedDoseNotGiven: false }), regimen);
  // Never for a multi-dose history, and never carried over from form state.
  const three: CalculateRequestRegimen = { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1.5, doses_given: 3, steady_state_confirmed: false };
  assert.equal("suggested_dose_not_given" in requestRegimen(three, { suggestedDoseNotGiven: true }), false);
  assert.equal("suggested_dose_not_given" in requestRegimen({ ...regimen, suggested_dose_not_given: true }), false);
  // A recorded loading dose is sent exactly as before.
  const recorded = recordedLoad(2000, 2);
  assert.equal("suggested_dose_not_given" in requestRegimen(recorded), false);
});

test("suggested dose, no level: the note is headed as a simulation and never reads as a dose given or a level drawn", () => {
  const regimen = previewRegimen();
  const response = run(std, requestRegimen(regimen, { suggestedDoseNotGiven: true }), []);
  for (const v of views(std, regimen, [], response, "suggested")) {
    const lines = v.note.split("\n");
    assert.equal(lines[0], "Vancomycin suggested-dose simulation (Initial population estimate).", v.name);
    assert.equal(lines[1], SUGGESTED_DOSE_SIMULATION_NOTICE, v.name);
    assert.equal(lines[2], "Dosing history entered: No dose has been given. The 2,000 mg dose is a suggestion only. No measured level entered.", v.name);
    assert.match(lines[3], /^Suggested dose \(not given\): 2000 mg × 1 \(suggested loading dose, not given\)\. Projected exposure of this one dose over its first 24 h if it is given, not steady state: AUC24 /, v.name);
    assert.doesNotMatch(v.note, GIVEN_CLAIM, v.name);
    assert.doesNotMatch(v.note, LEVEL_CLAIM, v.name);
    assert.match(v.note, /Proposed maintenance regimen \(not yet given\): /, v.name);
    assert.equal(v.summary?.given.notGiven, true);
    assert.deepEqual(v.summary?.levels, []);
  }
});

test("suggested dose: the note stays hypothetical even if the response it is built from was not marked", () => {
  // Defence in depth: the composer's own rule, independent of the engine's wording.
  const regimen = previewRegimen();
  const unmarked = run(std, regimen, []);
  assert.match(unmarked.documentation_preview?.clinical_note ?? "", /recorded single dose/, "the unmarked engine note says 'recorded'");
  for (const v of views(std, regimen, [], unmarked, "suggested")) {
    assert.match(v.note, /^Vancomycin suggested-dose simulation \(Initial population estimate\)\.\n/, v.name);
    assert.equal(v.note.split("\n")[1], SUGGESTED_DOSE_SIMULATION_NOTICE, v.name);
    assert.doesNotMatch(v.note, GIVEN_CLAIM, v.name);
    assert.doesNotMatch(v.note, LEVEL_CLAIM, v.name);
  }
});

test("suggested dose, no level: the PDF builder prints a simulation, not a dose given", () => {
  // The workspace keeps Export PDF off in the preview; the builder must be truthful all the same.
  const regimen = previewRegimen();
  const response = run(std, requestRegimen(regimen, { suggestedDoseNotGiven: true }), []);
  const [entered, recommended] = views(std, regimen, [], response, "suggested");
  for (const v of [entered, recommended]) {
    assert.doesNotMatch(v.pdf, GIVEN_CLAIM, v.name);
    assert.doesNotMatch(v.pdf, LEVEL_CLAIM, v.name);
    assert.match(v.pdf, /Vancomycin PK Report — Suggested Dose Simulation \(Prior-Based, Dose Not Given\)/, v.name);
    assert.match(v.pdf, /Dosing history entered No dose has been given\. The 2,000 mg dose is a suggestion only\. No measured level entered\./, v.name);
    assert.match(v.pdf, /Suggested dose \(not given\) vs\. proposed regimen/, v.name);
    assert.ok(v.pdf.includes(SUGGESTED_DOSE_SIMULATION_NOTICE), v.name);
    assert.equal(v.data.single_dose?.kind, "suggested");
    assert.deepEqual(v.data.entered_levels, []);
  }
  assert.match(entered.pdf, /Suggested loading dose \(not given\) 2000 mg × 1 A suggested dose that has not been given, not a regimen\./);
  assert.match(entered.pdf, /Suggested infusion over 120 minutes \(not given\)/);
  assert.match(entered.pdf, /Projected exposure of the suggested dose, not given \(first 24 h, not steady state\)/);
  assert.match(recommended.pdf, /Proposed regimen \(not yet given\) \d+ mg every \d+ h/);
});

test("suggested dose under a safety block: note and PDF state the block and still no dose given", () => {
  const regimen = previewRegimen(1500);
  const response = run(frail, requestRegimen(regimen, { suggestedDoseNotGiven: true }), []);
  assert.ok(response.adjustment_dosing_blocked);
  const v = build(frail, regimen, [], response, "suggested", null, true);
  for (const text of [v.note, v.pdf]) {
    assert.doesNotMatch(text, GIVEN_CLAIM);
    assert.doesNotMatch(text, LEVEL_CLAIM);
    assert.ok(text.includes(response.adjustment_dosing_blocked.safety_message));
  }
  assert.match(v.pdf, /Projected exposure of the suggested dose, not given \(first 24 h; no automatic recommendation\)/);
  assert.match(v.note, /Proposed maintenance regimen: none\./);
});

// ── Recorded dose with and without a level ───────────────────────────────────
test("recorded dose, no level: the note and the PDF keep the dose as given and say that no level was entered", () => {
  for (const [regimen, status, history] of [
    [recordedLoad(2000, 2), "given", "2,000 mg loading dose only, no maintenance dose yet. No measured level entered."],
    [previewRegimen(1500, 1.5), "single", "One 1,500 mg dose, no loading dose. No measured level entered."],
  ] as [CalculateRequestRegimen, SingleDoseStatus, string][]) {
    const response = run(std, requestRegimen(regimen), []);
    for (const v of views(std, regimen, [], response, status)) {
      assert.equal(v.note.split("\n")[1], `Dosing history entered: ${history}`, v.name);
      assert.match(v.note, /^Vancomycin existing regimen evaluation \(Initial population estimate\)\.\n/, v.name);
      assert.match(v.note, /\nDose already given: /, v.name);
      assert.match(v.pdf, new RegExp(`Dosing history entered ${history.replace(/[.,]/g, "\\$&")}`), v.name);
      assert.match(v.pdf, /Vancomycin PK Report — Existing Regimen \(Prior-Based, No Measured Level\)/, v.name);
      for (const text of [v.note, v.pdf]) {
        assert.doesNotMatch(text, LEVEL_CLAIM, v.name);
        assert.doesNotMatch(text, /[Ss]uggested dose|suggested-dose simulation|Simulation only|suggestion only/, v.name);
      }
    }
  }
});

test("recorded dose with a real level: the note and the PDF read as before", () => {
  const regimen = recordedLoad(2000, 200 / 60);
  const levels = [lvl(18, 6)];
  const response = run(std, requestRegimen(regimen), levels);
  for (const v of views(std, regimen, levels, response, "given")) {
    const lines = v.note.split("\n");
    assert.equal(lines[0], "Vancomycin existing regimen evaluation (Posterior-updated estimate).", v.name);
    assert.equal(lines[1], "Dosing history entered: 2,000 mg loading dose only, no maintenance dose yet. Level drawn after the loading dose.", v.name);
    assert.equal(lines[2], "Measured level 1: 18 mg/L, 6 h after the start of the last dose.", v.name);
    assert.match(lines[3], /^Dose already given: 2000 mg × 1 \(loading dose\)\. Exposure of this one dose over its first 24 h, not steady state: AUC24 /, v.name);
    assert.match(v.note, /Maintenance projection after a recorded single dose of 2000 mg; no prior maintenance interval is implied\./, v.name);
    assert.match(v.pdf, /Vancomycin PK Report — Existing Regimen \(Bayesian\)/, v.name);
    assert.match(v.pdf, /Dose already given vs\. proposed regimen/, v.name);
    assert.match(v.pdf, /Level 1: 18 mg\/L at 6 h after the start of the last dose/, v.name);
    for (const text of [v.note, v.pdf]) assert.doesNotMatch(text, /No measured level entered|Simulation only|suggested-dose simulation|not given\)/, v.name);
  }
  const entered = build(std, regimen, levels, response, "given", null, true);
  assert.match(entered.pdf, /Loading dose given \(single dose\) 2000 mg × 1 One dose, not a regimen\./);
  assert.match(entered.pdf, /Infused over 200 minutes \(as entered\)/);
  assert.match(entered.pdf, /Exposure of the dose already given \(first 24 h, not steady state\)/);
});

test("the history line: unchanged where the level is still to be typed, truthful where the result has none", () => {
  const one = previewRegimen(1500, 1.5);
  const load = recordedLoad(2000, 2);
  const loadThenTwo: CalculateRequestRegimen = { dose_mg: 750, interval_hours: 12, infusion_duration_hours: 1.25, doses_given: 3, steady_state_confirmed: false, loading_dose_mg: 2000, loading_infusion_duration_hours: 2 };
  const four: CalculateRequestRegimen = { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1.5, doses_given: 4, steady_state_confirmed: false };
  // The form's own line (no context) is exactly what it was.
  assert.equal(summarizeDosingHistory(one), "One 1,500 mg dose, no loading dose. Level drawn after that dose.");
  assert.equal(summarizeDosingHistory(load), "2,000 mg loading dose only, no maintenance dose yet. Level drawn after the loading dose.");
  assert.equal(summarizeDosingHistory(loadThenTwo), "2,000 mg loading dose at 0 h → 750 mg at 12 h, then every 12 h (2 maintenance doses). Level drawn after the last 750 mg dose (dose 3 of 3).");
  assert.equal(summarizeDosingHistory(four), "4 doses of 1,000 mg every 8 h, no loading dose. Level drawn after dose 4.");
  // With a level entered, the same.
  for (const r of [one, load, loadThenTwo, four]) assert.equal(summarizeDosingHistory(r, { levelCount: 1 }), summarizeDosingHistory(r));
  // With none, the level sentence is replaced; the doses are stated as before.
  assert.equal(summarizeDosingHistory(one, { levelCount: 0 }), "One 1,500 mg dose, no loading dose. No measured level entered.");
  assert.equal(summarizeDosingHistory(load, { levelCount: 0 }), "2,000 mg loading dose only, no maintenance dose yet. No measured level entered.");
  assert.equal(summarizeDosingHistory(loadThenTwo, { levelCount: 0 }), "2,000 mg loading dose at 0 h → 750 mg at 12 h, then every 12 h (2 maintenance doses). No measured level entered.");
  assert.equal(summarizeDosingHistory(four, { levelCount: 0 }), "4 doses of 1,000 mg every 8 h, no loading dose. No measured level entered.");
  // A suggestion is never a dose given.
  assert.equal(summarizeDosingHistory(previewRegimen(), { levelCount: 0, notGiven: true }), "No dose has been given. The 2,000 mg dose is a suggestion only. No measured level entered.");
});

// ── 2. Confirming the loading dose given ─────────────────────────────────────
/** What the form's two fields emit for typed text (ClinicalNumberInput): the number, 0 when empty, NaN when unusable or below the minimum. */
const typed = (raw: string, min: number): number => {
  if (raw.trim() === "") return 0;
  const n = parseClinicalNumber(raw);
  return n === null || n < min ? NaN : n;
};
const confirm = (dose: string, minutes: string) => confirmedGivenDose(typed(dose, GIVEN_DOSE_MIN_MG), typed(minutes, GIVEN_INFUSION_MIN_MINUTES));

test("confirm dose given: fractional and whole doses and infusion times are recorded exactly as typed", () => {
  assert.deepEqual(confirm("2000", "90"), { dose_mg: 2000, infusion_duration_hours: 1.5 });
  assert.deepEqual(confirm("2000", "90.5"), { dose_mg: 2000, infusion_duration_hours: 90.5 / 60 });
  assert.deepEqual(confirm("2000", "90,5"), { dose_mg: 2000, infusion_duration_hours: 90.5 / 60 }, "decimal comma");
  assert.deepEqual(confirm("1250.5", "120"), { dose_mg: 1250.5, infusion_duration_hours: 2 });
  assert.deepEqual(confirm("1750", "112.25"), { dose_mg: 1750, infusion_duration_hours: 112.25 / 60 });
  assert.deepEqual(confirm("1", "1"), { dose_mg: 1, infusion_duration_hours: 1 / 60 }, "the form's minimums");
  // Not rounded to a whole minute: 90.5 is neither 90 nor 91.
  const h = confirm("2000", "90.5")!.infusion_duration_hours;
  assert.notEqual(h, 90 / 60);
  assert.notEqual(h, 91 / 60);
  assert.equal(Number((h * 60).toFixed(6)), 90.5, "shown again as 90.5 minutes in the history form");
});

test("confirm dose given: empty, invalid and out-of-range entries cannot be recorded", () => {
  for (const [dose, minutes] of [
    ["", ""], ["2000", ""], ["", "90"],            // empty
    ["0", "90"], ["2000", "0"],                    // zero
    ["-2000", "90"], ["2000", "-90"],              // negative
    ["0.5", "90"], ["2000", "0.5"],                // below the form's minimum of 1
    ["abc", "90"], ["2000", "ninety"],             // not a number
    ["2000 mg", "90"], ["2000", "90 min"],         // units
    ["2000", "90."], ["2000", "90.5.1"], ["2000", "1e2"], // incomplete or malformed
    ["2,000", "90"],                               // ambiguous grouping: must be clarified first
  ]) {
    assert.equal(confirm(dose, minutes), null, `${JSON.stringify(dose)} mg over ${JSON.stringify(minutes)} min`);
  }
  for (const bad of [NaN, Infinity, -Infinity, 0, -1, 0.99]) {
    assert.equal(confirmedGivenDose(bad, 90), null);
    assert.equal(confirmedGivenDose(2000, bad), null);
  }
});

test("confirm dose given: a 90.5 minute infusion is submitted and calculated without rounding", () => {
  const out: Record<string, CalculateResponse> = {};
  for (const minutes of ["90", "90.5", "91"]) {
    const c = confirm("2000", minutes);
    assert.ok(c);
    const regimen = recordedLoad(c.dose_mg, c.infusion_duration_hours);
    const sent = requestRegimen(regimen);
    assert.equal(sent.infusion_duration_hours, Number(minutes) / 60, "sent exactly as typed");
    assert.equal(sent.dose_mg, 2000);
    out[minutes] = run(std, sent, [lvl(18, 6)]);
  }
  // The half minute is used, not dropped: the modelled curve for 90.5 minutes
  // is neither the 90 minute curve nor the 91 minute curve.
  const curve = (minutes: string) => (out[minutes].curve ?? []).map((p) => [p.time_hours, p.concentration]);
  assert.ok(curve("90.5").length > 10);
  assert.notDeepEqual(curve("90.5"), curve("90"));
  assert.notDeepEqual(curve("90.5"), curve("91"));
});

test("the calculator has no native number input: the confirm form uses the clinical number field", () => {
  const dir = new URL("./", import.meta.url);
  const components = readdirSync(dir).filter((f) => f.endsWith(".tsx"));
  assert.ok(components.includes("DoseRecommendationCard.tsx"));
  for (const f of components) {
    assert.doesNotMatch(readFileSync(new URL(f, dir), "utf8"), /type=(["'])number\1|type=\{["']number["']\}/, `${f}: a native number input applies an integer step and refuses 90.5`);
  }
  const card = readFileSync(new URL("DoseRecommendationCard.tsx", dir), "utf8");
  for (const label of ["Loading dose given (mg)", "Loading infusion (minutes)"]) {
    assert.match(card, new RegExp(`<ClinicalNumberInput[^>]*aria-label="${label.replace(/[()]/g, "\\$&")}"`), label);
  }
  assert.match(card, /disabled=\{!canConfirm\}/);
  assert.match(card, /const canConfirm = confirmed !== null;/);
});

// ── 3. Safety block together with a review hold ──────────────────────────────
test("blocked and on review hold: the note and the PDF print both reasons and no regimen to give", () => {
  const regimen: CalculateRequestRegimen = { dose_mg: 750, interval_hours: 24, infusion_duration_hours: 1, doses_given: 3, steady_state_confirmed: false };
  const levels = [lvl(30, 20), lvl(20, 20)];
  const response = run(frail, regimen, levels);
  const blocked = response.adjustment_dosing_blocked;
  const hold = response.review_hold;
  assert.ok(blocked && hold);
  assert.deepEqual(response.frequency_options, [], "no candidate regimen");
  assert.equal(response.recommended_dose, "");
  assert.equal(response.recommended_interval_hours, 0);

  const v = build(frail, regimen, levels, response, "single", null, true);
  for (const [name, text] of [["note", v.note], ["PDF", v.pdf], ["PDF interpretation", v.data.interpretation_summary ?? ""]] as [string, string][]) {
    assert.ok(text.includes(blocked.safety_message), `${name}: the safety block's explanation`);
    assert.ok(text.includes(hold.message), `${name}: the review hold's reconciliation reason`);
    assert.doesNotMatch(text, /Recommended adjustment|Recommendation: \d|Change summary|Proposed (regimen|adjustment) \(|not yet given|continue as entered/, name);
    const regimens = Array.from(text.matchAll(/(\d+) mg every (\d+) h/g), (m) => `${m[1]}/${m[2]}`);
    for (const g of regimens) assert.equal(g, "750/24", `${name}: the only regimen named is the one entered`);
  }
  assert.ok(v.note.includes(blocked.recommended_action));
  assert.match(v.note, /\nProposed maintenance regimen: none\. /);
  assert.match(v.note, /\nReview required, recommendation withheld: /);
  assert.match(v.pdf, /No automatic maintenance regimen/);
  assert.match(v.pdf, /Recommendation withheld\. No dose adjustment is presented until the entered levels are reconciled/);
  assert.doesNotMatch(v.pdf, /Dose Options/);
  assert.equal(v.summary?.proposed, null);
  // The interpretation printed in the PDF is the response's own, which now carries both reasons.
  assert.equal(v.data.interpretation_summary, response.interpretation_summary);
});
