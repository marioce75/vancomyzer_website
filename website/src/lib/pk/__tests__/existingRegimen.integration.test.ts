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
  const result = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 },
    levels: [{ value_mcg_ml: 18, collection_time: "", time_since_last_dose_hours: 2 }],
  });
  assert(!("ok" in result && result.ok === false), "Case 1: expected success");
  const r = result as { auc24: number; peak: number; trough: number; curve: { time_hours: number; concentration: number }[] };
  assert(r.auc24 > 0 && r.peak > 0 && r.trough > 0, "Case 1: positive exposure");
  assert(Array.isArray(r.curve) && r.curve.length > 0, "Case 1: curve present");
}

function testCase2(): void {
  const result = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 750, interval_hours: 12, infusion_duration_hours: 1 },
    levels: [{ value_mcg_ml: 12, collection_time: "", time_since_last_dose_hours: 3 }],
  });
  assert(!("ok" in result && result.ok === false), "Case 2: expected success");
  const r = result as { auc24: number; peak: number; trough: number };
  assert(r.auc24 > 0 && r.peak > 0 && r.trough > 0, "Case 2: positive exposure");
}

function testCase3(): void {
  const result = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 },
    levels: [{ value_mcg_ml: 5, collection_time: "", time_since_last_dose_hours: 10 }],
  });
  assert("ok" in result && result.ok === false, "Case 3: expected validation error");
  const err = result as { field_errors?: Record<string, string> };
  assert(
    Boolean(err.field_errors && Object.keys(err.field_errors).some((k) => k.startsWith("levels[") && err.field_errors![k].includes("interval"))),
    "Case 3: field error for level timing"
  );
}

function testCase4(): void {
  const priorLike = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 },
    levels: [{ value_mcg_ml: 8, collection_time: "", time_since_last_dose_hours: 1 }],
  });
  const highLevel = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 },
    levels: [{ value_mcg_ml: 22, collection_time: "", time_since_last_dose_hours: 1 }],
  });
  assert(!("ok" in priorLike && priorLike.ok === false), "Case 4a: expected success");
  assert(!("ok" in highLevel && highLevel.ok === false), "Case 4b: expected success");
  const a = priorLike as {
    interpretation_summary: string;
    assumptions: string[];
    limitations: string[];
    documentation_preview: { clinical_note: string; quick_summary: string };
    auc24: number;
    peak: number;
  };
  const b = highLevel as {
    interpretation_summary: string;
    assumptions: string[];
    limitations: string[];
    documentation_preview: { clinical_note: string; quick_summary: string };
    auc24: number;
    peak: number;
  };
  assert(typeof a.interpretation_summary === "string" && a.interpretation_summary.length > 0, "Case 4a: interpretation present");
  assert(typeof b.interpretation_summary === "string" && b.interpretation_summary.length > 0, "Case 4b: interpretation present");
  assert(
    a.assumptions.some((item) => item.includes("Ducharme 1994")) && a.documentation_preview.clinical_note.includes("Ducharme 1994"),
    "Case 4a: explicit literature-backed prior model should appear in assumptions and documentation preview"
  );
  assert(
    a.assumptions.some((item) => item.includes("fit quality")) &&
      a.documentation_preview.clinical_note.includes("Posterior fit quality") &&
      a.documentation_preview.quick_summary.includes("Fit quality:"),
    "Case 4a: fit quality and uncertainty should be explicit in assumptions and documentation preview"
  );
  assert(
    a.limitations.some((item) => item.includes("uncertainty") || item.includes("overinterpreted")),
    "Case 4a: limitations should explicitly warn against overclaiming certainty from sparse levels"
  );
  assert(
    Math.abs(b.peak - a.peak) > 1 || Math.abs(b.auc24 - a.auc24) > 20,
    "Case 4: one-level posterior fit should respond materially to different observed concentrations"
  );
}

function testCase5(): void {
  const result = runExistingRegimenPipeline({
    patient: { ...defaultPatient, serum_creatinine_mg_dl: 0.6 },
    regimen: { dose_mg: 1500, interval_hours: 8, infusion_duration_hours: 1 },
    levels: [{ value_mcg_ml: 8, collection_time: "", time_since_last_dose_hours: 6 }],
  });
  assert(!("ok" in result && result.ok === false), "Case 5: expected success");
  const r = result as { recommended_dose: string; recommended_interval_hours: number };
  const doseMg = parseInt(r.recommended_dose.replace(/\D/g, ""), 10) || 0;
  const tdd = (doseMg * 24) / r.recommended_interval_hours;
  assert(tdd <= 4500, "Case 5: TDD must not exceed 4500 mg/day");
}

function testCase6(): void {
  const interval_hours = 8;
  const result = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1000, interval_hours, infusion_duration_hours: 1 },
    levels: [{ value_mcg_ml: 15, collection_time: "", time_since_last_dose_hours: 4 }],
  });
  assert(!("ok" in result && result.ok === false), "Case 6: expected success");
  const r = result as {
    auc24: number;
    peak: number;
    trough: number;
    curve: { time_hours: number; concentration: number }[];
  };
  const tau = interval_hours;
  assert(r.curve.length >= 2 && tau > 0, "Case 6: curve and interval");
  const at0 = r.curve[0].concentration;
  const atTauPoint = r.curve.find((p) => Math.abs(p.time_hours - tau) < 0.6);
  assert(atTauPoint != null, "Case 6: curve point at tau");
  assert(Math.abs(at0 - atTauPoint!.concentration) < 2, "Case 6: curve roughly periodic (C(0) ≈ C(tau))");
  const oneInterval = r.curve.filter((p) => p.time_hours <= tau + 0.01);
  let aucTau = 0;
  for (let i = 0; i < oneInterval.length - 1; i++) {
    const dt = oneInterval[i + 1].time_hours - oneInterval[i].time_hours;
    aucTau += ((oneInterval[i].concentration + oneInterval[i + 1].concentration) / 2) * dt;
  }
  const auc24FromCurve = tau > 0 ? aucTau * (24 / tau) : 0;
  assert(Math.abs(auc24FromCurve - r.auc24) < r.auc24 * 0.15, "Case 6: AUC24 coherent with curve (trapezoidal over one interval)");
}

function testCase7(): void {
  const result = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 },
    levels: [
      { value_mcg_ml: 18, collection_time: "2026-03-15T08:00:00Z", time_since_last_dose_hours: 2 },
      { value_mcg_ml: 14, collection_time: "2026-03-15T10:00:00Z", time_since_last_dose_hours: 5 },
    ],
  });
  assert("ok" in result && result.ok === false, "Case 7: expected validation error");
  const err = result as { field_errors?: Record<string, string> };
  assert(Boolean(err.field_errors?.["levels[1].collection_time"]?.includes("inconsistent")), "Case 7: expected collection_time consistency error");
}

function testCase8(): void {
  const result = runExistingRegimenPipeline({
    patient: defaultPatient,
    regimen: { dose_mg: 1000, interval_hours: 8, infusion_duration_hours: 1 },
    levels: [
      { value_mcg_ml: 18, collection_time: "2026-03-15T08:00:00Z", time_since_last_dose_hours: 2 },
      { value_mcg_ml: 10, collection_time: "2026-03-15T18:30:00Z", time_since_last_dose_hours: 4 },
    ],
  });
  assert("ok" in result && result.ok === false, "Case 8: expected validation error");
  const err = result as { field_errors?: Record<string, string> };
  assert(Boolean(err.field_errors?.["levels[1].collection_time"]?.includes("more than one dosing interval")), "Case 8: expected cross-interval timing error");
}

function testCase9(): void {
  const lean = runExistingRegimenPipeline({
    patient: { age: 60, sex: "male", height_cm: 175, weight_kg: 78, serum_creatinine_mg_dl: 1.2 },
    regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 },
    levels: [{ value_mcg_ml: 15, collection_time: "", time_since_last_dose_hours: 4 }],
  });
  const obese = runExistingRegimenPipeline({
    patient: { age: 60, sex: "male", height_cm: 175, weight_kg: 130, serum_creatinine_mg_dl: 1.2 },
    regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 },
    levels: [{ value_mcg_ml: 15, collection_time: "", time_since_last_dose_hours: 4 }],
  });
  assert(!("ok" in lean && lean.ok === false), "Case 9a: expected success");
  assert(!("ok" in obese && obese.ok === false), "Case 9b: expected success");
  const a = lean as { auc24: number; interpretation_summary: string };
  const b = obese as { auc24: number; interpretation_summary: string };
  assert(Math.abs(a.auc24 - b.auc24) > 1, "Case 9: obesity-aware Cockcroft-Gault weight selection should change existing-regimen PK outputs when body habitus differs materially.");
  assert(a.interpretation_summary.includes("CrCl") && b.interpretation_summary.includes("CrCl"), "Case 9: interpretation should still present CrCl-based model context");
}

function testCase10(): void {
  const result = runExistingRegimenPipeline({
    patient: { age: 40, sex: "male", height_cm: 180, weight_kg: 80, serum_creatinine_mg_dl: 0.8 },
    regimen: { dose_mg: 2000, interval_hours: 12, infusion_duration_hours: 2 },
    levels: [{ value_mcg_ml: 35, collection_time: "", time_since_last_dose_hours: 11 }],
  });
  assert(!("ok" in result && result.ok === false), "Case 10: expected success");
  const r = result as { recommended_dose: string; recommended_interval_hours: number };
  assert([6, 8, 12, 18, 24, 36, 48].includes(r.recommended_interval_hours), "Case 10: recommendation should stay within the bounded expanded interval set");
  assert(
    r.recommended_interval_hours !== 12 || r.recommended_dose !== "2000 mg",
    "Case 10: recommender should not remain trapped on the original coarse regimen when a safer bounded alternative exists"
  );
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
}

if (typeof process !== "undefined" && process.argv[1]?.includes("existingRegimen.integration.test")) {
  runExistingRegimenTests();
  console.log("All 10 existing_regimen integration tests passed, including posterior fit-quality/uncertainty, obesity-aware Cockcroft-Gault, and recommendation-search checks.");
}
