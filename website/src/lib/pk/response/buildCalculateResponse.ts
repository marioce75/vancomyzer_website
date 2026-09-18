import type { ExistingRegimenEngineOutput, AdjustmentRecommendation, ExplanationInput, NormalizedPatient } from "../types";
import { buildExistingRegimenReviewStatus } from "./buildReviewStatus";
import { modelShortName } from "../modelRegistry";
import { buildDocumentationPreview } from "../explain/buildDocumentationPreview";
import { buildInterpretationSummary } from "../explain/buildInterpretationSummary";
import { curvePoints, loadingDoseCurvePoints } from "../steadyStateTwoCompartment";
import { computeSafeInfusionDurationHours } from "../recommend/infusionSafety";

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
  // to whichever dose option the pharmacist has selected. Each option also gets
  // its own pre-computed concentration-time curve so clicking a tab swaps the
  // chart line without an extra round-trip.
  const isPulseDose = engineOutput.doses_given === 1;
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

    // Per-option curve. For pulse-dose, plot loading→option-as-maintenance so
    // the chart updates coherently when the user clicks alternative regimens.
    const optTinf = opt.infusion_duration_hours
      ?? computeSafeInfusionDurationHours(opt.dose_mg).infusion_duration_hours;
    const params = {
      CL: engineOutput.CL,
      V1: engineOutput.V1,
      Q: engineOutput.Q,
      V2: engineOutput.V2,
    };
    const optCurve = isPulseDose
      ? loadingDoseCurvePoints(
          params,
          engineOutput.current_regimen_dose_mg,                        // loading dose = what the patient actually got
          engineOutput.current_regimen_infusion_hours ?? optTinf,      // loading infusion
          opt.dose_mg, opt.interval_hours, optTinf,                    // option as maintenance
        )
      : curvePoints({
          ...params,
          dose_mg: opt.dose_mg,
          tau: opt.interval_hours,
          T_inf: Math.min(optTinf, opt.interval_hours),
        });

    return {
      ...opt,
      curve: optCurve,
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
      pk_model_name: engineOutput.model_name,
      ffm_kg: engineOutput.ffm_kg,
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
        `SCr ${engineOutput.scr} mg/dL (${modelShortName(engineOutput.model_name)} renal covariate)`,
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
    curve_engine_recommended: engineOutput.curve_engine_recommended,
    loading_dose_curve: engineOutput.loading_dose_curve,
    fit_diagnostic: engineOutput.fit_diagnostic,
    // The engine's own fit diagnostic, so the graph's uncertainty band can use
    // uncertainty_label directly rather than reconstructing a width from other
    // fields that happen to encode it.
    posterior_fit: engineOutput.posterior_fit,
    // Explicit exposure-horizon semantics (exposureHorizon.ts). The top-level
    // auc24/peak/trough describe `exposure_horizon`; the steady-state
    // projection and the actual-history values are carried separately so no
    // consumer can pair finite-dose peak/trough with a steady-state daily AUC.
    exposure_horizon: engineOutput.exposure_horizon,
    steady_state_exposure: engineOutput.steady_state_exposure,
    actual_history_exposure: engineOutput.actual_history_exposure,
    steady_state_approach: engineOutput.steady_state_approach,
    steady_state_warning: engineOutput.steady_state_warning,
    // Where the regimen this response actually recommends sits against the
    // 400-600 band, plus the exposure it is predicted to produce. The empiric
    // path has always reported these; the adjustment path reported neither, so
    // a recommendation that missed target shipped with no banner and the card
    // displayed the CURRENT regimen's exposure instead of the proposed one.
    auc_range_status: recommendation.auc_range_status,
    predicted_auc24: recommendation.predicted_auc24,
    predicted_peak: recommendation.predicted_peak,
    predicted_trough: recommendation.predicted_trough,
    adjustment_dosing_blocked: recommendation.adjustment_dosing_blocked,
  };
}
