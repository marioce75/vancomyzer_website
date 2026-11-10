/**
 * Engine response regressions from the second independent review of the
 * dosing-history work. Synthetic inputs only; wording and response assembly,
 * not the PK model.
 *
 *  1. The engine's own recommendation always has a candidate row with its own
 *     predicted exposure (it had none when the grid kept another dose at that
 *     interval, so the band and the PDF showed the current regimen's exposure
 *     beside the recommended regimen).
 *  2. A review hold states the hold in the interpretation and the notes, and
 *     never the adjustment that was computed and then withdrawn.
 *  3. The same dose and interval over a different infusion duration is not
 *     described as the same regimen.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { runExistingRegimenPipeline } from "../runExistingRegimenPipeline";

type R = Record<string, any>;
const std = { age: 55, weight_kg: 75, height_cm: 175, sex: "male", serum_creatinine_mg_dl: 1.0 };
const lvl = (v: number, t: number) => ({ value_mcg_ml: v, collection_time: `2026-09-16T${String(Math.floor(t)).padStart(2, "0")}:${String(Math.round((t % 1) * 60)).padStart(2, "0")}:00Z`, time_since_last_dose_hours: t });
const ss = (dose: number, tau: number, infusionHours: number, n = 6) => ({ dose_mg: dose, interval_hours: tau, infusion_duration_hours: infusionHours, doses_given: n, steady_state_confirmed: n >= 6, target_auc24: 450 });
function run(patient: R, regimen: R, levels: R[]): R {
  const r = runExistingRegimenPipeline({ patient, regimen, levels }) as R;
  assert.ok(r.recommendation_type, `pipeline error: ${JSON.stringify(r.field_errors)}`);
  return r;
}

test("the engine's recommendation always has a candidate row carrying its own predicted exposure", () => {
  // The grid's q24h row is 1750 mg; the engine keeps 1500 mg q24h (sparse evidence).
  const r = run({ age: 30, weight_kg: 55, height_cm: 175, sex: "male", serum_creatinine_mg_dl: 0.7 }, ss(1500, 24, 1), [lvl(25, 6)]);
  assert.equal(r.recommended_dose, "1500 mg");
  assert.equal(r.recommended_interval_hours, 24);
  const flagged = r.frequency_options.filter((o: R) => o.is_recommended);
  assert.equal(flagged.length, 1, "exactly one row is the recommendation");
  const row = flagged[0];
  assert.deepEqual(
    { dose: row.dose_mg, interval: row.interval_hours, infusion: row.infusion_duration_hours, auc24: row.auc24, peak: row.peak, trough: row.trough },
    { dose: 1500, interval: 24, infusion: r.recommended_infusion_duration_hours, auc24: r.predicted_auc24, peak: r.predicted_peak, trough: r.predicted_trough },
  );
  assert.ok(Array.isArray(row.curve) && row.curve.length > 10, "the row has its own curve");
  assert.ok(typeof row.clinical_note === "string" && row.clinical_note.includes("Recommendation: 1500 every 24 h"));
  // The grid's own q24h row is still there, unflagged and unchanged in kind.
  assert.ok(r.frequency_options.some((o: R) => o.dose_mg === 1750 && o.interval_hours === 24 && !o.is_recommended));
  // The row's peak differs from the current regimen's: the figures are the recommendation's, not the history's.
  assert.notEqual(row.peak, r.peak);
});

test("across a grid, every actionable result flags exactly one row equal to the recommendation", () => {
  let actionable = 0;
  for (const scr of [0.7, 1, 2.2]) for (const wt of [55, 75, 120]) for (const lv of [[15, 10], [25, 6], [8, 11.5]]) {
    for (const regimen of [ss(1500, 24, 1), ss(1000, 12, 2), ss(1000, 12, 1.5, 3), { dose_mg: 2000, interval_hours: 12, infusion_duration_hours: 200 / 60, doses_given: 1, target_auc24: 450 }]) {
      const r = run({ ...std, weight_kg: wt, serum_creatinine_mg_dl: scr }, regimen, [lvl(lv[0], lv[1])]);
      if (r.adjustment_dosing_blocked || r.review_hold) {
        assert.equal(r.frequency_options.length, 0, "no candidates when blocked or held");
        continue;
      }
      actionable++;
      const flagged = r.frequency_options.filter((o: R) => o.is_recommended);
      assert.equal(flagged.length, 1);
      assert.equal(flagged[0].dose_mg, Number.parseFloat(r.recommended_dose));
      assert.equal(flagged[0].interval_hours, r.recommended_interval_hours);
      assert.equal(flagged[0].infusion_duration_hours, r.recommended_infusion_duration_hours, "the row and the recommendation share one infusion duration");
      assert.equal(flagged[0].auc24, r.predicted_auc24);
      assert.equal(flagged[0].peak, r.predicted_peak);
      assert.equal(flagged[0].trough, r.predicted_trough);
    }
  }
  assert.ok(actionable > 50);
});

for (const [name, regimen, levels] of [
  ["steady-state history", ss(1000, 12, 1), [lvl(28, 3), lvl(12.9, 3)]],
  ["single dose", { dose_mg: 2000, interval_hours: 12, infusion_duration_hours: 200 / 60, doses_given: 1, target_auc24: 450 }, [lvl(28, 6), lvl(12.9, 6)]],
] as const) {
  test(`review hold (${name}): the text states the hold and its reason, never the withdrawn adjustment`, () => {
    const r = run(std, regimen, [...levels]);
    assert.equal(r.review_hold?.reason, "discordant_duplicate_samples");
    // The actionable fields are withdrawn, including the infusion flags that described the withdrawn regimen.
    assert.equal(r.recommended_dose, "");
    assert.equal(r.recommended_interval_hours, 0);
    assert.equal(r.recommended_infusion_duration_hours, undefined);
    assert.equal(r.infusion_duration_adjusted_for_safety, undefined);
    assert.equal(r.infusion_safety_note, undefined);
    assert.deepEqual(r.frequency_options, []);
    for (const [label, text] of [
      ["interpretation_summary", r.interpretation_summary],
      ["clinical_note", r.documentation_preview.clinical_note],
      ["quick_summary", r.documentation_preview.quick_summary],
    ] as const) {
      assert.doesNotMatch(text, /Recommended adjustment|Suggested maintenance regimen|Recommendation: |Change summary|Change rationale|Infusion duration adjusted/, `${label} must not state the withdrawn adjustment`);
      assert.doesNotMatch(text, /every 0 h|\bmg every \d+ h infused/, `${label} must not print a regimen to give`);
      assert.match(text, /Recommendation withheld/, `${label} states the hold`);
      assert.ok(text.includes(r.review_hold.message), `${label} carries the review reason`);
    }
    // The history and its estimates stay available for review.
    assert.ok(r.auc24 > 0 && r.peak > 0 && r.trough > 0);
    assert.equal(r.measured_levels.length, 2);
    assert.ok(r.curve.length > 10);
    assert.match(r.interpretation_summary, name === "single dose" ? /^Single-dose analysis: 2000 mg, one dose only\./ : /^Current regimen: 1000 mg every 12 h\./);
    assert.ok(r.interpretation_summary.includes(`AUC24 ${r.auc24} mg·h/L; peak ${r.peak} mg/L; trough ${r.trough} mg/L`));
  });
}

test("same dose and interval over a different infusion duration is described as an infusion change, not as the same regimen", () => {
  // Entered: 1000 mg q12h over 120 minutes. The engine keeps 1000 mg q12h and states its own 100-minute infusion.
  const r = run(std, ss(1000, 12, 2), [lvl(13, 11)]);
  assert.equal(r.recommended_dose, "1000 mg");
  assert.equal(r.recommended_interval_hours, 12);
  assert.equal(Math.round(r.recommended_infusion_duration_hours * 60), 100);
  assert.match(r.documentation_preview.clinical_note, /Change summary: infusion duration change from 120 to 100 minutes; dose and interval unchanged\./);
  assert.match(r.interpretation_summary, /Change rationale: dose and interval are unchanged; infusion duration change from 120 to 100 minutes\./);
  assert.doesNotMatch(r.documentation_preview.clinical_note + r.interpretation_summary, /same practical regimen step/);
});

test("dose, interval and infusion duration all unchanged still reads as the same regimen", () => {
  const r = run(std, ss(1000, 12, 100 / 60), [lvl(13, 11)]);
  assert.equal(r.recommended_dose, "1000 mg");
  assert.match(r.documentation_preview.clinical_note, /Change summary: same practical regimen step retained/);
  assert.match(r.interpretation_summary, /Recommendation remains on the same practical regimen step/);
});
