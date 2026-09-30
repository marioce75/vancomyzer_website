import assert from "node:assert/strict";
import { computeSafeInfusionDurationHours, computeSafeInfusionDurationMinutes } from "../recommend/infusionSafety";
import { buildEmpiricLoadingDose } from "../recommend/buildEmpiricLoadingDose";

// Cover the entire recommended-dose grid, including every loading dropdown dose.
for (let dose = 250; dose <= 4500; dose += 250) {
  const expectedMinutes = Math.max(60, dose / 10);
  const minutes = computeSafeInfusionDurationMinutes(dose);
  const hours = computeSafeInfusionDurationHours(dose).infusion_duration_hours;
  assert.equal(minutes, expectedMinutes);
  assert.ok(Math.abs(hours * 60 - minutes) < 1e-9);
  assert.ok(dose / minutes <= 10);
  assert.ok(minutes >= 60);
  assert.equal(computeSafeInfusionDurationHours(dose, hours).adjusted_for_safety, false);
  assert.equal(computeSafeInfusionDurationHours(dose, hours - 0.01).adjusted_for_safety, true);
}
for (let dose = 1000; dose <= 3000; dose += 250) {
  const loading = buildEmpiricLoadingDose({ actual_body_weight_kg: dose / 25 });
  assert.equal(loading.suggested_dose_mg, dose);
  assert.ok(Math.abs(loading.infusion_duration_hours * 60 - dose / 10) < 1e-9);
}
assert.equal(computeSafeInfusionDurationMinutes(2000), 200);
console.log("Exact infusion durations passed for all recommended-dose increments and loading doses.");
