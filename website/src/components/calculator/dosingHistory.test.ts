/**
 * Dosing-history form model (dosingHistory.ts): the clinician answers
 * "loading dose given?" and "maintenance doses given before the level", and
 * the request payload must be exactly what the engine expected before.
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { CalculateRequestRegimen } from "@/types/calculator";
import {
  maintenanceDosesGiven,
  onlyLoadingDoseGiven,
  requestRegimen,
  setLoadingDoseGiven,
  setMaintenanceDosesGiven,
  summarizeDosingHistory,
  updateLoadingDose,
} from "./dosingHistory";
import { runExistingRegimenPipeline } from "@/lib/pk/runExistingRegimenPipeline";

const empty: CalculateRequestRegimen = { dose_mg: 0, interval_hours: 0, infusion_duration_hours: 0, steady_state_confirmed: false };

/** Simulates the clicks: Yes, 2000 mg / 200 min, 1 maintenance dose, 750 mg q12h over 75 min. */
function loadThenOneMaintenance(): CalculateRequestRegimen {
  let r = setLoadingDoseGiven(empty, true);
  r = updateLoadingDose(r, { loading_dose_mg: 2000 });
  r = updateLoadingDose(r, { loading_infusion_duration_hours: 200 / 60 });
  r = setMaintenanceDosesGiven(r, 1);
  return { ...r, dose_mg: 750, interval_hours: 12, infusion_duration_hours: 75 / 60 };
}

test("loading dose + one maintenance dose sends doses_given 2 with the loading dose", () => {
  const sent = requestRegimen(loadThenOneMaintenance());
  assert.equal(sent.doses_given, 2);
  assert.equal(sent.dose_mg, 750);
  assert.equal(sent.loading_dose_mg, 2000);
  assert.equal(sent.loading_infusion_duration_hours, 200 / 60);
  assert.equal(sent.target_auc24, undefined);
});

test("the form path reproduces the hand-built payload in the engine", () => {
  const pt = { age: 55, weight_kg: 75, height_cm: 175, sex: "male", serum_creatinine_mg_dl: 1.0 };
  const levels = [{ value_mcg_ml: 14.3, collection_time: "", time_since_last_dose_hours: 10 }];
  const viaForm = runExistingRegimenPipeline({ patient: pt, regimen: requestRegimen(loadThenOneMaintenance()), levels }) as Record<string, any>;
  const direct = runExistingRegimenPipeline({
    patient: pt,
    regimen: { dose_mg: 750, interval_hours: 12, infusion_duration_hours: 1.25, doses_given: 2, steady_state_confirmed: false, loading_dose_mg: 2000, loading_infusion_duration_hours: 200 / 60 },
    levels,
  }) as Record<string, any>;
  assert.ok(viaForm.pk_parameters, "form payload must be accepted");
  assert.deepEqual(viaForm.pk_parameters, direct.pk_parameters);
  assert.equal(viaForm.recommended_dose, direct.recommended_dose);
  assert.equal(viaForm.loading_dose?.dose_mg, 2000);
});

test("loading dose only (0 maintenance) is the single-dose workflow on the loading dose", () => {
  let r = setLoadingDoseGiven(empty, true);
  r = setMaintenanceDosesGiven(r, 0);
  r = updateLoadingDose(r, { loading_dose_mg: 2000, loading_infusion_duration_hours: 200 / 60 });
  assert.ok(onlyLoadingDoseGiven(r));
  const sent = requestRegimen(r);
  assert.equal(sent.doses_given, 1);
  assert.equal(sent.dose_mg, 2000);
  assert.equal(sent.infusion_duration_hours, 200 / 60);
  assert.equal(sent.loading_dose_mg, undefined, "loading fields are not sent with a single dose");
  assert.equal(sent.target_auc24, 450);
});

test("leaving 'loading dose only' never turns the loading dose into a maintenance dose", () => {
  let r = setLoadingDoseGiven(empty, true);
  r = setMaintenanceDosesGiven(r, 0);
  r = updateLoadingDose(r, { loading_dose_mg: 2000, loading_infusion_duration_hours: 200 / 60 });
  const one = setMaintenanceDosesGiven(r, 1);
  assert.equal(one.dose_mg, 0);
  assert.equal(one.doses_given, 2);
  assert.equal(one.loading_dose_mg, 2000);
  const no = setLoadingDoseGiven(r, false);
  assert.equal(no.dose_mg, 0);
  assert.equal(no.doses_given, undefined);
  assert.equal(no.loading_dose_mg, undefined);
});

test("no loading dose: one maintenance dose is the single-dose workflow, n doses are n equal doses", () => {
  const one = setMaintenanceDosesGiven({ ...empty, dose_mg: 750, infusion_duration_hours: 1.25 }, 1);
  assert.equal(one.doses_given, 1);
  assert.equal(one.target_auc24, 450);
  const three = setMaintenanceDosesGiven({ ...empty, dose_mg: 750, interval_hours: 12, infusion_duration_hours: 1.25 }, 3);
  assert.deepEqual(requestRegimen(three), { ...empty, dose_mg: 750, interval_hours: 12, infusion_duration_hours: 1.25, doses_given: 3, steady_state_confirmed: false, target_auc24: undefined });
});

test("toggling the loading dose keeps the maintenance count the clinician chose", () => {
  const two = setMaintenanceDosesGiven({ ...empty, dose_mg: 750, interval_hours: 12, infusion_duration_hours: 1.25 }, 2);
  const withLoad = setLoadingDoseGiven(two, true);
  assert.equal(maintenanceDosesGiven(withLoad), 2);
  assert.equal(withLoad.doses_given, 3);
  const back = setLoadingDoseGiven(withLoad, false);
  assert.equal(back.doses_given, 2);
  assert.equal(back.loading_dose_mg, undefined);
});

test("previously saved drafts read the same way", () => {
  // Old drafts stored the total count; a loading dose was only possible with ≥ 2 doses.
  assert.equal(maintenanceDosesGiven({ ...empty, doses_given: 3, loading_dose_mg: 2000 }), 2);
  assert.equal(maintenanceDosesGiven({ ...empty, doses_given: 1 }), 1);
  assert.equal(maintenanceDosesGiven(empty), undefined);
});

test("summary reads the history back in plain language", () => {
  assert.equal(
    summarizeDosingHistory(loadThenOneMaintenance()),
    "2,000 mg loading dose at 0 h → 750 mg at 12 h. Level drawn after the last 750 mg dose (dose 2 of 2).",
  );
  assert.equal(summarizeDosingHistory(empty), null);
});
