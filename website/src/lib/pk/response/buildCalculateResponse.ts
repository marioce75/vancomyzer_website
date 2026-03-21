import type { ExistingRegimenEngineOutput, AdjustmentRecommendation } from "../types";
import { buildExistingRegimenReviewStatus } from "./buildReviewStatus";

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
  const review_status = buildExistingRegimenReviewStatus(engineOutput);

  return {
    recommendation_type,
    auc24: engineOutput.auc24,
    peak: engineOutput.peak,
    trough: engineOutput.trough,
    recommended_dose: recommendation.recommended_dose,
    recommended_interval_hours: recommendation.recommended_interval_hours,
    recommended_infusion_duration_hours: recommendation.recommended_infusion_duration_hours,
    infusion_duration_adjusted_for_safety: recommendation.infusion_duration_adjusted_for_safety,
    infusion_safety_note: recommendation.infusion_safety_note,
    interpretation_summary: explain.interpretation_summary,
    assumptions: explain.assumptions,
    limitations: explain.limitations,
    curve: engineOutput.curve,
    measured_levels: engineOutput.measured_levels,
    frequency_options: recommendation.frequency_options ?? [],
    calculation_details: {
      method: engineOutput.used_posterior_refinement
        ? "Adult prior model with bounded first-pass posterior refinement in a two-compartment intermittent steady-state workflow"
        : "Adult prior model only in a two-compartment intermittent steady-state workflow",
      evidence_strength:
        engineOutput.level_count <= 0
          ? "population prior only"
          : engineOutput.level_count === 1
            ? engineOutput.posterior_fit?.uncertainty_label === "high"
              ? "single level / high uncertainty"
              : "single level / bounded uncertainty"
            : engineOutput.posterior_fit?.fit_quality === "moderate"
              ? "multiple coherent levels"
              : "multiple levels / bounded uncertainty",
      data_quality_summary:
        engineOutput.level_count <= 0
          ? "No measured levels; workflow fit depends on population-prior assumptions only."
          : engineOutput.level_count === 1
            ? "Sparse single-level workflow fit; interpretable only when timing and dose history are clean."
            : "Multi-level workflow fit with explicit chronology; review still depends on coherent same-interval timing.",
      review_status,
      key_inputs: [
        `Cockcroft-Gault CrCl ${engineOutput.crcl} mL/min`,
        `${engineOutput.level_count} measured level${engineOutput.level_count === 1 ? "" : "s"}`,
        `Current regimen ${engineOutput.current_regimen_dose_mg} mg q${engineOutput.current_regimen_interval_hours}h`,
      ],
      caution_flags: [
        ...(engineOutput.posterior_fit?.uncertainty_label === "high"
          ? ["Residual uncertainty is high."]
          : []),
        ...(engineOutput.level_count <= 1
          ? ["Sparse level data limit confidence."]
          : []),
        "Review assumptions, level timing, and scope exclusions before acting.",
      ],
    },
    documentation_preview: explain.documentation_preview,
  };
}

