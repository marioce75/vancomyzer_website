/**
 * Regimen identity (regimenIdentity.ts): dose, interval AND infusion duration.
 * Wording helper only; no PK calculation.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { classifyRegimenChange, infusionChangeText, infusionMinutes, sameInfusionDuration, sameRegimen } from "../regimenIdentity";

const entered = { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 2 };

test("same dose and interval over a different infusion duration is a different regimen", () => {
  assert.equal(sameRegimen(entered, { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 100 / 60 }), false);
  assert.equal(classifyRegimenChange(entered, { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 100 / 60 }), "infusion_only");
  assert.equal(infusionChangeText(entered, { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 100 / 60 }), "infusion duration change from 120 to 100 minutes");
});

test("all three equal is the same regimen, to the printed precision", () => {
  // 100 minutes entered as minutes/60 and produced by the engine as dose/600 are the same duration.
  assert.equal(sameRegimen({ dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 100 / 60 }, { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1000 / 600 }), true);
  assert.equal(classifyRegimenChange(entered, { ...entered }), "none");
  assert.equal(infusionChangeText(entered, { ...entered }), null);
});

test("a dose or interval difference is a dose_or_interval change whatever the infusion duration", () => {
  assert.equal(classifyRegimenChange(entered, { dose_mg: 1250, interval_hours: 12, infusion_duration_hours: 2 }), "dose_or_interval");
  assert.equal(classifyRegimenChange(entered, { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 2 }), "dose_or_interval");
});

test("an unstated infusion duration never equals a stated one", () => {
  assert.equal(sameInfusionDuration(undefined, 1), false);
  assert.equal(sameInfusionDuration(0, 1), false);
  assert.equal(sameInfusionDuration(undefined, null), true);
  assert.equal(sameRegimen({ dose_mg: 1000, interval_hours: 12 }, entered), false);
  assert.equal(infusionMinutes(1.25), 75);
  assert.equal(infusionMinutes(0), undefined);
});
