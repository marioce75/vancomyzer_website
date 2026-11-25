import assert from "node:assert/strict";
import { test } from "node:test";
import { computeInitialRegimen } from "../../lib/initialRegimen";
import { runExistingRegimenPipeline } from "../../lib/pk/runExistingRegimenPipeline";
import type { CalculateRequest, CalculateRequestLevel } from "../../types/calculator";
import { calculateClassicInBrowser } from "./localClassic";

const patient = { age: 58, weight_kg: 84, height_cm: 0, sex: "" as const, serum_creatinine_mg_dl: 0.9, dialysis_or_rrt: false };
const regimen = { dose_mg: 1500, infusion_duration_hours: 1.5, interval_hours: 12, doses_given: 5, steady_state_confirmed: false };
const levels: CalculateRequestLevel[] = [
  { collection_time: "2030-01-05T17:00:00Z", time_since_last_dose_hours: 3, value_mcg_ml: 25 },
  { collection_time: "2030-01-06T01:30:00Z", time_since_last_dose_hours: 11.5, value_mcg_ml: 13 },
];
const wire = (data: unknown) => JSON.parse(JSON.stringify(data));

test("owner classic mode matches released empiric output without transport metadata", async () => {
  const result = calculateClassicInBrowser({ mode: "initial_regimen", patient });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), wire(computeInitialRegimen(patient)));
});

test("owner one-/two-level modes match released existing regimen data and curve", async () => {
  for (const n of [1, 2]) {
    const input: CalculateRequest = { mode: "existing_regimen", patient, regimen, levels: levels.slice(0, n) };
    const result = calculateClassicInBrowser(input);
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), wire(runExistingRegimenPipeline({
      patient, regimen, levels: levels.slice(0, n).map(level => ({ ...level })),
    })));
  }
});

test("owner calculator never emits output for missing levels, invalid input or dialysis", async () => {
  for (const input of [
    { mode: "existing_regimen" as const, patient, regimen },
    { mode: "initial_regimen" as const, patient: { ...patient, age: 0 } },
    { mode: "initial_regimen" as const, patient: { ...patient, dialysis_or_rrt: true } },
  ]) {
    const output = calculateClassicInBrowser(input);
    assert.equal(output.status, 400);
    assert.ok(!("curve" in await output.json()));
  }
});
