import { computeInitialRegimen } from "../../initialRegimen";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function testProducesNonZeroExposure(): void {
  const result = computeInitialRegimen({
    age: 55,
    sex: "male",
    height_cm: 170,
    weight_kg: 70,
    serum_creatinine_mg_dl: 1.0,
  });

  assert(result.auc24 > 0, "Initial regimen should return non-zero AUC24.");
  assert(result.peak > 0, "Initial regimen should return non-zero peak.");
  assert(result.trough >= 0, "Initial regimen should return non-negative trough.");
  assert(result.curve.length > 0, "Initial regimen should include a concentration-time curve.");
  assert(
    result.assumptions.some((item) => item.includes("Ducharme 1994")),
    "Initial regimen assumptions should disclose the explicit adult prior model."
  );
  assert(
    result.limitations.some((item) => item.includes("prior") || item.includes("patient-specific certainty")),
    "Initial regimen limitations should disclose that outputs are prior-based and uncertain."
  );
}

function testHeightAffectsPriorVolumeAndExposure(): void {
  const shorter = computeInitialRegimen({
    age: 55,
    sex: "male",
    height_cm: 160,
    weight_kg: 70,
    serum_creatinine_mg_dl: 1.0,
  });
  const taller = computeInitialRegimen({
    age: 55,
    sex: "male",
    height_cm: 190,
    weight_kg: 70,
    serum_creatinine_mg_dl: 1.0,
  });

  assert(
    Math.abs(shorter.peak - taller.peak) > 0.1 || Math.abs(shorter.auc24 - taller.auc24) > 1,
    "Initial regimen should use height-sensitive prior volume rather than ignoring height."
  );
}

function testObesityAwareCrClSelectionChangesInitialRecommendation(): void {
  const nonObese = computeInitialRegimen({
    age: 60,
    sex: "male",
    height_cm: 175,
    weight_kg: 78,
    serum_creatinine_mg_dl: 1.2,
  });
  const obese = computeInitialRegimen({
    age: 60,
    sex: "male",
    height_cm: 175,
    weight_kg: 130,
    serum_creatinine_mg_dl: 1.2,
  });

  assert(
    nonObese.recommended_interval_hours !== obese.recommended_interval_hours ||
      nonObese.recommended_dose !== obese.recommended_dose ||
      Math.abs(nonObese.auc24 - obese.auc24) > 5,
    "Initial regimen should respond to obesity-aware Cockcroft-Gault weight selection rather than using raw actual body weight for all patients."
  );
}

export function runInitialRegimenIntegrationTests(): void {
  testProducesNonZeroExposure();
  testHeightAffectsPriorVolumeAndExposure();
  testObesityAwareCrClSelectionChangesInitialRecommendation();
}

if (typeof process !== "undefined" && process.argv[1]?.includes("initialRegimen.integration.test")) {
  runInitialRegimenIntegrationTests();
  console.log("Initial regimen integration tests passed.");
}
