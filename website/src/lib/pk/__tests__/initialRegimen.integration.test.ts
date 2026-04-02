import { computeInitialRegimen } from "../../initialRegimen";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function testProducesNonZeroExposure(): void {
  const result = computeInitialRegimen({
    age: 55,
    weight_kg: 70,
    serum_creatinine_mg_dl: 1.0, height_cm: 0, sex: "" as const,
  });

  assert(result.auc24 > 0, "Initial regimen should return non-zero AUC24.");
  assert(result.peak > 0, "Initial regimen should return non-zero peak.");
  assert(result.trough >= 0, "Initial regimen should return non-negative trough.");
  assert(result.curve.length > 0, "Initial regimen should include a concentration-time curve.");
  assert(
    result.assumptions.some((item) => item.includes("Colin 2019")),
    "Initial regimen assumptions should disclose the explicit adult prior model."
  );
  assert(
    result.limitations.some((item) => item.includes("prior") || item.includes("patient-specific certainty")),
    "Initial regimen limitations should disclose that outputs are prior-based and uncertain."
  );
  assert(
    result.calculation_details.method.includes("Adult prior model") &&
      result.calculation_details.evidence_strength === "population prior only",
    "Initial regimen should expose provenance details for method and evidence strength."
  );
  assert(
    result.calculation_details.data_quality_summary.includes("No measured levels") ||
      result.calculation_details.data_quality_summary.includes("population-prior assumptions"),
    "Initial regimen should expose workflow-fit/data-quality summary for UI transparency surfaces."
  );
  assert(
    result.calculation_details.review_status.level === "prior_only" &&
      result.calculation_details.review_status.workflow_fit === "prior_only" &&
      result.calculation_details.review_status.next_actions.length > 0,
    "Initial regimen should expose typed review-status metadata for trust surfaces."
  );
  assert(
    result.calculation_details.key_inputs.length >= 2 &&
      result.calculation_details.caution_flags.some((item) => item.includes("Review assumptions") || item.includes("local protocol")),
    "Initial regimen should expose key inputs and caution flags for UI transparency surfaces."
  );
  assert(
    result.calculation_details.evidence_strength === "population prior only" &&
      result.calculation_details.caution_flags.some((item) => item.includes("No posterior refinement") || item.includes("optional generic empiric support")),
    "Initial regimen transparency metadata should stay specific enough for UI evidence/caution labeling."
  );
}

function testScrAffectsClearanceAndExposure(): void {
  const normalScr = computeInitialRegimen({
    age: 55,
    weight_kg: 70,
    serum_creatinine_mg_dl: 0.8, height_cm: 0, sex: "" as const,
  });
  const elevatedScr = computeInitialRegimen({
    age: 55,
    weight_kg: 70,
    serum_creatinine_mg_dl: 2.5, height_cm: 0, sex: "" as const,
  });

  assert(
    Math.abs(normalScr.auc24 - elevatedScr.auc24) > 10,
    "Initial regimen should respond to SCr as a direct Colin 2019 renal covariate."
  );
}

function testObesityAwareCrClSelectionChangesInitialRecommendation(): void {
  const nonObese = computeInitialRegimen({
    age: 60,
    weight_kg: 78,
    serum_creatinine_mg_dl: 1.2, height_cm: 0, sex: "" as const,
  });
  const obese = computeInitialRegimen({
    age: 60,
    weight_kg: 130,
    serum_creatinine_mg_dl: 1.2, height_cm: 0, sex: "" as const,
  });

  assert(
    nonObese.recommended_interval_hours !== obese.recommended_interval_hours ||
      nonObese.recommended_dose !== obese.recommended_dose ||
      Math.abs(nonObese.auc24 - obese.auc24) > 5,
    "Initial regimen should respond to weight differences via the Colin 2019 allometric weight scaling."
  );
}

function testLoadingDoseGuidanceIsPresentAndBounded(): void {
  const result = computeInitialRegimen({
    age: 50,
    weight_kg: 140,
    serum_creatinine_mg_dl: 0.9, height_cm: 0, sex: "" as const,
  });

  assert(
    result.interpretation_summary.includes("3000 mg") ||
      result.documentation_preview.clinical_note.includes("3000 mg"),
    "Initial regimen should surface capped loading-dose guidance for high actual body weight."
  );
  assert(
    result.documentation_preview.quick_summary.includes("optional, generic empiric support") ||
      result.documentation_preview.quick_summary.includes("optional, generic") ||
      result.documentation_preview.quick_summary.includes("reviewed separately"),
    "Initial regimen quick summary should demote loading-dose language rather than foreground it as default direction."
  );
  assert(
    result.assumptions.some((item) => item.includes("loading-dose note")) &&
      result.limitations.some((item) => item.includes("loading-dose note") || item.includes("generic empiric support")),
    "Initial regimen should disclose that loading-dose guidance is generic empiric support, not patient-specific certainty."
  );
}

function testLowBodyWeightLoadingDoseIsNotArtificiallyFloored(): void {
  const result = computeInitialRegimen({
    age: 45,
    weight_kg: 30,
    serum_creatinine_mg_dl: 0.8, height_cm: 0, sex: "" as const,
  });

  assert(
    result.interpretation_summary.includes("1000 mg") === false,
    "Low-body-weight initial regimen guidance should not automatically floor the optional loading-dose estimate to 1000 mg."
  );
  assert(
    result.interpretation_summary.includes("750 mg") ||
      result.documentation_preview.clinical_note.includes("750 mg"),
    "Low-body-weight optional loading-dose estimate should stay weight-scaled after rounding."
  );
}

export function runInitialRegimenIntegrationTests(): void {
  testProducesNonZeroExposure();
  testScrAffectsClearanceAndExposure();
  testObesityAwareCrClSelectionChangesInitialRecommendation();
  testLoadingDoseGuidanceIsPresentAndBounded();
  testLowBodyWeightLoadingDoseIsNotArtificiallyFloored();
}

if (typeof process !== "undefined" && process.argv[1]?.includes("initialRegimen.integration.test")) {
  runInitialRegimenIntegrationTests();
  console.log("Initial regimen integration tests passed, including bounded empiric loading-dose guidance checks and low-body-weight optional loading-dose behavior.");
}
