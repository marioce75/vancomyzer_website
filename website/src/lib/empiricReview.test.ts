import assert from "node:assert/strict";
import { test } from "node:test";
import { buildClinicalNote } from "../components/calculator/clinicalNote";
import { buildReportData } from "../components/calculator/exportReport";
import { translate, locales } from "../localization/catalog";
import type { CalculateRequestPatient, FrequencyOption } from "../types/calculator";
import { calculateClassicInBrowser } from "./manualStudy/localClassic";
import { manualProjection } from "./manualStudy/manualHistory";
import { generateReportHTML } from "./generateReport";
import { buildPriorParameters } from "./pk/posterior/buildPriorParameters";
import { runExistingRegimenPipeline } from "./pk/runExistingRegimenPipeline";
import { computeInitialRegimen } from "./initialRegimen";
import {
  EMPIRIC_PROFILE_HOLD, EMPIRIC_PROFILE_TITLE, EMPIRIC_PROFILE_MESSAGE, EMPIRIC_PROFILE_ACTION,
  EMPIRIC_PROFILE_LIMIT, EMPIRIC_PROFILE_OPTIONS, EMPIRIC_PROFILE_SCR, EMPIRIC_PROFILE_CL, isEmpiricProfileHold, shouldHoldEmpiricProfile,
} from "./empiricReview";

const synthetic: CalculateRequestPatient = {
  age: 79, weight_kg: 118, height_cm: 160, sex: "", serum_creatinine_mg_dl: 0.31, dialysis_or_rrt: false,
};
const regimen = { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1, doses_given: 1, steady_state_confirmed: false };
const measured = { time_since_last_dose_hours: 8, collection_time: "2030-01-05T22:00:00Z", value_mcg_ml: 18.5 };
const wire = (val: unknown) => JSON.parse(JSON.stringify(val));

test("hold requires all three product criteria; missing height never implies BMI", () => {
  assert.ok(shouldHoldEmpiricProfile(synthetic));
  assert.ok(shouldHoldEmpiricProfile({ ...synthetic, age: 65, weight_kg: 102.4, serum_creatinine_mg_dl: 0.3999 }));
  for (const part of [
    { age: 64.99 }, { weight_kg: 102.39999 }, { serum_creatinine_mg_dl: 0.4 },
    { height_cm: 0 }, { height_cm: undefined }, { height_cm: 16 }, { height_cm: NaN },
  ]) {
    assert.equal(shouldHoldEmpiricProfile({ ...synthetic, ...part }), false);
  }
  assert.equal(isEmpiricProfileHold(computeInitialRegimen({ ...synthetic, height_cm: 0 })), false);
});

test("review returns unaltered Colin clearance and no dose, exposure, curve, loading/pulse or ARC outputs", () => {
  const result = computeInitialRegimen(synthetic);
  const prior = buildPriorParameters(synthetic, { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 });
  assert.equal(result.pk_parameters.CL, prior.CL);
  assert.equal(result.pk_parameters.scr, 0.31);
  assert.equal(result.pk_parameters.pk_model_name, "colin_2019");
  assert.equal(result.pk_parameters.used_posterior_refinement, false);
  assert.equal(result.empiric_dosing_blocked?.reason_code, EMPIRIC_PROFILE_HOLD);
  assert.equal(result.empiric_dosing_blocked?.review_required, true);
  assert.equal(result.empiric_dosing_blocked?.estimated_cl_l_h, prior.CL);
  assert.equal(result.empiric_dosing_blocked?.recommended_pulse_dose_mg, 0);
  assert.deepEqual(result.frequency_options, []);
  assert.deepEqual(result.curve, []);
  assert.equal(result.auc_range_status, undefined);
  assert.equal(result.arc_advisory, undefined);
  assert.deepEqual([result.recommended_dose, result.recommended_interval_hours, result.recommended_infusion_duration_hours,
    result.auc24, result.peak, result.trough], ["", 0, 0, 0, 0, 0]);
  const text = JSON.stringify(result);
  assert.doesNotMatch(text, /recommended_action|loading_dose_curve|required_tdd_mg|continuous_infusion_rate|give a single pulse|\d+ mg every/i);
  assert.match(result.documentation_preview.clinical_note, /no scheduled, loading or pulse dose/i);
});

test("browser classic keeps no-level hold including direct single-dose and preserves measured fit", async () => {
  const expected = wire(computeInitialRegimen(synthetic));
  for (const req of [
    { mode: "initial_regimen" as const, patient: synthetic },
    { mode: "existing_regimen" as const, patient: synthetic, regimen, levels: [] },
    { mode: "existing_regimen" as const, patient: synthetic, regimen: { ...regimen, suggested_dose_not_given: true }, levels: [] },
  ]) {
    const reply = calculateClassicInBrowser(req);
    assert.equal(reply.status, 200);
    assert.deepEqual(await reply.json(), expected);
  }
  const later = calculateClassicInBrowser({ mode: "existing_regimen", patient: synthetic, regimen, levels: [measured] });
  const unchanged = wire(runExistingRegimenPipeline({ patient: { ...synthetic }, regimen, levels: [measured] }));
  assert.equal(later.status, 200);
  assert.deepEqual(await later.json(), unchanged);
  assert.equal(unchanged.pk_parameters.used_posterior_refinement, true);
  assert.equal(await calculateClassicInBrowser({ mode: "existing_regimen", patient: synthetic,
    regimen, levels: [{ ...measured, value_mcg_ml: 0 }] }).status, 400);
});

test("stale selections cannot become a held note or a printable regimen", () => {
  const result = computeInitialRegimen(synthetic);
  const candidate: FrequencyOption = {
    dose_mg: 1999, interval_hours: 12, infusion_duration_hours: 3, auc24: 499, peak: 39, trough: 11,
    is_recommended: true, clinical_note: "STALE: 1999 mg every 12 h",
  };
  const selection = { response: result, regimen, levels: [], activeOption: candidate, activeIsCurrent: false, singleDoseStatus: "single" as const };
  const note = buildClinicalNote(selection);
  assert.match(note.note, /review required/i);
  assert.doesNotMatch(note.note, /STALE|1999/);
  const report = buildReportData({ ...selection, patient: synthetic });
  assert.deepEqual(report.frequency_options, []);
  assert.equal(report.recommended_dose, "");
  assert.equal(report.recommendation_blocked, EMPIRIC_PROFILE_MESSAGE);
  assert.doesNotMatch(generateReportHTML(report), /STALE|1999 mg|Since the suggested loading dose/i);
});

test("ordinary adult and research actual-dose history are unaffected; hold is separate from severe-renal pulse precedent", () => {
  const ordinary = computeInitialRegimen({ ...synthetic, age: 58, weight_kg: 84, height_cm: 0, serum_creatinine_mg_dl: 0.9 });
  assert.deepEqual([ordinary.recommended_dose, ordinary.auc24, ordinary.peak, ordinary.trough, ordinary.curve.length],
    ["1750 mg", 524.7, 39.9, 12.7, 491]);
  const severe = computeInitialRegimen({ ...synthetic, age: 85, weight_kg: 79, serum_creatinine_mg_dl: 4.53, sex:"female" } as CalculateRequestPatient);
  assert.equal(isEmpiricProfileHold(severe), false);
  const start_ms = Date.UTC(2030,0,5,14);
  const drawMs = Date.UTC(2030,0,6,1,30);
  const research = manualProjection({ patient: synthetic, rrt: false, rows: [{ start_ms, dose_mg: 1500, infusion_minutes: 90 }],
    drawMs, complete: true, basis: regimen, fitLevels: [], minutePrecision: true });
  assert.equal(research.ok, true);
  if (research.ok) assert.equal(research.drawHour, 11.5);
});

test("all supported locales translate the review and missing-height notice", () => {
  for (const locale of locales.filter(x => x !== "en")) {
    for (const text of [EMPIRIC_PROFILE_TITLE, EMPIRIC_PROFILE_MESSAGE, EMPIRIC_PROFILE_ACTION, EMPIRIC_PROFILE_LIMIT,
      EMPIRIC_PROFILE_OPTIONS, EMPIRIC_PROFILE_SCR, EMPIRIC_PROFILE_CL,
      "Height is missing, so the BMI-based empiric review check could not run. Enter a measured height if available."]) {
      assert.notEqual(translate(text, locale), text, locale + " " + text);
    }
  }
});
