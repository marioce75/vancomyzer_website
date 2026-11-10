/**
 * PDF report and copied note, built the way the workspace builds them
 * (exportReport.ts -> generateReport.ts, clinicalNote.ts), from real engine
 * responses for synthetic patients.
 *
 * Regressions from the second independent review:
 *  1. every proposed figure comes from the one selected candidate row;
 *  2. a review hold prints the hold and its reason, the history as entered,
 *     and no regimen to give;
 *  3. infusion duration is part of regimen identity;
 *  4. every warning shown on screen is in the note and the PDF.
 *
 * Regression from the third review:
 *  5. the regimen box and the exposure heading say "continue as entered" for a
 *     proposal that is the regimen entered, and "not yet given" for any other.
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { CalculateRequestRegimen, CalculateResponse, FrequencyOption } from "@/types/calculator";
import { runExistingRegimenPipeline } from "@/lib/pk/runExistingRegimenPipeline";
import { generateReportHTML } from "@/lib/generateReport";
import { fmt } from "@/lib/formatNumber";
import { buildReportData } from "./exportReport";
import { buildClinicalNote, collectExportWarnings } from "./clinicalNote";

type Level = { value_mcg_ml: number; collection_time: string; time_since_last_dose_hours: number };
const std = { age: 55, weight_kg: 75, height_cm: 175, sex: "male", serum_creatinine_mg_dl: 1.0 };
const lvl = (v: number, t: number): Level => ({ value_mcg_ml: v, collection_time: `2026-09-16T${String(Math.floor(t)).padStart(2, "0")}:${String(Math.round((t % 1) * 60)).padStart(2, "0")}:00Z`, time_since_last_dose_hours: t });
const ss = (dose: number, tau: number, infusionHours: number, n = 6): CalculateRequestRegimen => ({ dose_mg: dose, interval_hours: tau, infusion_duration_hours: infusionHours, doses_given: n, steady_state_confirmed: n >= 6, target_auc24: 450 });

function run(patient: typeof std, regimen: CalculateRequestRegimen, levels: Level[]): CalculateResponse {
  const r = runExistingRegimenPipeline({ patient, regimen, levels }) as unknown as CalculateResponse & { field_errors?: unknown };
  assert.ok(r.recommendation_type, `pipeline error: ${JSON.stringify(r.field_errors)}`);
  return r;
}

/** The report exactly as the workspace's Export PDF button builds it. */
function report(patient: typeof std, regimen: CalculateRequestRegimen, levels: Level[], response: CalculateResponse, activeOption: FrequencyOption | null, activeIsCurrent: boolean) {
  const entered = levels.map((l) => ({ value_mcg_ml: l.value_mcg_ml, time_since_last_dose_hours: l.time_since_last_dose_hours }));
  const singleDoseStatus = regimen.loading_dose_mg !== undefined ? ("given" as const) : ("single" as const);
  const data = buildReportData({ patient, regimen, levels: entered, response, activeOption, activeIsCurrent, singleDoseStatus });
  const html = generateReportHTML(data, "pro", "en");
  const text = html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/\s+/g, " ");
  const { note } = buildClinicalNote({ regimen, response, activeOption, activeIsCurrent, singleDoseStatus, levels: entered });
  return { data, html, text, note };
}
/** The text of the report from one section title up to the title that follows it in the layout. */
const NEXT_SECTION: Record<string, string[]> = {
  "Warnings and advisories": ["One measured level: provisional estimate", "Proposed regimen (not yet given)", "Proposed regimen (continue as entered)", "Current regimen (as entered)", "Loading dose given (single dose)", "Single dose given"],
  // The regimen box and the exposure metrics printed under it.
  "Proposed regimen (not yet given)": ["PK Parameters ("],
  "Proposed regimen (continue as entered)": ["PK Parameters ("],
  "Current regimen (as entered)": ["PK Parameters ("],
  "Clinical Note (for Medical Record)": [" Assumptions ", " Limitations ", " Model Colin"],
};
function section(text: string, title: string): string {
  const start = text.indexOf(title);
  assert.ok(start >= 0, `section "${title}" is present`);
  const ends = NEXT_SECTION[title].map((t) => text.indexOf(t, start + title.length)).filter((i) => i > start);
  assert.ok(ends.length > 0, `end of section "${title}"`);
  return text.slice(start, Math.min(...ends));
}

// ── 1. One selected candidate for every proposed figure ─────────────────────

test("recommended and alternative candidates: the regimen box, the metrics, the table and the note carry that one row", () => {
  const regimen = ss(1000, 12, 1);
  const levels = [lvl(9, 11)];
  const r = run(std, regimen, levels);
  const rows = r.frequency_options!;
  assert.ok(rows.length >= 3 && rows.some((o) => o.is_recommended) && rows.some((o) => !o.is_recommended));
  for (const o of rows) {
    const { data, text, note } = report(std, regimen, levels, r, o, false);
    assert.equal(data.regimen_is_current, false);
    assert.deepEqual(
      { dose: data.recommended_dose, interval: data.recommended_interval_hours, infusion: data.recommended_infusion_duration_hours, auc24: data.auc24, peak: data.peak, trough: data.trough },
      { dose: String(o.dose_mg), interval: o.interval_hours, infusion: o.infusion_duration_hours, auc24: o.auc24, peak: o.peak, trough: o.trough },
    );
    assert.deepEqual(data.exposure_summary!.proposed!.figures, { auc24: o.auc24, peak: o.peak, trough: o.trough });
    assert.deepEqual(data.exposure_summary!.given.figures, { auc24: r.auc24, peak: r.peak, trough: r.trough });
    assert.equal(data.exposure_summary!.proposed!.origin, o.is_recommended ? "engine" : "selected");
    const box = section(text, "Proposed regimen (not yet given)");
    assert.ok(box.includes(`${o.dose_mg} mg every ${o.interval_hours} h`), box);
    assert.ok(box.includes(`Infuse over ${Number((o.infusion_duration_hours * 60).toFixed(6))} minutes`), box);
    assert.ok(box.includes(`AUC₂₄: ${fmt(o.auc24, 1)} mg·h/L`), box);
    assert.ok(box.includes(`Projected steady-state exposure of the proposed regimen (not yet given) AUC₂₄ ${fmt(o.auc24, 1)} mg·h/L Peak ${fmt(o.peak, 2)} mg/L Trough ${fmt(o.trough, 2)} mg/L`), box);
    // The history's exposure is never printed in the proposed sections.
    assert.ok(!box.includes(fmt(r.auc24, 1)), "the current regimen's AUC is not in the proposed-regimen sections");
    assert.ok(!box.includes(fmt(r.peak, 2)) && !box.includes(fmt(r.trough, 2)));
    // The note agrees with the PDF, row for row.
    assert.ok(note.includes(`${o.dose_mg} mg every ${o.interval_hours} h infused over ${Number((o.infusion_duration_hours * 60).toFixed(6))} minutes. Projected steady-state exposure if this regimen is given: AUC24 ${o.auc24} mg·h/L; peak ${o.peak} mg/L; trough ${o.trough} mg/L.`), note);
    assert.ok(note.includes(`Current regimen as entered: 1000 mg every 12 h infused over 60 minutes (6 doses given). Steady-state exposure of this regimen: AUC24 ${r.auc24} mg·h/L; peak ${r.peak} mg/L; trough ${r.trough} mg/L.`), note);
  }
});

test("the engine's recommendation when the grid kept another dose at that interval: its own predicted exposure, not the current regimen's", () => {
  const patient = { ...std, age: 30, weight_kg: 55, serum_creatinine_mg_dl: 0.7 };
  const regimen = ss(1500, 24, 1);
  const levels = [lvl(25, 6)];
  const r = run(patient, regimen, levels);
  const recommended = r.frequency_options!.find((o) => o.is_recommended);
  assert.ok(recommended, "the recommendation has a candidate row to select");
  assert.notEqual(r.predicted_peak, r.peak, "the fixture separates the two exposures");
  const { data, text } = report(patient, regimen, levels, r, recommended, false);
  assert.deepEqual({ auc24: data.auc24, peak: data.peak, trough: data.trough }, { auc24: r.predicted_auc24, peak: r.predicted_peak, trough: r.predicted_trough });
  const box = section(text, "Proposed regimen (not yet given)");
  assert.ok(box.includes("1500 mg every 24 h") && box.includes("Infuse over 150 minutes"), box);
  assert.ok(box.includes(`Peak ${fmt(r.predicted_peak!, 2)} mg/L Trough ${fmt(r.predicted_trough!, 2)} mg/L`), box);
  assert.ok(!box.includes(`Peak ${fmt(r.peak, 2)} mg/L`), "the current regimen's peak is not printed as the proposed regimen's");
});

test("a selection that does not belong to this response never lends its figures to the report", () => {
  const regimen = ss(1000, 12, 1);
  const levels = [lvl(9, 11)];
  const r = run(std, regimen, levels);
  const row = r.frequency_options!.find((o) => !o.is_recommended)!;
  // Same identity, figures from another (older) result: the report uses this response's row.
  const stale = { ...row, auc24: 999.9, peak: 99.9, trough: 9.9 };
  const a = report(std, regimen, levels, r, stale, false);
  assert.deepEqual({ auc24: a.data.auc24, peak: a.data.peak, trough: a.data.trough }, { auc24: row.auc24, peak: row.peak, trough: row.trough });
  assert.ok(!a.text.includes("999.9") && !a.note.includes("999.9"));
  // An identity this response does not offer (another result's candidate, or another infusion duration).
  for (const foreign of [{ ...row, dose_mg: 1750, interval_hours: 36 }, { ...row, infusion_duration_hours: row.infusion_duration_hours + 0.5 }]) {
    const b = report(std, regimen, levels, r, { ...foreign, auc24: 555.5 }, false);
    assert.equal(b.data.regimen_is_current, true, "the report falls back to the history as entered");
    assert.deepEqual({ dose: b.data.recommended_dose, auc24: b.data.auc24, peak: b.data.peak, trough: b.data.trough }, { dose: "1000", auc24: r.auc24, peak: r.peak, trough: r.trough });
    assert.ok(b.text.includes("Current regimen (as entered)"));
    assert.ok(!b.text.includes("Projected steady-state exposure of the proposed regimen (not yet given)"));
    assert.ok(!b.text.includes("555.5") && !b.note.includes("555.5"));
  }
});

test("with no candidate selected the top-level figures are printed as the history entered, never under a proposed heading", () => {
  const regimen = ss(1000, 12, 1);
  const levels = [lvl(9, 11)];
  const r = run(std, regimen, levels);
  const { data, text } = report(std, regimen, levels, r, null, false);
  assert.equal(data.regimen_is_current, true);
  const box = section(text, "Current regimen (as entered)");
  assert.ok(box.includes("1000 mg every 12 h") && box.includes("Infused over 60 minutes (as entered)"), box);
  assert.ok(box.includes(`Steady-state projection of the current regimen (as entered) AUC₂₄ ${fmt(r.auc24, 1)} mg·h/L`), box);
  assert.ok(!text.includes("Proposed regimen (not yet given)"));
  // The engine's recommendation is still reported, in the table, with its own figures.
  const rec = r.frequency_options!.find((o) => o.is_recommended)!;
  assert.deepEqual(data.exposure_summary!.proposed!.figures, { auc24: rec.auc24, peak: rec.peak, trough: rec.trough });
});

// ── 2. Review hold ──────────────────────────────────────────────────────────

test("review hold: the PDF and the note carry the history and the review reason, and no regimen to give", () => {
  const regimen = ss(1000, 12, 1);
  const levels = [lvl(28, 3), lvl(12.9, 3)];
  const r = run(std, regimen, levels);
  assert.ok(r.review_hold);
  // The workspace shows the history as entered under a hold (shouldViewCurrentRegimen); the
  // report must also be safe if it is ever asked for with no active row at all.
  for (const [activeOption, activeIsCurrent] of [[null, false], [null, true]] as const) {
    const { data, text, note } = report(std, regimen, levels, r, activeOption, activeIsCurrent);
    for (const [label, out] of [["PDF", text], ["note", note]] as const) {
      assert.doesNotMatch(out, /mg every 0 h|every 0 h/, `${label}: no "mg every 0 h"`);
      assert.doesNotMatch(out, /Recommended adjustment|Recommendation: |Change summary|Change rationale|Suggested maintenance regimen/, `${label}: no withdrawn advice`);
      assert.doesNotMatch(out, /Proposed (regimen|adjustment|maintenance regimen) \(/, `${label}: nothing is presented as proposed`);
      assert.doesNotMatch(out, /Projected steady-state exposure/, `${label}: no projected exposure`);
      assert.ok(out.includes(r.review_hold!.message), `${label}: the review reason is preserved`);
      assert.match(out, /Recommendation withheld/, `${label}: the hold is stated`);
      // The actual history is preserved.
      assert.ok(out.includes("6 doses of 1,000 mg every 12 h, no loading dose. Level drawn after dose 6."), `${label}: dosing history`);
      assert.ok(out.includes(label === "PDF" ? "Level 1: 28 mg/L at 3 h after the start of the last dose" : "Measured level 1: 28 mg/L, 3 h after the start of the last dose."), `${label}: level 1`);
      assert.ok(out.includes(label === "PDF" ? "Level 2: 12.9 mg/L at 3 h after the start of the last dose" : "Measured level 2: 12.9 mg/L, 3 h after the start of the last dose."), `${label}: level 2`);
    }
    assert.equal(data.regimen_is_current, true);
    assert.equal(data.exposure_summary!.proposed, null);
    assert.equal(data.frequency_options!.length, 0);
    const box = section(text, "Current regimen (as entered)");
    assert.ok(box.includes("1000 mg every 12 h"), box);
    assert.ok(box.includes(`Steady-state projection of the current regimen (as entered) AUC₂₄ ${fmt(r.auc24, 1)} mg·h/L`), box);
    assert.ok(section(text, "Warnings and advisories").includes("Review required, recommendation withheld"));
    assert.ok(note.includes("Proposed maintenance regimen: none. Recommendation withheld until the entered levels are reconciled."));
    assert.ok(note.includes(`Review required, recommendation withheld: ${r.review_hold!.message}`));
    assert.ok(note.includes(`Current regimen as entered: 1000 mg every 12 h infused over 60 minutes (6 doses given). Steady-state exposure of this regimen: AUC24 ${r.auc24} mg·h/L`));
    // The reason is printed once in the note, not repeated from the engine's own lines.
    assert.equal(note.split(r.review_hold!.message).length - 1, 1);
  }
});

test("a withdrawn recommendation can never print as a regimen, whatever data reaches the generator", () => {
  // The data shape the previous export produced under a hold: empty dose, interval 0.
  const regimen = ss(1000, 12, 1);
  const levels = [lvl(28, 3), lvl(12.9, 3)];
  const r = run(std, regimen, levels);
  const { data } = report(std, regimen, levels, r, null, true);
  const html = generateReportHTML({ ...data, regimen_is_current: false, recommended_dose: "", recommended_interval_hours: 0 }, "pro", "en");
  assert.doesNotMatch(html, /mg every 0 h/);
  assert.match(html, /No regimen is presented/);
});

// ── 3. Infusion duration is part of regimen identity ────────────────────────

test("an infusion-duration-only change is not 'continue as entered' in the note or the PDF", () => {
  const regimen = ss(1000, 12, 2); // entered: 1000 mg q12h over 120 minutes
  const levels = [lvl(13, 11)];
  const r = run(std, regimen, levels);
  const rec = r.frequency_options!.find((o) => o.is_recommended)!;
  assert.deepEqual({ dose: rec.dose_mg, interval: rec.interval_hours, minutes: Math.round(rec.infusion_duration_hours * 60) }, { dose: 1000, interval: 12, minutes: 100 });
  const { data, text, note } = report(std, regimen, levels, r, rec, false);
  const p = data.exposure_summary!.proposed!;
  assert.equal(p.change, "infusion_only");
  assert.equal(p.title, "Proposed regimen (same dose and interval, different infusion duration; not yet given)");
  assert.equal(p.changeNote, "Change from the regimen entered: infusion duration from 120 to 100 minutes; dose and interval unchanged.");
  for (const out of [text, note]) {
    assert.doesNotMatch(out, /continue as entered|if this regimen is continued\b|same practical regimen step/);
    assert.ok(out.includes("infusion duration from 120 to 100 minutes; dose and interval unchanged"));
    assert.ok(out.includes("1000 mg every 12 h infused over 120 minutes (6 doses given)"), "the entered regimen states its own infusion duration");
    assert.ok(out.includes("1000 mg every 12 h infused over 100 minutes"), "the proposed regimen states its own infusion duration");
  }
  assert.ok(section(text, "Proposed regimen (not yet given)").includes("Infuse over 100 minutes"));
});

test("dose, interval and infusion duration all as entered is 'continue as entered'", () => {
  const regimen = ss(1000, 12, 100 / 60);
  const levels = [lvl(13, 11)];
  const r = run(std, regimen, levels);
  const rec = r.frequency_options!.find((o) => o.is_recommended)!;
  const { data, note } = report(std, regimen, levels, r, rec, false);
  assert.equal(data.exposure_summary!.proposed!.change, "none");
  assert.equal(data.exposure_summary!.proposed!.title, "Proposed regimen (continue as entered)");
  assert.ok(note.includes("No change from the regimen entered: same dose, interval and infusion duration."));
});

test("a dose change states dose, interval and infusion duration, each against the regimen entered", () => {
  const regimen = ss(1000, 12, 1);
  const levels = [lvl(9, 11)];
  const r = run(std, regimen, levels);
  const rec = r.frequency_options!.find((o) => o.is_recommended)!;
  const { note } = report(std, regimen, levels, r, rec, false);
  assert.ok(note.includes(`Change from the regimen entered: dose from 1000 mg to ${rec.dose_mg} mg; interval unchanged at 12 h; infusion duration from 60 to ${Number((rec.infusion_duration_hours * 60).toFixed(6))} minutes.`), note);
});

// ── 4. Warnings travel with every export ────────────────────────────────────

const warningCases: [string, typeof std, CalculateRequestRegimen, Level[], RegExp[]][] = [
  ["late steady-state level", std, ss(1000, 12, 1), [lvl(12, 12.5)], [/^Lab timing advisory: Level 1 drawn 0\.5 h after the dosing interval/, /^Steady-state check: Steady state was confirmed for this regimen, but/]],
  ["late level before steady state", std, ss(1000, 12, 1.5, 3), [lvl(9, 13.5)], [/^Lab timing advisory: Level 1 drawn 1\.5 h past the dosing interval\. Treated as an extended trough/]],
  ["level the fit cannot explain", std, ss(1000, 12, 1), [lvl(1.5, 11)], [/^Fit quality advisory: Posterior fit cannot fully explain the measured level/]],
  ["current regimen above 600", std, ss(1500, 8, 1.5), [lvl(28, 7.5)], [/^Predicted AUC24 above 600 mg·h\/L: Current regimen as entered: AUC24 [\d.]+ mg·h\/L\. Potential for elevated nephrotoxicity risk/]],
  ["blocked recommendation with a clearance floor", { ...std, age: 80, weight_kg: 60, height_cm: 165, sex: "female", serum_creatinine_mg_dl: 6 }, ss(750, 24, 1, 3), [lvl(30, 20)], [/^Fit quality advisory: Estimated clearance was raised to the lowest physiologically plausible non-renal value/]],
];
for (const [name, patient, regimen, levels, expected] of warningCases) {
  test(`warnings in exports: ${name}`, () => {
    const r = run(patient, regimen, levels);
    const onScreen = [...(r.timing_warnings ?? []), ...(r.fit_quality_warnings ?? [])];
    assert.ok(onScreen.length > 0, "the fixture produces a warning on screen");
    const rows: (FrequencyOption | null)[] = [null, ...(r.frequency_options ?? [])];
    for (const row of rows) {
      const { data, text, note } = report(patient, regimen, levels, r, row, row === null);
      const noteLines = note.split("\n");
      for (const re of expected) assert.ok(noteLines.some((l) => re.test(l)), `note line ${re} (row ${row ? `${row.dose_mg}q${row.interval_hours}` : "as entered"})`);
      // Every engine warning, verbatim, in the note and in the PDF's warnings section and its printed note.
      const pdfWarnings = section(text, "Warnings and advisories");
      for (const w of onScreen) {
        assert.ok(note.includes(w), `note carries: ${w.slice(0, 50)}`);
        assert.ok(pdfWarnings.includes(w), `PDF warnings section carries: ${w.slice(0, 50)}`);
        assert.ok(section(text, "Clinical Note (for Medical Record)").includes(w), "the note printed in the PDF carries it too");
      }
      assert.equal(data.warnings!.length, data.exposure_summary!.warnings.length);
    }
  });
}

test("the infusion-rate note and a below-target recommendation are carried too", () => {
  const regimen = ss(1000, 12, 1);
  const levels = [lvl(9, 11)];
  const r = run(std, regimen, levels);
  assert.ok(r.infusion_safety_note);
  const rec = r.frequency_options!.find((o) => o.is_recommended)!;
  const { note, text } = report(std, regimen, levels, r, rec, false);
  assert.ok(note.includes(`Infusion note: ${r.infusion_safety_note}`));
  assert.ok(section(text, "Warnings and advisories").includes(r.infusion_safety_note!));
  // Below target cannot be reached on the level path today (such a regimen is refused); the rule is still covered.
  const given = { title: "Current regimen as entered", regimen: "", period: "", figures: { auc24: 300, peak: 20, trough: 5 } };
  const proposed = { title: "Proposed adjustment (not yet given)", regimen: "", period: "", figures: { auc24: 380, peak: 25, trough: 6 }, origin: "engine" as const, change: "dose_or_interval" as const };
  const w = collectExportWarnings({ auc_range_status: "below_target", predicted_auc24: 380 }, { given, proposed, single: false, viewingProposed: true });
  assert.deepEqual(w.map((x) => x.kind), ["below_target"]);
  assert.ok(w[0].text.startsWith("The recommended regimen is predicted to achieve AUC24 of 380 mg·h/L, which is below the target range of 400–600 mg·h/L."));
  assert.deepEqual(collectExportWarnings({ auc_range_status: "below_target", predicted_auc24: 380 }, { given, proposed: null, single: false, viewingProposed: false }), []);
});

test("Empiric reports are built as before: the active option, else the engine's recommendation", () => {
  const regimen = ss(1000, 12, 1);
  const response = {
    recommendation_type: "initial_regimen" as const, auc24: 480, peak: 30, trough: 12,
    recommended_dose: "1250 mg", recommended_interval_hours: 12, recommended_infusion_duration_hours: 125 / 60,
    interpretation_summary: "i", assumptions: [], limitations: [], curve: [], measured_levels: [],
    frequency_options: [{ dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 100 / 60, auc24: 510, peak: 28, trough: 14, is_recommended: false, clinical_note: "option note" }],
    documentation_preview: { quick_summary: "", clinical_note: "engine note" },
  } as unknown as CalculateResponse;
  const base = { patient: std, regimen, levels: [], response, singleDoseStatus: "single" as const };
  const none = buildReportData({ ...base, activeOption: null, activeIsCurrent: false });
  assert.deepEqual({ dose: none.recommended_dose, interval: none.recommended_interval_hours, auc24: none.auc24, current: none.regimen_is_current, note: none.clinical_note }, { dose: "1250 mg", interval: 12, auc24: 480, current: false, note: "engine note" });
  const opt = buildReportData({ ...base, activeOption: response.frequency_options![0], activeIsCurrent: false });
  assert.deepEqual({ dose: opt.recommended_dose, interval: opt.recommended_interval_hours, auc24: opt.auc24, note: opt.clinical_note }, { dose: "1000", interval: 8, auc24: 510, note: "option note" });
  assert.equal(opt.exposure_summary, undefined);
  assert.equal(opt.warnings, undefined);
});

// ── 5. Headings and captions follow the proposal (third review) ─────────────
//
// 30a1814 headed every candidate "Proposed regimen (not yet given)" and
// "Projected steady-state exposure of the proposed regimen (not yet given)",
// including the candidate that is the regimen entered, continued, directly
// above a table row and a note line that said "continue as entered".

const UNCHANGED = { patient: std, regimen: ss(1000, 12, 100 / 60), levels: [lvl(13, 11)] };
/** The same, after three doses: the history's own figures are an actual-history projection. */
const UNCHANGED_EARLY = { patient: std, regimen: ss(1000, 12, 100 / 60, 3), levels: [lvl(11, 11)] };
const CHANGED = { patient: std, regimen: ss(1000, 12, 1), levels: [lvl(9, 11)] };
const INFUSION_ONLY = { patient: { ...std, age: 30, weight_kg: 55, serum_creatinine_mg_dl: 0.7 }, regimen: ss(1500, 24, 1), levels: [lvl(25, 6)] };
const HOLD = { patient: std, regimen: ss(1000, 12, 1), levels: [lvl(28, 3), lvl(12.9, 3)] };
const BLOCKED = { patient: { ...std, age: 80, weight_kg: 60, height_cm: 165, sex: "female", serum_creatinine_mg_dl: 6 }, regimen: ss(750, 24, 1, 3), levels: [lvl(30, 20)] };
/** One dose given; the engine then suggests the same dose, interval and infusion duration as maintenance. */
const SINGLE: { patient: typeof std; regimen: CalculateRequestRegimen; levels: Level[] } = {
  patient: std,
  regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 100 / 60, doses_given: 1, target_auc24: 450 },
  levels: [lvl(7, 8)],
};

const CONTINUE_BOX = "Proposed regimen (continue as entered)";
const CONTINUE_EXPOSURE = "Projected steady-state exposure if the regimen is continued as entered";
const NOT_YET_BOX = "Proposed regimen (not yet given)";
const NOT_YET_EXPOSURE = "Projected steady-state exposure of the proposed regimen (not yet given)";
const CONTINUE = /continued? as entered/i;
const NOT_YET = /not yet given/i;

/** The headings and captions that label the regimen box, the exposure metrics and the comparison table. */
function headings(html: string) {
  const titles = Array.from(html.matchAll(/<div class="section-title">([^<]*)<\/div>/g), (m) => m[1]);
  const infusion = /<div class="dose-detail">(Infused? over [^<]*)<\/div>/.exec(html)?.[1] ?? null;
  const table = /<table class="exposure-table">[\s\S]*?<\/table>/.exec(html)?.[0] ?? "";
  const rows = Array.from(table.matchAll(/<tr><th>([^<]*)<\/th>/g), (m) => m[1]);
  return { titles, infusion, rows };
}
const minutes = (hours: number) => Number((hours * 60).toFixed(6));

test("unchanged regimen: the box, its infusion line, the exposure heading, the table and the note say continue as entered; nothing says not yet given", () => {
  for (const c of [UNCHANGED, UNCHANGED_EARLY]) {
    const r = run(c.patient, c.regimen, c.levels);
    const rec = r.frequency_options!.find((o) => o.is_recommended)!;
    assert.deepEqual(
      { dose: rec.dose_mg, interval: rec.interval_hours, infusion: minutes(rec.infusion_duration_hours) },
      { dose: 1000, interval: 12, infusion: 100 },
      "the fixture's recommendation is the regimen entered",
    );
    const { data, html, text, note } = report(c.patient, c.regimen, c.levels, r, rec, false);
    assert.equal(data.regimen_is_current, false, "the candidate row is exported, not the 'as entered' row");
    const h = headings(html);
    assert.ok(h.titles.includes(CONTINUE_BOX), `regimen box heading: ${h.titles.join(" | ")}`);
    assert.ok(h.titles.includes(CONTINUE_EXPOSURE), `exposure heading: ${h.titles.join(" | ")}`);
    assert.equal(h.infusion, "Infuse over 100 minutes (as entered)");
    assert.deepEqual(h.rows, ["Current regimen as entered", CONTINUE_BOX]);
    // The contradiction itself: no heading, caption, table cell or note line calls this regimen "not yet given".
    assert.doesNotMatch(text, NOT_YET, "PDF");
    assert.doesNotMatch(note, NOT_YET, "note");
    // The box is still the selected row, with that row's figures.
    const box = section(text, CONTINUE_BOX);
    assert.ok(box.includes("1000 mg every 12 h"), box);
    assert.ok(box.includes(`AUC₂₄: ${fmt(rec.auc24, 1)} mg·h/L`), box);
    assert.ok(box.includes(`${CONTINUE_EXPOSURE} AUC₂₄ ${fmt(rec.auc24, 1)} mg·h/L Peak ${fmt(rec.peak, 2)} mg/L Trough ${fmt(rec.trough, 2)} mg/L`), box);
    assert.ok(note.includes(`Proposed regimen (continue as entered): 1000 mg every 12 h infused over 100 minutes. Projected steady-state exposure if this regimen is continued: AUC24 ${rec.auc24} mg·h/L`), note);
  }
});

test("changed and alternative proposals stay 'not yet given' in every heading and never say continue", () => {
  let recommendedSeen = 0, alternativesSeen = 0, infusionOnlySeen = 0;
  for (const c of [CHANGED, UNCHANGED, INFUSION_ONLY]) {
    const r = run(c.patient, c.regimen, c.levels);
    for (const o of r.frequency_options!) {
      const { data, html, text, note } = report(c.patient, c.regimen, c.levels, r, o, false);
      const change = data.exposure_summary!.proposed!.change;
      if (change === "none") continue; // the unchanged row has its own test
      if (o.is_recommended) recommendedSeen++; else alternativesSeen++;
      if (change === "infusion_only") infusionOnlySeen++;
      const label = `${o.dose_mg} mg q${o.interval_hours}h over ${minutes(o.infusion_duration_hours)} min (${change})`;
      const h = headings(html);
      assert.ok(h.titles.includes(NOT_YET_BOX) && h.titles.includes(NOT_YET_EXPOSURE), `${label}: ${h.titles.join(" | ")}`);
      assert.equal(h.infusion, `Infuse over ${minutes(o.infusion_duration_hours)} minutes`, label);
      assert.match(h.rows[1], /not yet given\)$/, label);
      assert.ok(!h.titles.some((t) => CONTINUE.test(t)) && !h.rows.some((t) => CONTINUE.test(t)), `${label}: no heading says continue`);
      assert.doesNotMatch(text, CONTINUE, `${label}: PDF`);
      assert.doesNotMatch(note, CONTINUE, `${label}: note`);
      if (!o.is_recommended) assert.ok(text.includes("Candidate selected by the clinician"), `${label}: named as the clinician's selection`);
    }
  }
  assert.ok(recommendedSeen >= 2 && alternativesSeen >= 8 && infusionOnlySeen >= 1, `coverage: ${recommendedSeen} recommended, ${alternativesSeen} alternatives, ${infusionOnlySeen} infusion-only`);
});

test("after a single dose a maintenance candidate is never 'continue as entered', even with the same dose, interval and infusion duration", () => {
  const r = run(SINGLE.patient, SINGLE.regimen, SINGLE.levels);
  const rec = r.frequency_options!.find((o) => o.is_recommended)!;
  assert.deepEqual({ dose: rec.dose_mg, interval: rec.interval_hours, infusion: minutes(rec.infusion_duration_hours) }, { dose: 1000, interval: 12, infusion: 100 }, "the fixture's suggestion repeats the dose given");
  const { data, html, text, note } = report(SINGLE.patient, SINGLE.regimen, SINGLE.levels, r, rec, false);
  assert.equal(data.exposure_summary!.proposed!.change, "after_single_dose");
  const h = headings(html);
  assert.ok(h.titles.includes(NOT_YET_BOX) && h.titles.includes(NOT_YET_EXPOSURE), h.titles.join(" | "));
  assert.equal(h.infusion, "Infuse over 100 minutes");
  assert.equal(h.rows[1], "Proposed maintenance regimen (not yet given)");
  assert.doesNotMatch(text, CONTINUE);
  assert.doesNotMatch(note, CONTINUE);
});

test("review hold and blocked recommendation: nothing is headed as proposed, continued or not yet given", () => {
  for (const [name, c] of [["hold", HOLD], ["blocked", BLOCKED]] as const) {
    const r = run(c.patient, c.regimen, c.levels);
    assert.ok(name === "hold" ? r.review_hold : r.adjustment_dosing_blocked, `${name}: the fixture produces that state`);
    for (const [activeOption, activeIsCurrent] of [[null, true], [null, false]] as const) {
      const { html, text, note } = report(c.patient, c.regimen, c.levels, r, activeOption, activeIsCurrent);
      const h = headings(html);
      assert.ok(h.titles.includes("Current regimen (as entered)"), `${name}: ${h.titles.join(" | ")}`);
      assert.ok(!h.titles.some((t) => NOT_YET.test(t) || CONTINUE.test(t)), `${name}: ${h.titles.join(" | ")}`);
      assert.deepEqual(h.rows, ["Current regimen as entered", "Proposed maintenance regimen"], name);
      for (const [label, out] of [["PDF", text], ["note", note]] as const) {
        assert.doesNotMatch(out, NOT_YET, `${name} ${label}`);
        assert.doesNotMatch(out, CONTINUE, `${name} ${label}`);
        assert.doesNotMatch(out, /Proposed (regimen|adjustment|maintenance regimen) \(/, `${name} ${label}: no proposal is titled`);
      }
      if (name === "hold") {
        assert.match(text, /Recommendation withheld/);
        assert.ok(text.includes(r.review_hold!.message), "the review reason is preserved");
      } else {
        assert.ok(text.includes("No automatic maintenance regimen"), "the blocked state is stated");
      }
    }
  }
});

test("the 'as entered' view of an unchanged recommendation: the box is the current regimen and the table says continue", () => {
  const r = run(UNCHANGED.patient, UNCHANGED.regimen, UNCHANGED.levels);
  const { html, text, note } = report(UNCHANGED.patient, UNCHANGED.regimen, UNCHANGED.levels, r, null, true);
  const h = headings(html);
  assert.ok(h.titles.includes("Current regimen (as entered)") && h.titles.includes("Steady-state projection of the current regimen (as entered)"), h.titles.join(" | "));
  assert.equal(h.infusion, "Infused over 100 minutes (as entered)");
  assert.deepEqual(h.rows, ["Current regimen as entered", CONTINUE_BOX]);
  assert.doesNotMatch(text, NOT_YET);
  assert.doesNotMatch(note, NOT_YET);
});

test("one rule across unchanged, changed, alternative, hold and blocked: headings say continue exactly when the proposal is the regimen entered", () => {
  let continued = 0, notYet = 0, history = 0;
  for (const c of [UNCHANGED, UNCHANGED_EARLY, CHANGED, INFUSION_ONLY, SINGLE, HOLD, BLOCKED]) {
    const r = run(c.patient, c.regimen, c.levels);
    const views: [FrequencyOption | null, boolean][] = [[null, true], ...(r.frequency_options ?? []).map((o): [FrequencyOption, boolean] => [o, false])];
    for (const [activeOption, activeIsCurrent] of views) {
      const { data, html } = report(c.patient, c.regimen, c.levels, r, activeOption, activeIsCurrent);
      const h = headings(html);
      const proposal = data.exposure_summary!.proposed;
      const label = `${c.regimen.dose_mg} mg q${c.regimen.interval_hours}h × ${c.regimen.doses_given}, view ${activeOption ? `${activeOption.dose_mg} mg q${activeOption.interval_hours}h` : "as entered"}`;
      // The table row (the summary the verifier found correct) says continue exactly for an unchanged proposal.
      if (proposal) assert.equal(CONTINUE.test(proposal.title), proposal.change === "none", `${label}: row title "${proposal.title}"`);
      const box = h.titles.filter((t) => t === CONTINUE_BOX || t === NOT_YET_BOX);
      const exposure = h.titles.filter((t) => t === CONTINUE_EXPOSURE || t === NOT_YET_EXPOSURE);
      if (activeOption && proposal?.change === "none") {
        continued++;
        assert.deepEqual([box, exposure], [[CONTINUE_BOX], [CONTINUE_EXPOSURE]], label);
        assert.equal(box[0], h.rows[1], `${label}: the box heading is the table row's title`);
        assert.match(h.infusion ?? "", /\(as entered\)$/, label);
      } else if (activeOption) {
        notYet++;
        assert.deepEqual([box, exposure], [[NOT_YET_BOX], [NOT_YET_EXPOSURE]], label);
        assert.doesNotMatch(h.infusion ?? "", /as entered/, label);
      } else {
        history++;
        assert.deepEqual([box, exposure], [[], []], `${label}: the entered history carries no proposed heading`);
      }
    }
  }
  assert.ok(continued >= 2 && notYet >= 15 && history >= 7, `coverage: ${continued} continued, ${notYet} not yet given, ${history} as entered`);
});

test("the continue heading is never borrowed: another regimen in the box, a hold or a blocked result keeps the cautious wording", () => {
  const r = run(UNCHANGED.patient, UNCHANGED.regimen, UNCHANGED.levels);
  const rec = r.frequency_options!.find((o) => o.is_recommended)!;
  const { data } = report(UNCHANGED.patient, UNCHANGED.regimen, UNCHANGED.levels, r, rec, false);
  assert.ok(headings(generateReportHTML(data, "pro", "en")).titles.includes(CONTINUE_BOX), "the unmodified report is the continue case");
  const variants: [string, typeof data][] = [
    ["another dose in the box", { ...data, recommended_dose: "1250" }],
    ["another interval in the box", { ...data, recommended_interval_hours: 8 }],
    ["another infusion duration in the box", { ...data, recommended_infusion_duration_hours: 1 }],
    ["a review hold", { ...data, review_hold: { message: "Levels disagree." } }],
    ["a blocked recommendation", { ...data, recommendation_blocked: "No safe regimen." }],
    ["a summary that classifies the proposal as a change", { ...data, exposure_summary: { ...data.exposure_summary!, proposed: { ...data.exposure_summary!.proposed!, change: "dose_or_interval" } } }],
    ["a summary with no proposal", { ...data, exposure_summary: { ...data.exposure_summary!, proposed: null } }],
  ];
  for (const [name, d] of variants) {
    const h = headings(generateReportHTML(d, "pro", "en"));
    assert.ok(!h.titles.includes(CONTINUE_BOX) && !h.titles.includes(CONTINUE_EXPOSURE), `${name}: ${h.titles.join(" | ")}`);
    assert.doesNotMatch(h.infusion ?? "", /as entered/, name);
  }
});

