import type { ExplanationInput } from "../types";

export function buildInterpretationSummary(input: ExplanationInput): string {
  const { engineOutput, recommendation } = input;
  const {
    auc24,
    peak,
    trough,
    crcl,
    current_regimen_dose_mg,
    current_regimen_interval_hours,
    data_quality_note,
    used_posterior_refinement,
    posterior_fit,
  } = engineOutput;

  const estimateType = used_posterior_refinement
    ? posterior_fit?.uncertainty_label === "high"
      ? "Posterior-updated but high-uncertainty estimate"
      : "Posterior-updated estimate"
    : "First-pass population estimate";

  return (
    `Current regimen: ${current_regimen_dose_mg} mg every ${current_regimen_interval_hours} h. ` +
    `${estimateType}: AUC24 ${auc24} mg·h/L; peak ${peak} mcg/mL; trough ${trough} mcg/mL. ` +
    `One-compartment model (CrCl ${crcl} mL/min). ` +
    `Recommended adjustment: ${recommendation.recommended_dose} every ${recommendation.recommended_interval_hours} h. ` +
    `Fit quality ${posterior_fit?.fit_quality ?? "not_applicable"}; uncertainty ${posterior_fit?.uncertainty_label ?? "population_only"}. ` +
    `${data_quality_note} Intended to support review, not replace clinician judgment.`
  );
}
