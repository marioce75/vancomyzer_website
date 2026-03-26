import type { ExplanationInput } from "../types";

function buildRegimenChangeExplanation(input: ExplanationInput): string {
  const { engineOutput, recommendation } = input;
  const currentDose = engineOutput.current_regimen_dose_mg;
  const currentInterval = engineOutput.current_regimen_interval_hours;
  const recommendedDose = parseInt(recommendation.recommended_dose.replace(/\D/g, ""), 10) || currentDose;
  const recommendedInterval = recommendation.recommended_interval_hours;

  const changeParts: string[] = [];
  if (recommendedDose > currentDose) changeParts.push("higher dose");
  if (recommendedDose < currentDose) changeParts.push("lower dose");
  if (recommendedInterval > currentInterval) changeParts.push("longer interval");
  if (recommendedInterval < currentInterval) changeParts.push("shorter interval");

  if (changeParts.length === 0) {
    return "Recommendation remains on the same practical regimen step after bounded review of exposure and timing semantics.";
  }

  return `Change rationale: recommends a ${changeParts.join(" and ")} relative to the current regimen to move estimated exposure toward the target range while keeping interpretation bounded.`;
}

function buildSparseHighExposureNote(input: ExplanationInput): string {
  const { engineOutput, recommendation } = input;
  const currentInterval = engineOutput.current_regimen_interval_hours;
  const recommendedInterval = recommendation.recommended_interval_hours;

  if (
    engineOutput.level_count <= 1 &&
    (engineOutput.posterior_fit?.fit_quality === "weak" || engineOutput.posterior_fit?.uncertainty_label === "high") &&
    recommendedInterval > currentInterval &&
    (engineOutput.auc24 >= 650 || engineOutput.trough >= 20 || engineOutput.peak >= 45)
  ) {
    return " Because exposure appears clearly high despite sparse evidence, the bounded recommendation permits interval extension instead of only a same-interval dose reduction.";
  }

  return "";
}

export function buildInterpretationSummary(input: ExplanationInput): string {
  const { engineOutput, recommendation } = input;
  const { auc24, peak, trough, scr, current_regimen_dose_mg, current_regimen_interval_hours, data_quality_note, used_posterior_refinement, posterior_fit } = engineOutput;

  const estimateType = used_posterior_refinement
    ? posterior_fit?.uncertainty_label === "high"
      ? "Posterior-updated but high-uncertainty estimate"
      : "Posterior-updated estimate"
    : "First-pass population estimate";

  const conservativeRecommendationNote =
    posterior_fit?.fit_quality === "weak" || posterior_fit?.uncertainty_label === "high"
      ? " Recommendation kept conservative because posterior evidence is weak/high-uncertainty."
      : "";
  const changeExplanation = buildRegimenChangeExplanation(input);
  const sparseHighExposureNote = buildSparseHighExposureNote(input);
  const infusionDuration = recommendation.recommended_infusion_duration_hours ?? engineOutput.current_regimen_infusion_hours ?? 1;
  const infusionSafetyNote = recommendation.infusion_duration_adjusted_for_safety && recommendation.infusion_safety_note
    ? ` ${recommendation.infusion_safety_note}`
    : "";

  return (
    `Current regimen: ${current_regimen_dose_mg} mg every ${current_regimen_interval_hours} h. ` +
    `${estimateType}: AUC24 ${auc24} mg·h/L; peak ${peak} mcg/mL; trough ${trough} mcg/mL. ` +
    `One-compartment model (SCr ${scr} mg/dL). ` +
    `Recommended adjustment: ${recommendation.recommended_dose} every ${recommendation.recommended_interval_hours} h infused over ${infusionDuration} h. ` +
    `${changeExplanation} ` +
    `Fit quality ${posterior_fit?.fit_quality ?? "not_applicable"}; uncertainty ${posterior_fit?.uncertainty_label ?? "population_only"}.` +
    `${infusionSafetyNote}${conservativeRecommendationNote}${sparseHighExposureNote} ${data_quality_note} Intended to support review, not replace clinician judgment.`
  );
}
