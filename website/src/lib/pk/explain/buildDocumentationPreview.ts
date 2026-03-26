import type { ExplanationInput } from "../types";

function buildRecommendationDelta(input: ExplanationInput): string {
  const { engineOutput, recommendation } = input;
  const currentDose = engineOutput.current_regimen_dose_mg;
  const currentInterval = engineOutput.current_regimen_interval_hours;
  const recommendedDose =
    parseInt(recommendation.recommended_dose.replace(/\D/g, ""), 10) || currentDose;
  const recommendedInterval = recommendation.recommended_interval_hours;

  const parts: string[] = [];
  if (recommendedDose > currentDose) {
    parts.push(`dose increase from ${currentDose} mg to ${recommendedDose} mg`);
  }
  if (recommendedDose < currentDose) {
    parts.push(`dose decrease from ${currentDose} mg to ${recommendedDose} mg`);
  }
  if (recommendedInterval > currentInterval) {
    parts.push(`interval extension from q${currentInterval}h to q${recommendedInterval}h`);
  }
  if (recommendedInterval < currentInterval) {
    parts.push(`interval shortening from q${currentInterval}h to q${recommendedInterval}h`);
  }

  return parts.length > 0
    ? `Change summary: ${parts.join("; ")}.`
    : "Change summary: same practical regimen step retained after bounded review of exposure and timing semantics.";
}

function buildSparseHighExposureNote(input: ExplanationInput): string | null {
  const { engineOutput, recommendation } = input;
  if (
    engineOutput.level_count <= 1 &&
    (engineOutput.posterior_fit?.fit_quality === "weak" ||
      engineOutput.posterior_fit?.uncertainty_label === "high") &&
    recommendation.recommended_interval_hours > engineOutput.current_regimen_interval_hours &&
    (engineOutput.auc24 >= 650 || engineOutput.trough >= 20 || engineOutput.peak >= 45)
  ) {
    return "Sparse but clearly high exposure justified a bounded interval extension rather than only same-interval dose reduction.";
  }
  return null;
}

export function buildDocumentationPreview(input: ExplanationInput): {
  quick_summary: string;
  clinical_note: string;
} {
  const { engineOutput, recommendation } = input;
  const {
    auc24,
    peak,
    trough,
    scr,
    used_posterior_refinement,
    posterior_fit,
  } = engineOutput;
  const changeSummary = buildRecommendationDelta(input);
  const sparseHighExposureNote = buildSparseHighExposureNote(input);
  const estimateLabel = used_posterior_refinement
    ? "Posterior-updated"
    : "First-pass population";

  const quick_summary = [
    `AUC24: ${auc24} mg·h/L; peak ${peak}; trough ${trough} mcg/mL (${estimateLabel})`,
    `Recommendation: ${recommendation.recommended_dose} every ${recommendation.recommended_interval_hours} h infused over ${recommendation.recommended_infusion_duration_hours ?? engineOutput.current_regimen_infusion_hours ?? 1} h`,
    changeSummary,
    ...(sparseHighExposureNote ? [sparseHighExposureNote] : []),
    ...(recommendation.infusion_duration_adjusted_for_safety && recommendation.infusion_safety_note ? [recommendation.infusion_safety_note] : []),
    `SCr: ${scr} mg/dL (Colin 2019 renal covariate). Fit quality: ${posterior_fit?.fit_quality ?? "not_applicable"}; uncertainty: ${posterior_fit?.uncertainty_label ?? "population_only"}. Assumptions and limitations apply.`,
  ].join("\n");

  const clinical_note = [
    `Vancomycin existing regimen evaluation (${estimateLabel} estimate).`,
    `AUC24: ${auc24} mg·h/L; peak ${peak} mcg/mL; trough ${trough} mcg/mL.`,
    `Recommendation: ${recommendation.recommended_dose} every ${recommendation.recommended_interval_hours} h infused over ${recommendation.recommended_infusion_duration_hours ?? engineOutput.current_regimen_infusion_hours ?? 1} h.`,
    changeSummary,
    ...(sparseHighExposureNote ? [sparseHighExposureNote] : []),
    `SCr: ${scr} mg/dL (direct Colin 2019 covariate — no Cockcroft-Gault). Explicit adult prior model: Colin 2019 two-compartment; ${used_posterior_refinement ? "bounded first-pass posterior update from level(s)." : "no posterior update."}`,
    `Posterior fit quality: ${posterior_fit?.fit_quality ?? "not_applicable"} (${posterior_fit?.fit_quality_reason ?? "no measured levels available"}). Uncertainty: ${posterior_fit?.uncertainty_label ?? "population_only"}. Sparse levels do not justify overconfident patient-specific precision.`,
  ].join("\n");

  return { quick_summary, clinical_note };
}
