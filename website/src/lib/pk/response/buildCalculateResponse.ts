import type { ExistingRegimenEngineOutput, AdjustmentRecommendation } from "../types";

export interface ExistingRegimenExplainOutput {
  interpretation_summary: string;
  assumptions: string[];
  limitations: string[];
  documentation_preview: { quick_summary: string; clinical_note: string };
}

export function buildCalculateResponse(
  recommendation_type: "existing_regimen",
  engineOutput: ExistingRegimenEngineOutput,
  recommendation: AdjustmentRecommendation,
  explain: ExistingRegimenExplainOutput
): Record<string, unknown> {
  return {
    recommendation_type,
    auc24: engineOutput.auc24,
    peak: engineOutput.peak,
    trough: engineOutput.trough,
    recommended_dose: recommendation.recommended_dose,
    recommended_interval_hours: recommendation.recommended_interval_hours,
    interpretation_summary: explain.interpretation_summary,
    assumptions: explain.assumptions,
    limitations: explain.limitations,
    curve: engineOutput.curve,
    measured_levels: engineOutput.measured_levels,
    documentation_preview: explain.documentation_preview,
  };
}
