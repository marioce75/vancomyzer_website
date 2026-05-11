/**
 * Integration tests for existing_regimen path.
 * Run with: npx tsx src/lib/pk/__tests__/existingRegimen.integration.test.ts
 */

import { runExistingRegimenPipeline } from "../runExistingRegimenPipeline";

const defaultPatient = {
  age: 55,
  weight_kg: 70,
  serum_creatinine_mg_dl: 1.0,
};

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function testCase1(): void {
  const result = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 }, levels: [{ value_mcg_ml: 18, collection_time: "", time_since_last_dose_hours: 2 }] });
  assert(!("ok" in result && result.ok === false), "Case 1: expected success");
  const r = result as { auc24: number; peak: number; trough: number; curve: { time_hours: number; concentration: number }[] };
  assert(r.auc24 > 0 && r.peak > 0 && r.trough > 0, "Case 1: positive exposure");
  assert(Array.isArray(r.curve) && r.curve.length > 0, "Case 1: curve present");
}

function testCase2(): void {
  const result = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 750, interval_hours: 12, infusion_duration_hours: 1 }, levels: [{ value_mcg_ml: 12, collection_time: "", time_since_last_dose_hours: 3 }] });
  assert(!("ok" in result && result.ok === false), "Case 2: expected success");
  const r = result as { auc24: number; peak: number; trough: number };
  assert(r.auc24 > 0 && r.peak > 0 && r.trough > 0, "Case 2: positive exposure");
}

function testCase3(): void {
  const result = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 }, levels: [{ value_mcg_ml: 5, collection_time: "", time_since_last_dose_hours: 10 }] });
  assert("ok" in result && result.ok === false, "Case 3: expected validation error");
}

function testCase4(): void {
  const priorLike = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 }, levels: [{ value_mcg_ml: 8, collection_time: "", time_since_last_dose_hours: 2 }] });
  const highLevel = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 }, levels: [{ value_mcg_ml: 22, collection_time: "", time_since_last_dose_hours: 2 }] });
  assert(!("ok" in priorLike && priorLike.ok === false), "Case 4a: expected success");
  assert(!("ok" in highLevel && highLevel.ok === false), "Case 4b: expected success");
  const a = priorLike as { interpretation_summary: string; assumptions: string[]; limitations: string[]; documentation_preview: { clinical_note: string; quick_summary: string }; auc24: number; peak: number };
  const b = highLevel as { interpretation_summary: string; assumptions: string[]; limitations: string[]; documentation_preview: { clinical_note: string; quick_summary: string }; auc24: number; peak: number };
  assert(a.assumptions.some((item) => item.includes("fit quality")), "Case 4a: fit quality should be explicit");
  assert(a.documentation_preview.clinical_note.includes("Posterior fit quality"), "Case 4a: documentation should include posterior fit quality");
  assert(a.limitations.some((item) => item.includes("uncertainty") || item.includes("overinterpreted")), "Case 4a: limitations should warn about sparse-fit certainty");
  assert((a as unknown as { calculation_details?: { method: string; evidence_strength: string; data_quality_summary: string; key_inputs: string[]; caution_flags: string[] } }).calculation_details?.method.includes("Adult prior model") === true, "Case 4a: calculation details should expose method provenance");
  assert(((a as unknown as { calculation_details?: { evidence_strength: string } }).calculation_details?.evidence_strength ?? "").length > 0, "Case 4a: calculation details should expose evidence strength");
  assert(((a as unknown as { calculation_details?: { evidence_strength: string } }).calculation_details?.evidence_strength ?? "").includes("single level") || ((a as unknown as { calculation_details?: { evidence_strength: string } }).calculation_details?.evidence_strength ?? "").includes("high uncertainty"), "Case 4a: evidence strength should remain informative enough for UI labeling");
  assert(((a as unknown as { calculation_details?: { data_quality_summary: string } }).calculation_details?.data_quality_summary ?? "").includes("workflow fit") || ((a as unknown as { calculation_details?: { data_quality_summary: string } }).calculation_details?.data_quality_summary ?? "").includes("Sparse"), "Case 4a: calculation details should expose workflow-fit/data-quality summary");
  assert((((a as unknown as { calculation_details?: { review_status?: { level: string; workflow_fit: string; next_actions: string[] } } }).calculation_details?.review_status?.level) ?? "") === "caution", "Case 4a: review status should classify sparse/high-uncertainty fit as caution");
  assert((((a as unknown as { calculation_details?: { review_status?: { level: string; workflow_fit: string; next_actions: string[] } } }).calculation_details?.review_status?.workflow_fit) ?? "") === "single_level", "Case 4a: review status should classify sparse fit as single_level");
  assert((((a as unknown as { calculation_details?: { review_status?: { next_actions: string[] } } }).calculation_details?.review_status?.next_actions) ?? []).length > 0, "Case 4a: review status should expose next actions for UI trust surfaces");
  assert(((a as unknown as { calculation_details?: { caution_flags: string[] } }).calculation_details?.caution_flags ?? []).length > 0, "Case 4a: calculation details should expose caution flags");
  assert(Math.abs(b.peak - a.peak) > 1 || Math.abs(b.auc24 - a.auc24) > 20, "Case 4: posterior fit should respond materially to different observed concentrations");
}

function testCase5(): void {
  const result = runExistingRegimenPipeline({ patient: { ...defaultPatient, serum_creatinine_mg_dl: 0.6 }, regimen: { dose_mg: 1500, interval_hours: 8, infusion_duration_hours: 1 }, levels: [{ value_mcg_ml: 8, collection_time: "", time_since_last_dose_hours: 6 }] });
  assert(!("ok" in result && result.ok === false), "Case 5: expected success");
  const r = result as { recommended_dose: string; recommended_interval_hours: number };
  const doseMg = parseInt(r.recommended_dose.replace(/\D/g, ""), 10) || 0;
  const tdd = (doseMg * 24) / r.recommended_interval_hours;
  assert(tdd <= 4500, "Case 5: TDD must not exceed 4500 mg/day");
}

function testCase6(): void {
  const interval_hours = 8;
  const result = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours, infusion_duration_hours: 1 }, levels: [{ value_mcg_ml: 15, collection_time: "", time_since_last_dose_hours: 4 }] });
  assert(!("ok" in result && result.ok === false), "Case 6: expected success");
  const r = result as { auc24: number; curve: { time_hours: number; concentration: number }[] };

  // Steady-state periodicity: consecutive dosing intervals should match
  // closely once the patient has accumulated for ≥5 half-lives. The curve
  // starts at dose #1 (zero drug onboard) and accumulates — t=0 vs t=τ
  // are the WORST place to check periodicity. Compare two adjacent
  // intervals near the END of the curve, where steady state holds.
  const lastT = r.curve[r.curve.length - 1].time_hours;
  const targetEarly = lastT - interval_hours * 2;
  const targetLate = lastT - interval_hours;
  const pointEarly = r.curve.find((p) => Math.abs(p.time_hours - targetEarly) < 0.6);
  const pointLate = r.curve.find((p) => Math.abs(p.time_hours - targetLate) < 0.6);
  assert(pointEarly != null && pointLate != null, "Case 6: late-curve sample points present");
  assert(
    Math.abs(pointEarly!.concentration - pointLate!.concentration) < 1,
    "Case 6: curve roughly periodic at steady state",
  );
}

function testCase7(): void {
  const result = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 }, levels: [
    { value_mcg_ml: 18, collection_time: "2026-03-15T08:00:00Z", time_since_last_dose_hours: 2 },
    { value_mcg_ml: 14, collection_time: "2026-03-15T10:00:00Z", time_since_last_dose_hours: 5 },
  ] });
  assert("ok" in result && result.ok === false, "Case 7: expected validation error");
}

function testCase8(): void {
  // Chronology validator deliberately tolerates ≤30-min drift between the
  // reported time_since_last_dose and what collection timestamps imply —
  // real-world dose administration drifts ~30 min routinely (nurse rounds,
  // hand-offs). Confirm the engine accepts this kind of small drift so we
  // don't regress into reporting false positives on every clinical case.
  //
  // Inputs encode a 30-min drift: t1=08:00 (2 h post-dose → dose at 06:00),
  // t2=18:30 (4 h post-dose → dose at 14:30). Predicted dose at 06:00+τ=14:00.
  // Drift = 14:30 − 14:00 = 0.5 h, within the 0.75 h tolerance.
  // Case 16 covers the rejection branch with a clearly-irregular drift.
  const result = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 }, levels: [
    { value_mcg_ml: 18, collection_time: "2026-03-15T08:00:00Z", time_since_last_dose_hours: 2 },
    { value_mcg_ml: 10, collection_time: "2026-03-15T18:30:00Z", time_since_last_dose_hours: 4 },
  ] });
  assert(!("ok" in result && result.ok === false), "Case 8: 30-min drift in reported dose timing should be tolerated (clinical-reality concession)");
}

function testCase9(): void {
  const lean = runExistingRegimenPipeline({ patient: { age: 60, weight_kg: 78, serum_creatinine_mg_dl: 1.2 }, regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 }, levels: [{ value_mcg_ml: 15, collection_time: "", time_since_last_dose_hours: 4 }] });
  const obese = runExistingRegimenPipeline({ patient: { age: 60, weight_kg: 130, serum_creatinine_mg_dl: 1.2 }, regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 }, levels: [{ value_mcg_ml: 15, collection_time: "", time_since_last_dose_hours: 4 }] });
  assert(!("ok" in lean && lean.ok === false), "Case 9a: expected success");
  assert(!("ok" in obese && obese.ok === false), "Case 9b: expected success");
  const a = lean as { auc24: number };
  const b = obese as { auc24: number };
  assert(Math.abs(a.auc24 - b.auc24) > 1, "Case 9: SCr-based Colin 2019 model should produce different output when weight differs materially.");
}

function testCase10(): void {
  const result = runExistingRegimenPipeline({ patient: { age: 40, weight_kg: 80, serum_creatinine_mg_dl: 0.8 }, regimen: { dose_mg: 2000, interval_hours: 12, infusion_duration_hours: 2 }, levels: [{ value_mcg_ml: 35, collection_time: "", time_since_last_dose_hours: 11 }] });
  assert(!("ok" in result && result.ok === false), "Case 10: expected success");
  const r = result as { recommended_dose: string; recommended_interval_hours: number };
  assert([6, 8, 12, 18, 24, 36, 48].includes(r.recommended_interval_hours), "Case 10: recommendation should stay within bounded expanded interval set");
}

function testCase11(): void {
  const duringInfusion = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 2 }, levels: [{ value_mcg_ml: 25, collection_time: "", time_since_last_dose_hours: 1 }] });
  assert("ok" in duringInfusion && duringInfusion.ok === false, "Case 11a: expected validation error for level during infusion");
  const tooCloseAfterInfusion = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 2 }, levels: [{ value_mcg_ml: 25, collection_time: "", time_since_last_dose_hours: 2.25 }] });
  assert("ok" in tooCloseAfterInfusion && tooCloseAfterInfusion.ok === false, "Case 11b: expected validation error for level too near infusion completion");
}

function testCase12(): void {
  const nearContinuous = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 10 }, levels: [{ value_mcg_ml: 18, collection_time: "", time_since_last_dose_hours: 11 }] });
  assert("ok" in nearContinuous && nearContinuous.ok === false, "Case 12: expected validation error for near-continuous infusion semantics");
}

function testCase13(): void {
  const sparseWeakFit = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 }, levels: [{ value_mcg_ml: 8, collection_time: "", time_since_last_dose_hours: 2 }] });
  assert(!("ok" in sparseWeakFit && sparseWeakFit.ok === false), "Case 13: expected success");
  const r = sparseWeakFit as { recommended_interval_hours: number; interpretation_summary: string };
  assert(r.recommended_interval_hours === 8, "Case 13: weak/high-uncertainty single-level fit should keep interval conservative");
  assert(r.interpretation_summary.includes("Recommendation kept conservative"), "Case 13: interpretation should describe conservative recommendation behavior");
}

function testCase14(): void {
  const zeroLevel = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 }, levels: [{ value_mcg_ml: 0, collection_time: "", time_since_last_dose_hours: 6 }] });
  assert("ok" in zeroLevel && zeroLevel.ok === false, "Case 14: zero measured level should be rejected");
}

function testCase15(): void {
  const missingCollectionTime = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 }, levels: [
    { value_mcg_ml: 18, collection_time: "2026-03-15T08:00:00Z", time_since_last_dose_hours: 2 },
    { value_mcg_ml: 14, collection_time: "", time_since_last_dose_hours: 4 },
  ] });
  assert("ok" in missingCollectionTime && missingCollectionTime.ok === false, "Case 15: multi-level case without explicit collection times should be rejected");
}

function testCase16(): void {
  // 1.5 h drift between reported time_since_last_dose and what collection
  // timestamps imply — well outside the 0.75 h tolerance. Engine must
  // reject AND surface irregular-timing recovery guidance with the
  // initial_regimen fallback. (Case 8 covers the in-tolerance path.)
  //
  // t1=08:00 (2 h post → dose at 06:00). t2=19:30 (4 h post → dose at 15:30).
  // Predicted dose at 06:00 + τ=8 h = 14:00. Drift = 15:30 − 14:00 = 1.5 h.
  const irregularTiming = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 }, levels: [
    { value_mcg_ml: 18, collection_time: "2026-03-15T08:00:00Z", time_since_last_dose_hours: 2 },
    { value_mcg_ml: 10, collection_time: "2026-03-15T19:30:00Z", time_since_last_dose_hours: 4 },
  ] });
  assert("ok" in irregularTiming && irregularTiming.ok === false, "Case 16: irregular cross-interval timing should be rejected");
  const err = irregularTiming as { recovery_guidance?: string[]; fallback_workflow?: string };
  assert(Boolean(err.recovery_guidance?.some((item) => item.includes("irregular") || item.includes("steady-state interpretation"))), "Case 16: recovery guidance should explain irregular/non-steady-state path");
  assert(err.fallback_workflow === "initial_regimen", "Case 16: irregular timing should point toward initial-regimen fallback");
}

function testCase17(): void {
  const nearContinuousBoundary = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 9.6 }, levels: [{ value_mcg_ml: 12, collection_time: "", time_since_last_dose_hours: 10 }] });
  assert("ok" in nearContinuousBoundary && nearContinuousBoundary.ok === false, "Case 17: infusion duration at 0.8 × interval should be rejected");
}

function testCase18(): void {
  const nearContinuousJustBelow = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 9.5 }, levels: [{ value_mcg_ml: 12, collection_time: "", time_since_last_dose_hours: 10.1 }] });
  assert(!("ok" in nearContinuousJustBelow && nearContinuousJustBelow.ok === false), "Case 18: infusion duration just below 0.8 × interval should remain in scope");
}

function testCase19(): void {
  const exactPostInfusionBoundary = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 }, levels: [{ value_mcg_ml: 12, collection_time: "", time_since_last_dose_hours: 1.5 }] });
  assert(!("ok" in exactPostInfusionBoundary && exactPostInfusionBoundary.ok === false), "Case 19: level exactly 0.5 h after infusion completion should be accepted by the current boundary rule");
}

function testCase20(): void {
  const highExposureSparse = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1500, interval_hours: 8, infusion_duration_hours: 1 }, levels: [{ value_mcg_ml: 32, collection_time: "", time_since_last_dose_hours: 7 }] });
  assert(!("ok" in highExposureSparse && highExposureSparse.ok === false), "Case 20: expected success");
  const r = highExposureSparse as { recommended_interval_hours: number; recommended_dose: string; interpretation_summary: string; documentation_preview: { quick_summary: string; clinical_note: string } };
  assert(r.recommended_interval_hours > 8, "Case 20: clearly supra-therapeutic sparse single-level case should allow bounded interval extension");
  assert(r.interpretation_summary.includes("permits interval extension"), "Case 20: interpretation should explain bounded interval-extension behavior");
  assert(r.documentation_preview.quick_summary.includes("interval extension") || r.documentation_preview.clinical_note.includes("interval extension"), "Case 20: documentation preview should preserve interval-extension rationale");
}

/**
 * Case 21 — Cross-midnight regression test (patient safety)
 *
 * Scenario: dose given at 10:49 on day N (infusion ends 11:49), level drawn at
 * 04:11 on day N+1. The UI computes time_since_last_dose_hours relative to the
 * most-recent dose on the q12h schedule (22:49 on day N), yielding ~5.37 h post-dose.
 * This must NOT be flagged as "drawn during infusion" or "too timing-sensitive".
 *
 * The backend pipeline receives the already-computed time value from the UI, so
 * this test validates that the validation layer passes for a well-formed post-infusion
 * cross-midnight level and that the Bayesian posterior engine proceeds normally.
 */
function testCase21(): void {
  // 5.37 h = time from the most-recent q12 dose (22:49 day N) to level at 04:11 day N+1.
  // Infusion duration 1 h → infusion ends at 23:49 day N → level is 5.37 h post-infusion. ✓
  const crossMidnightQ12 = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 },
    levels: [{ value_mcg_ml: 14, collection_time: "", time_since_last_dose_hours: 5.37 }],
  });
  assert(
    !("ok" in crossMidnightQ12 && crossMidnightQ12.ok === false),
    "Case 21a: cross-midnight level (5.37 h post-dose on q12h) must not be rejected as during-infusion"
  );
  const r21a = crossMidnightQ12 as { auc24: number; peak: number; trough: number };
  assert(r21a.auc24 > 0, "Case 21a: AUC24 must be positive for cross-midnight level");

  // q8h variant: most-recent dose 02:49 day N+1, level 04:11 day N+1 → 1.37 h post-dose.
  // Infusion ends at 03:49 → level is 0.37 h after infusion completion.
  // 0.37 h < MIN_POST_INFUSION_LEVEL_HOURS (0.5 h) → correctly rejected as too timing-sensitive.
  const crossMidnightQ8TooClose = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 },
    levels: [{ value_mcg_ml: 14, collection_time: "", time_since_last_dose_hours: 1.37 }],
  });
  assert(
    "ok" in crossMidnightQ8TooClose && crossMidnightQ8TooClose.ok === false,
    "Case 21b: level 1.37 h post-dose with 1 h infusion must be rejected as too close to infusion completion (0.37 h after end, within 0.5 h grace)"
  );

  // q8h variant with level drawn 2.1 h post-dose (1.1 h after infusion end) — must succeed.
  const crossMidnightQ8PostInfusion = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 },
    levels: [{ value_mcg_ml: 14, collection_time: "", time_since_last_dose_hours: 2.1 }],
  });
  assert(
    !("ok" in crossMidnightQ8PostInfusion && crossMidnightQ8PostInfusion.ok === false),
    "Case 21c: level 2.1 h post-dose on q8h (1.1 h after infusion end) must not be rejected"
  );
  const r21c = crossMidnightQ8PostInfusion as { auc24: number };
  assert(r21c.auc24 > 0, "Case 21c: AUC24 must be positive");
}

function testCase22(): void {
  // Pulse dose / single-dose Bayesian workflow (doses_given = 1).
  // Infusion = 1 h, so post-distributive threshold = 1 + 2 = 3 h post-dose.
  // Planned interval q12h.

  // 22a: Valid pulse dose level at 4 h post-dose (3 h post-infusion end) — must succeed.
  const pulseDoseValid = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1500, interval_hours: 12, infusion_duration_hours: 1, doses_given: 1 },
    levels: [{ value_mcg_ml: 16, collection_time: "", time_since_last_dose_hours: 4 }],
  });
  assert(
    !("ok" in pulseDoseValid && pulseDoseValid.ok === false),
    "Case 22a: pulse dose level at 4 h post-dose (3 h post-infusion) must not be rejected"
  );
  const r22a = pulseDoseValid as { auc24: number; peak: number; assumptions: string[]; limitations: string[] };
  assert(r22a.auc24 > 0, "Case 22a: AUC24 must be positive for pulse dose");
  assert(r22a.peak > 0, "Case 22a: peak must be positive for pulse dose");
  assert(
    r22a.assumptions.some((a) => a.toLowerCase().includes("pre-steady-state") || a.toLowerCase().includes("pulse")),
    "Case 22a: assumptions must include pulse-dose / pre-steady-state language"
  );
  assert(
    r22a.limitations.some((l) => l.toLowerCase().includes("pre-steady-state") || l.toLowerCase().includes("pulse")),
    "Case 22a: limitations must include pulse-dose / pre-steady-state label"
  );

  // 22b: Pulse dose level during infusion (0.5 h post-dose, infusion = 1 h) — must be rejected.
  const pulseDoseDuringInfusion = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1500, interval_hours: 12, infusion_duration_hours: 1, doses_given: 1 },
    levels: [{ value_mcg_ml: 35, collection_time: "", time_since_last_dose_hours: 0.5 }],
  });
  assert(
    "ok" in pulseDoseDuringInfusion && pulseDoseDuringInfusion.ok === false,
    "Case 22b: pulse dose level during infusion must be rejected"
  );

  // 22c: Pulse dose level at 2.5 h post-dose (1.5 h post-infusion end — < 2 h threshold) — must be rejected.
  const pulseDoseTooClose = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1500, interval_hours: 12, infusion_duration_hours: 1, doses_given: 1 },
    levels: [{ value_mcg_ml: 28, collection_time: "", time_since_last_dose_hours: 2.5 }],
  });
  assert(
    "ok" in pulseDoseTooClose && pulseDoseTooClose.ok === false,
    "Case 22c: pulse dose level at 2.5 h (1.5 h post-infusion end, < 2 h ASHP threshold) must be rejected"
  );

  // 22d: Pulse dose level at 3.5 h post-dose (2.5 h post-infusion end — ≥ 2 h threshold) — must succeed.
  const pulseDosePostDistributive = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1500, interval_hours: 12, infusion_duration_hours: 1, doses_given: 1 },
    levels: [{ value_mcg_ml: 20, collection_time: "", time_since_last_dose_hours: 3.5 }],
  });
  assert(
    !("ok" in pulseDosePostDistributive && pulseDosePostDistributive.ok === false),
    "Case 22d: pulse dose level at 3.5 h (2.5 h post-infusion end) must not be rejected"
  );
  const r22d = pulseDosePostDistributive as { auc24: number };
  assert(r22d.auc24 > 0, "Case 22d: AUC24 must be positive");

  // 22e: Pulse dose level at 20 h post-dose (beyond q12h interval) — must succeed because
  // interval_hours constraint is skipped for single-dose workflow.
  const pulseDoseLateLevel = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1500, interval_hours: 12, infusion_duration_hours: 1, doses_given: 1 },
    levels: [{ value_mcg_ml: 4, collection_time: "", time_since_last_dose_hours: 20 }],
  });
  assert(
    !("ok" in pulseDoseLateLevel && pulseDoseLateLevel.ok === false),
    "Case 22e: pulse dose level at 20 h (beyond q12h interval) must not be rejected — interval check skipped for single-dose"
  );
  const r22e = pulseDoseLateLevel as { auc24: number };
  assert(r22e.auc24 > 0, "Case 22e: AUC24 must be positive for late pulse dose level");
}

function testCase23(): void {
  // Late lab draw — clinical reality. Tolerance = min(1h, 25% × interval).
  // For non-SS (doses_given < 5), no rejection regardless of overshoot —
  // multi-dose accumulation math handles arbitrary draw times.
  // For SS (doses_given ≥ 5), within tolerance accept + warning; beyond reject.

  // 23a: Mario's exact case — q12h, doses_given=2, level drawn 12 min late
  // (time_since=12.2). Must succeed and surface a timing_warning.
  const marioCase = runExistingRegimenPipeline({
    patient: { age: 69, weight_kg: 78.18, serum_creatinine_mg_dl: 2.62 },
    regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1, doses_given: 2 },
    levels: [{ value_mcg_ml: 8.2, collection_time: "", time_since_last_dose_hours: 12.2 }],
  });
  assert(
    !("ok" in marioCase && marioCase.ok === false),
    "Case 23a: 12-min late trough on q12h non-SS workflow must produce a recommendation",
  );
  const r23a = marioCase as { auc24: number; trough: number; timing_warnings?: string[] };
  assert(r23a.auc24 > 0 && r23a.trough > 0, "Case 23a: must produce positive exposure metrics");
  assert(
    Array.isArray(r23a.timing_warnings) && r23a.timing_warnings.length > 0,
    "Case 23a: timing_warnings must be present for the late draw",
  );
  assert(
    r23a.timing_warnings![0].toLowerCase().includes("late trough"),
    "Case 23a: warning text must explain the late-trough interpretation",
  );

  // 23b: SS path within tolerance — q12h, doses_given=6, draw at 12.5h.
  // Tolerance = min(1, 0.25×12) = 1h. Overshoot 0.5h ≤ 1h → accept + warn.
  const ssWithinTolerance = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1, doses_given: 6 },
    levels: [{ value_mcg_ml: 12, collection_time: "", time_since_last_dose_hours: 12.5 }],
  });
  assert(
    !("ok" in ssWithinTolerance && ssWithinTolerance.ok === false),
    "Case 23b: SS late draw within tolerance (0.5h overshoot, 1h tolerance) must succeed",
  );
  const r23b = ssWithinTolerance as { timing_warnings?: string[] };
  assert(
    Array.isArray(r23b.timing_warnings) && r23b.timing_warnings.length > 0,
    "Case 23b: SS within-tolerance late draw must surface a timing_warning",
  );

  // 23c: SS path beyond tolerance — q12h, doses_given=6, draw at 13.5h.
  // Overshoot 1.5h > 1h tolerance → must reject.
  const ssBeyondTolerance = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1, doses_given: 6 },
    levels: [{ value_mcg_ml: 12, collection_time: "", time_since_last_dose_hours: 13.5 }],
  });
  assert(
    "ok" in ssBeyondTolerance && ssBeyondTolerance.ok === false,
    "Case 23c: SS late draw beyond tolerance (1.5h overshoot > 1h tolerance) must reject",
  );

  // 23d: SS short interval — q4h, doses_given=6, draw at 4.9h.
  // Tolerance = min(1, 0.25×4) = 1h. Overshoot 0.9h ≤ 1h → accept.
  const ssShortInterval = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 500, interval_hours: 4, infusion_duration_hours: 1, doses_given: 6 },
    levels: [{ value_mcg_ml: 18, collection_time: "", time_since_last_dose_hours: 4.9 }],
  });
  assert(
    !("ok" in ssShortInterval && ssShortInterval.ok === false),
    "Case 23d: SS q4h with 0.9h overshoot must succeed (1h cap, 25%×4=1h)",
  );

  // 23e: Non-SS extreme overshoot — q12h, doses_given=2, draw at 24h.
  // Must succeed (non-SS path never rejects) AND surface the stronger advisory.
  const nonSsExtreme = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1, doses_given: 2 },
    levels: [{ value_mcg_ml: 4, collection_time: "", time_since_last_dose_hours: 24 }],
  });
  assert(
    !("ok" in nonSsExtreme && nonSsExtreme.ok === false),
    "Case 23e: non-SS extreme overshoot (12h past interval) must not reject",
  );
  const r23e = nonSsExtreme as { timing_warnings?: string[] };
  assert(
    Array.isArray(r23e.timing_warnings)
      && r23e.timing_warnings.some((w) => w.toLowerCase().includes("posterior fit will rely heavily on the population prior")),
    "Case 23e: extreme overshoot must surface the stronger 'relies on prior' advisory",
  );

  // 23f: Regression — Case 3's scenario stays rejected. SS, q8h, draw at 10h
  // (overshoot 2h, tolerance min(1, 0.25×8)=1h → reject). Doses_given undefined
  // defaults to SS path.
  const regressionRejection = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 },
    levels: [{ value_mcg_ml: 5, collection_time: "", time_since_last_dose_hours: 10 }],
  });
  assert(
    "ok" in regressionRejection && regressionRejection.ok === false,
    "Case 23f: SS overshoot beyond tolerance (2h > 1h) must still reject (regression of Case 3)",
  );
}

function testCase24(): void {
  // Real-patient regression. 34F, 62.1 kg, SCr 2.61 (compromised renal),
  // 500 mg single dose, 1 h infusion. Level drawn 16.12 h post-dose came
  // back at 17.7 mcg/mL — substantially above what the population prior
  // alone would predict (~5–7 mcg/mL).
  //
  // The point of THIS regression is to lock in math consistency, not to
  // demand a perfect fit. With strict MAP + informative population priors
  // (Colin 2019 IIV 25% on V1, 50% on V2), a single outlier observation
  // CANNOT be matched exactly — the prior penalty for forcing Vss down to
  // ~22 L (what the data alone implies) outweighs the residual. The MAP
  // partial shift is the correct, safe behavior.
  //
  // Hard requirements:
  //   (a) the fitter's predicted concentration at the level time and the
  //       PLOTTED curve at the same time must AGREE within ±5%. They were
  //       using different math models (SS vs single-dose multi-schedule)
  //       prior to the effectiveTau fix; both must now use single-dose
  //       math for pulse-dose cases.
  //   (b) when residual exceeds 25%, fit_quality_warnings must surface so
  //       the clinician is told the prior dominates and an additional
  //       confirmatory level is needed.
  const result = runExistingRegimenPipeline({
    patient: { age: 34, weight_kg: 62.1, serum_creatinine_mg_dl: 2.61 },
    regimen: { dose_mg: 500, interval_hours: 24, infusion_duration_hours: 1, doses_given: 1 },
    levels: [{ value_mcg_ml: 17.7, collection_time: "", time_since_last_dose_hours: 16.12 }],
  });
  assert(
    !("ok" in result && result.ok === false),
    "Case 24: real-patient single-level pulse dose must succeed",
  );
  const r = result as {
    pk_parameters: { CL: number; V1: number };
    curve: { time_hours: number; concentration: number }[];
    fit_diagnostic?: { posterior_predicted_at_levels?: { observed: number; predicted: number; relative_error: number }[]; max_relative_error?: number };
    fit_quality_warnings?: string[];
  };
  assert(
    Array.isArray(r.fit_diagnostic?.posterior_predicted_at_levels)
      && r.fit_diagnostic!.posterior_predicted_at_levels!.length === 1,
    "Case 24: per-level posterior predictions must be exposed for diagnostic logging",
  );
  const obsRow = r.fit_diagnostic!.posterior_predicted_at_levels![0];

  // (a) Fitter ↔ plotter math consistency at the level time
  const t = 16.12;
  const lower = [...r.curve].filter((p) => p.time_hours <= t).sort((a, b) => b.time_hours - a.time_hours)[0];
  const upper = [...r.curve].filter((p) => p.time_hours >= t).sort((a, b) => a.time_hours - b.time_hours)[0];
  assert(lower != null && upper != null, "Case 24a: curve must contain points bracketing t=16.12h");
  const span = upper.time_hours - lower.time_hours;
  const interpolatedCurve = span > 0
    ? lower.concentration + (upper.concentration - lower.concentration) * (t - lower.time_hours) / span
    : lower.concentration;
  const consistencyDelta = Math.abs(interpolatedCurve - obsRow.predicted) / Math.max(obsRow.predicted, 1e-3);
  assert(
    consistencyDelta <= 0.05,
    `Case 24a: fitter (${obsRow.predicted.toFixed(2)}) and plotter (${interpolatedCurve.toFixed(2)}) must use the same math model — disagreement ${(consistencyDelta * 100).toFixed(0)}%, must be ≤ 5%.`,
  );

  // (b) When residual > 25%, the advisory must fire so the clinician knows
  //     the prior dominated and a confirmatory level is recommended.
  const fitterErr = Math.abs(obsRow.predicted - obsRow.observed) / obsRow.observed;
  if (fitterErr > 0.25) {
    assert(
      Array.isArray(r.fit_quality_warnings) && r.fit_quality_warnings.length > 0,
      `Case 24b: residual was ${(fitterErr * 100).toFixed(0)}% but fit_quality_warnings did not fire — the safety advisory must surface whenever the prior dominated.`,
    );
  }
}

export function runExistingRegimenTests(): void {
  testCase1();
  testCase2();
  testCase3();
  testCase4();
  testCase5();
  testCase6();
  testCase7();
  testCase8();
  testCase9();
  testCase10();
  testCase11();
  testCase12();
  testCase13();
  testCase14();
  testCase15();
  testCase16();
  testCase17();
  testCase18();
  testCase19();
  testCase20();
  testCase21();
  testCase22();
  testCase23();
  testCase24();
}

if (typeof process !== "undefined" && process.argv[1]?.includes("existingRegimen.integration.test")) {
  runExistingRegimenTests();
  console.log("All 24 existing_regimen integration tests passed, including posterior fit-quality/uncertainty, recommendation-search, infusion-timing, near-continuous-infusion boundary behavior, conservative sparse-fit recommendation checks, positive-level validation, required multi-level collection-time semantics, recovery-path guidance for irregular timing, exact post-infusion boundary behavior, bounded interval extension for clearly supra-therapeutic sparse single-level cases, cross-midnight level timing validation, pulse-dose single-dose Bayesian workflow, and late-lab-draw tolerance with non-SS multi-dose accumulation.");
}
