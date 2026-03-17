import type { ExplanationInput } from "../types";

export function buildDocumentationPreview(input: ExplanationInput): {
  quick_summary: string;
  clinical_note: string;
} {
  const { engineOutput, recommendation } = input;
  const { auc24, peak, trough, crcl, used_posterior_refinement, posterior_fit } = engineOutput;
  const estimateLabel = used_posterior_refinement
    ? "Posterior-updated"
    : "First-pass population";

  const quick_summary = [
    `AUC24: ${auc24} mg·h/L; peak ${peak}; trough ${trough} mcg/mL (${estimateLabel})`,
    `Recommendation: ${recommendation.recommended_dose} every ${recommendation.recommended_interval_hours} h`,
    `CrCl: ${crcl} mL/min. Fit quality: ${posterior_fit?.fit_quality ?? "not_applicable"}; uncertainty: ${posterior_fit?.uncertainty_label ?? "population_only"}. Assumptions and limitations apply.`,
  ].join("\n");

  const clinical_note = [
    `Vancomycin existing regimen evaluation (${estimateLabel} estimate).`,
    `AUC24: ${auc24} mg·h/L; peak ${peak} mcg/mL; trough ${trough} mcg/mL.`,
    `Recommendation: ${recommendation.recommended_dose} every ${recommendation.recommended_interval_hours} h.`,
    `CrCl: ${crcl} mL/min (Cockcroft-Gault). Explicit adult prior model: Ducharme 1994 CL-CrCl relationship with V = 0.69 L/kg ideal body weight; ${used_posterior_refinement ? "bounded first-pass posterior update from level(s)." : "no posterior update."}`,
    `Posterior fit quality: ${posterior_fit?.fit_quality ?? "not_applicable"} (${posterior_fit?.fit_quality_reason ?? "no measured levels available"}). Uncertainty: ${posterior_fit?.uncertainty_label ?? "population_only"}. Sparse levels do not justify overconfident patient-specific precision.`,
  ].join("\n");

  return { quick_summary, clinical_note };
}
