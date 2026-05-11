import { loadingDoseCurvePoints } from "./steadyStateTwoCompartment";
import { normalizePatient } from "./normalize/normalizePatient";
import { normalizeRegimen } from "./normalize/normalizeRegimen";
import { normalizeLevels } from "./normalize/normalizeLevels";
import { validateExistingRegimenRequest } from "./validate/validateExistingRegimenRequest";
import { runExistingRegimenEngine } from "./existing/existingRegimenEngine";
import { buildAdjustmentRecommendation } from "./recommend/buildAdjustmentRecommendation";
import { buildInterpretationSummary } from "./explain/buildInterpretationSummary";
import { buildAssumptions } from "./explain/buildAssumptions";
import { buildLimitations } from "./explain/buildLimitations";
import { buildDocumentationPreview } from "./explain/buildDocumentationPreview";
import { buildCalculateResponse } from "./response/buildCalculateResponse";
import type { NormalizedPatient, ExplanationInput } from "./types";

export interface ExistingRegimenPipelineInput {
  patient: {
    age?: unknown;
    weight_kg?: unknown;
    serum_creatinine_mg_dl?: unknown;
  };
  regimen: {
    dose_mg?: unknown;
    interval_hours?: unknown;
    infusion_duration_hours?: unknown;
    doses_given?: unknown;
    target_auc24?: unknown;
  };
  levels: Array<{
    value_mcg_ml?: unknown;
    collection_time?: unknown;
    time_since_last_dose_hours?: unknown;
  }>;
}

export interface PipelineValidationError {
  ok: false;
  error_type: "validation_error";
  message: string;
  field_errors?: Record<string, string>;
  recovery_guidance?: string[];
  fallback_workflow?: "initial_regimen" | "repeat_existing_regimen_sampling";
}

export function runExistingRegimenPipeline(
  input: ExistingRegimenPipelineInput
): ReturnType<typeof buildCalculateResponse> | PipelineValidationError {
  const patient: NormalizedPatient = normalizePatient(input.patient);
  const regimen = normalizeRegimen(input.regimen);
  const levels = normalizeLevels(input.levels);

  const validation = validateExistingRegimenRequest(patient, regimen, levels);
  if (!validation.ok) {
    return {
      ok: false,
      error_type: "validation_error",
      message: validation.message,
      field_errors: validation.field_errors,
      recovery_guidance: validation.recovery_guidance,
      fallback_workflow: validation.fallback_workflow,
    };
  }
  const timing_warnings = validation.warnings ?? [];

  const engineOutput = runExistingRegimenEngine({ patient, regimen, levels });
  const recommendation = buildAdjustmentRecommendation(engineOutput);

  // For loading dose: rebuild the curve using the ACTUAL recommended maintenance regimen
  // so the graph matches what's displayed as the suggested maintenance
  if (regimen.doses_given === 1 && recommendation.recommended_dose) {
    const maintDoseMg = parseInt(recommendation.recommended_dose.replace(/\D/g, ""), 10);
    const maintTau = recommendation.recommended_interval_hours;
    const maintTinf = recommendation.recommended_infusion_duration_hours ?? 1;
    if (maintDoseMg > 0 && maintTau > 0) {
      const { CL, V1, Q, V2 } = engineOutput;
      engineOutput.curve = loadingDoseCurvePoints(
        { CL, V1, Q, V2 },
        regimen.dose_mg,                                        // loading dose
        Math.min(regimen.infusion_duration_hours, regimen.interval_hours), // loading infusion
        maintDoseMg,                                            // maintenance dose
        maintTau,                                               // maintenance interval
        maintTinf,                                              // maintenance infusion
      );
    }
  }

  const explanationInput: ExplanationInput = { engineOutput, recommendation };

  const explain = {
    interpretation_summary: buildInterpretationSummary(explanationInput),
    assumptions: buildAssumptions(explanationInput),
    limitations: buildLimitations(explanationInput),
    documentation_preview: buildDocumentationPreview(explanationInput),
  };

  const response = buildCalculateResponse(
    "existing_regimen",
    engineOutput,
    recommendation,
    explain,
    patient,
  ) as ReturnType<typeof buildCalculateResponse>;
  if (timing_warnings.length > 0) {
    (response as Record<string, unknown>).timing_warnings = timing_warnings;
  }

  // Fit-quality advisory — when the posterior MAP fit can't reproduce the
  // observed level within 25% relative error, the patient's true PK differs
  // substantially from anything the prior + level can constrain. Surface it
  // so the clinician knows not to over-interpret the recommendation.
  const FIT_QUALITY_THRESHOLD = 0.25;
  const diag = engineOutput.fit_diagnostic;
  if (diag && diag.max_relative_error > FIT_QUALITY_THRESHOLD) {
    const worst = diag.posterior_predicted_at_levels.reduce(
      (acc, r) => (r.relative_error > acc.relative_error ? r : acc),
      diag.posterior_predicted_at_levels[0],
    );
    (response as Record<string, unknown>).fit_quality_warnings = [
      `Posterior fit cannot fully explain the measured level (predicted ${worst.predicted.toFixed(1)} mcg/mL vs observed ${worst.observed.toFixed(1)} mcg/mL — ${(worst.relative_error * 100).toFixed(0)}% error). Patient PK appears to differ substantially from the population prior. Recommend a confirmatory level before adjusting the dose.`,
    ];
  }

  return response;
}
