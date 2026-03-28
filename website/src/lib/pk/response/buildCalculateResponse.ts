import type { ExistingRegimenEngineOutput, AdjustmentRecommendation, ExplanationInput, NormalizedPatient } from "../types";
import { buildExistingRegimenReviewStatus } from "./buildReviewStatus";
import { buildDocumentationPreview } from "../explain/buildDocumentationPreview";
import { buildInterpretationSummary } from "../explain/buildInterpretationSummary";

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
  explain: ExistingRegimenExplainOutput,
  patient?: NormalizedPatient,
): Record<string, unknown> {
  const review_status = buildExistingRegimenReviewStatus(engineOutput);

  // Enrich each frequency option with per-option documentation so the frontend
  // can sync ALL output sections (interpretation text, quick summary, clinical note)
  // to whichever dose option the pharmacist has selected.
  const enrichedFrequencyOptions = (recommendation.frequency_options ?? []).map((opt) => {
    const optInput: ExplanationInput = {
      engineOutput: {
        ...engineOutput,
        // Override the AUC/peak/trough with this option's forward-predicted values
        auc24: opt.auc24,
        peak: opt.peak,
        trough: opt.trough,
      },
      recommendation: {
        ...recommendation,
        recommended_dose: String(opt.dose_mg),
        recommended_interval_hours: opt.interval_hours,
        recommended_infusion_duration_hours: opt.infusion_duration_hours,
        // Safety-adjusted infusion note is specific to the primary recommendation;
        // option infusion durations are already computed correctly by the backend.
        infusion_duration_adjusted_for_safety: false,
        infusion_safety_note: undefined,
      },
    };
    const optDocs = buildDocumentationPreview(optInput);
    const optInterpretation = buildInterpretationSummary(optInput);
    return {
      ...opt,
      interpretation_summary: optInterpretation,
      quick_summary: optDocs.quick_summary,
      clinical_note: optDocs.clinical_note,
    };
  });

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
    pk_parameters: {
      CL: engineOutput.CL,
      V1: engineOutput.V1,
      Q: engineOutput.Q,
      V2: engineOutput.V2,
      used_posterior_refinement: engineOutput.used_posterior_refinement,
      scr: engineOutput.scr,
      age: patient?.age,
      weight_kg: patient?.weight_kg,
    },
    frequency_options: enrichedFrequencyOptions,
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
        `SCr ${engineOutput.scr} mg/dL (Colin 2019 direct renal covariate)`,
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
