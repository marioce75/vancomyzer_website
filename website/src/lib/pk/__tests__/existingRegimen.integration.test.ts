/**
 * Integration tests for existing_regimen path.
 * Run with: npx tsx src/lib/pk/__tests__/existingRegimen.integration.test.ts
 */

import { runExistingRegimenPipeline } from "../runExistingRegimenPipeline";

const defaultPatient = {
  age: 55,
  sex: "male",
  height_cm: 170,
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
  const tau = interval_hours;
  const at0 = r.curve[0].concentration;
  const atTauPoint = r.curve.find((p) => Math.abs(p.time_hours - tau) < 0.6);
  assert(atTauPoint != null, "Case 6: curve point at tau");
  assert(Math.abs(at0 - atTauPoint!.concentration) < 2, "Case 6: curve roughly periodic");
}

function testCase7(): void {
  const result = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 }, levels: [
    { value_mcg_ml: 18, collection_time: "2026-03-15T08:00:00Z", time_since_last_dose_hours: 2 },
    { value_mcg_ml: 14, collection_time: "2026-03-15T10:00:00Z", time_since_last_dose_hours: 5 },
  ] });
  assert("ok" in result && result.ok === false, "Case 7: expected validation error");
}

function testCase8(): void {
  const result = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 }, levels: [
    { value_mcg_ml: 18, collection_time: "2026-03-15T08:00:00Z", time_since_last_dose_hours: 2 },
    { value_mcg_ml: 10, collection_time: "2026-03-15T18:30:00Z", time_since_last_dose_hours: 4 },
  ] });
  assert("ok" in result && result.ok === false, "Case 8: expected validation error");
}

function testCase9(): void {
  const lean = runExistingRegimenPipeline({ patient: { age: 60, sex: "male", height_cm: 175, weight_kg: 78, serum_creatinine_mg_dl: 1.2 }, regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 }, levels: [{ value_mcg_ml: 15, collection_time: "", time_since_last_dose_hours: 4 }] });
  const obese = runExistingRegimenPipeline({ patient: { age: 60, sex: "male", height_cm: 175, weight_kg: 130, serum_creatinine_mg_dl: 1.2 }, regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 }, levels: [{ value_mcg_ml: 15, collection_time: "", time_since_last_dose_hours: 4 }] });
  assert(!("ok" in lean && lean.ok === false), "Case 9a: expected success");
  assert(!("ok" in obese && obese.ok === false), "Case 9b: expected success");
  const a = lean as { auc24: number };
  const b = obese as { auc24: number };
  assert(Math.abs(a.auc24 - b.auc24) > 1, "Case 9: obesity-aware Cockcroft-Gault should change output when body habitus differs materially.");
}

function testCase10(): void {
  const result = runExistingRegimenPipeline({ patient: { age: 40, sex: "male", height_cm: 180, weight_kg: 80, serum_creatinine_mg_dl: 0.8 }, regimen: { dose_mg: 2000, interval_hours: 12, infusion_duration_hours: 2 }, levels: [{ value_mcg_ml: 35, collection_time: "", time_since_last_dose_hours: 11 }] });
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
  const irregularTiming = runExistingRegimenPipeline({ patient: defaultPatient, regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 }, levels: [
    { value_mcg_ml: 18, collection_time: "2026-03-15T08:00:00Z", time_since_last_dose_hours: 2 },
    { value_mcg_ml: 10, collection_time: "2026-03-15T18:30:00Z", time_since_last_dose_hours: 4 },
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
}

if (typeof process !== "undefined" && process.argv[1]?.includes("existingRegimen.integration.test")) {
  runExistingRegimenTests();
  console.log("All 20 existing_regimen integration tests passed, including posterior fit-quality/uncertainty, obesity-aware Cockcroft-Gault, recommendation-search, infusion-timing, near-continuous-infusion boundary behavior, conservative sparse-fit recommendation checks, positive-level validation, required multi-level collection-time semantics, recovery-path guidance for irregular timing, exact post-infusion boundary behavior, and bounded interval extension for clearly supra-therapeutic sparse single-level cases.");
}
