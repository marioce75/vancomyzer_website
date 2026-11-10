/**
 * Single-dose interpretation wording (buildInterpretationSummary.ts): the text
 * must not call a level "post-loading" when the engine cannot know a loading
 * dose was given, and must not ask for a first level when one was entered.
 * Wording only; the numbers in the sentence are the engine's own.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { runExistingRegimenPipeline } from "../runExistingRegimenPipeline";

const pt = { age: 55, weight_kg: 75, height_cm: 175, sex: "male", serum_creatinine_mg_dl: 1.0 };
const single = { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1, doses_given: 1, steady_state_confirmed: false, target_auc24: 450 };

test("one dose with a level: no post-loading wording, no request to draw a first level", () => {
  const r = runExistingRegimenPipeline({ patient: pt, regimen: single, levels: [{ value_mcg_ml: 12, collection_time: "", time_since_last_dose_hours: 8 }] }) as Record<string, any>;
  assert.ok(r.pk_parameters);
  const texts = [r.interpretation_summary, ...r.frequency_options.map((o: any) => o.interpretation_summary)] as string[];
  for (const t of texts) {
    assert.ok(!/post-loading|loading dose/i.test(t), t);
    assert.ok(!/draw (the )?first level/i.test(t), t);
    assert.ok(t.includes("Estimate based on one measured level after this single dose; confirm with a follow-up level after further doses."), t);
    assert.ok(t.startsWith("Single-dose analysis: 1000 mg, one dose only."));
  }
});

test("one dose with no level yet (preview) asks for the first level after this dose's infusion, without naming a loading dose", () => {
  const r = runExistingRegimenPipeline({ patient: pt, regimen: { ...single, dose_mg: 2000, infusion_duration_hours: 2 }, levels: [] }) as Record<string, any>;
  assert.ok(r.pk_parameters);
  const t = r.interpretation_summary as string;
  assert.ok(t.includes("No level entered yet: draw the first level 1.5–6 h after the end of this dose's infusion for early Bayesian estimation."), t);
  assert.ok(!/post-loading/.test(t));
});

test("the sentence that changed carries the same numbers as before", () => {
  const r = runExistingRegimenPipeline({ patient: pt, regimen: single, levels: [{ value_mcg_ml: 12, collection_time: "", time_since_last_dose_hours: 8 }] }) as Record<string, any>;
  const t = r.interpretation_summary as string;
  assert.ok(t.includes(`first-dose AUC24 ${r.auc24} mg·h/L; peak ${r.peak} mg/L; trough ${r.trough} mg/L`));
  assert.ok(t.includes(`Suggested maintenance regimen: ${r.recommended_dose} every ${r.recommended_interval_hours} h`));
});
