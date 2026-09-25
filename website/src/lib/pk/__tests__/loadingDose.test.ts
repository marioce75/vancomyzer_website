/**
 * Loading dose as dose 1 in the level workflows (pk/doseHistory.ts).
 * The formula-level check against the independent oracle is section E of
 * oracle/oracle.test.ts; this file checks the workflow end to end.
 */
import assert from "node:assert/strict";
import { runExistingRegimenPipeline } from "../runExistingRegimenPipeline";
import { buildPriorParameters } from "../posterior/buildPriorParameters";
import { normalizePatient } from "../normalize/normalizePatient";
import { computeExposure, singleDoseConcentration } from "../steadyStateTwoCompartment";

type R = Record<string, any>;
let passed = 0;
const pt = { age: 60, weight_kg: 80, height_cm: 175, sex: "male", serum_creatinine_mg_dl: 1.0 };
const base = { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 2, doses_given: 3, steady_state_confirmed: false };
const lv = (v: number, t = 11.5) => [{ value_mcg_ml: v, collection_time: "", time_since_last_dose_hours: t }];

// 1. A "loading dose" equal to the maintenance dose reproduces the equal-dose result exactly.
{
  const a = runExistingRegimenPipeline({ patient: pt, regimen: base, levels: lv(14) }) as R;
  const b = runExistingRegimenPipeline({ patient: pt, regimen: { ...base, loading_dose_mg: 1000, loading_infusion_duration_hours: 2 }, levels: lv(14) }) as R;
  assert.equal(a.pk_parameters.CL, b.pk_parameters.CL);
  assert.equal(a.auc24, b.auc24);
  assert.deepEqual(a.actual_history_exposure, b.actual_history_exposure);
  assert.equal(a.recommended_dose, b.recommended_dose);
  assert.deepEqual(a.measured_levels, b.measured_levels);
  passed++;
}

// 2. Entering the loading dose removes the bias of ignoring it, for patients who are not the prior.
//    Reference: the same patient with no loading dose (equal doses), fitted normally. With one level
//    the fit still shrinks toward the prior; that shrinkage is expected and is the same with or
//    without a load. What must go is the extra upward bias from treating the load as maintenance.
{
  const prior = buildPriorParameters(normalizePatient(pt), { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 2 } as never);
  const trough = (truth: { CL: number; V1: number; Q: number; V2: number }, n: number, load: number) => {
    let c = 0;
    const t = (n - 1) * 12 + 11.5;
    for (let k = 0; k < n; k++) c += singleDoseConcentration({ ...truth, dose_mg: k === 0 ? load : 1000, tau: 12, T_inf: 2 }, t - k * 12);
    return Math.round(c * 10) / 10;
  };
  for (const f of [{ CL: 0.7, V1: 1.2 }, { CL: 1.3, V1: 0.85 }, { CL: 1, V1: 1 }]) {
    const truth = { CL: prior.CL * f.CL, V1: prior.V1 * f.V1, Q: prior.Q, V2: prior.V2 };
    const trueAuc = computeExposure({ ...truth, dose_mg: 1000, tau: 12, T_inf: 2 }).auc24;
    for (const n of [2, 3]) {
      const reg = { ...base, doses_given: n };
      const err = (r: R) => r.steady_state_exposure.auc24 / trueAuc - 1;
      const noLoadWorld = err(runExistingRegimenPipeline({ patient: pt, regimen: reg, levels: lv(trough(truth, n, 1000)) }) as R);
      const ignored = err(runExistingRegimenPipeline({ patient: pt, regimen: reg, levels: lv(trough(truth, n, 2500)) }) as R);
      const enteredR = runExistingRegimenPipeline({ patient: pt, regimen: { ...reg, loading_dose_mg: 2500, loading_infusion_duration_hours: 2 }, levels: lv(trough(truth, n, 2500)) }) as R;
      const entered = err(enteredR);
      console.log(`  truth CL×${f.CL} V1×${f.V1}, level after dose ${n}: AUC error — no load given ${(noLoadWorld * 100).toFixed(0)}%, load ignored ${(ignored * 100).toFixed(0)}%, load entered ${(entered * 100).toFixed(0)}%`);
      assert.ok(ignored - noLoadWorld > 0.08, "ignoring a 2,500 mg load should add upward bias");
      assert.ok(Math.abs(entered - noLoadWorld) < 0.06, "entering the load should match the no-load accuracy");
      assert.equal(enteredR.loading_dose.dose_mg, 2500);
    }
  }
  passed++;
}

// 3. Timing: a shorter loading-to-maintenance gap moves the level marker and the curve end.
{
  const r = runExistingRegimenPipeline({ patient: pt, regimen: { ...base, doses_given: 4, loading_dose_mg: 2000, loading_infusion_duration_hours: 2, loading_to_maintenance_hours: 8 }, levels: lv(15) }) as R;
  // Dose 4 starts at 8 + 2·12 = 32 h.
  assert.equal(r.measured_levels[0].time_hours, 32 + 11.5);
  assert.ok(Math.abs(r.curve[r.curve.length - 1].time_hours - 44) < 1e-6);
  assert.equal(r.exposure_horizon, "actual_history");
  passed++;
}

// 4. Steady-state confirmation cannot hide unequal doses: the horizon is actual history.
{
  const r = runExistingRegimenPipeline({ patient: pt, regimen: { ...base, doses_given: 6, steady_state_confirmed: true, loading_dose_mg: 2000, loading_infusion_duration_hours: 2 }, levels: lv(18) }) as R;
  assert.equal(r.exposure_horizon, "actual_history");
  assert.ok(r.actual_history_exposure && r.actual_history_exposure.doses_given === 6);
  passed++;
}

// 5. Validation: refuse what cannot be modelled rather than guess.
{
  const bad = (regimen: R, key: string) => {
    const r = runExistingRegimenPipeline({ patient: pt, regimen: regimen as never, levels: lv(14) }) as R;
    assert.equal(r.ok, false, `expected refusal for ${JSON.stringify(regimen)}`);
    assert.ok(Object.keys(r.field_errors ?? {}).some((k) => k.includes(key)), `expected an error on ${key}: ${JSON.stringify(r.field_errors)}`);
  };
  bad({ ...base, doses_given: 1, loading_dose_mg: 2000, loading_infusion_duration_hours: 2 }, "doses_given");
  bad({ ...base, loading_dose_mg: 2000 }, "loading_infusion_duration_hours");
  bad({ ...base, loading_dose_mg: 0, loading_infusion_duration_hours: 2 }, "loading_dose_mg");
  bad({ ...base, loading_dose_mg: 2000, loading_infusion_duration_hours: 2, loading_to_maintenance_hours: 1.5 }, "loading_to_maintenance_hours");
  bad({ ...base, dose_history: [{ dose_mg: 1000 }] }, "administration_history");
  const top = runExistingRegimenPipeline({ patient: pt, regimen: base, levels: lv(14), loading_dose_mg: 2000 } as never) as R;
  assert.equal(top.ok, false);
  passed++;
}

console.log(`Loading dose: ${passed} passed, 0 failed`);
