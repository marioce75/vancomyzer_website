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
  patient: { age?: unknown; sex?: unknown; weight_kg?: unknown; serum_creatinine_mg_dl?: unknown; height_cm?: unknown };
  regimen: { dose_mg?: unknown; interval_hours?: unknown; infusion_duration_hours?: unknown };
  levels: Array<{ value_mcg_ml?: unknown; collection_time?: unknown; time_since_last_dose_hours?: unknown }>;
}

export interface PipelineValidationError {
  ok: false;
  error_type: "validation_error";
  message: string;
  field_errors?: Record<string, string>;
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
    };
  }

  const engineOutput = runExistingRegimenEngine({ patient, regimen, levels });
  const recommendation = buildAdjustmentRecommendation(engineOutput);
  const explanationInput: ExplanationInput = { engineOutput, recommendation };

  const explain = {
    interpretation_summary: buildInterpretationSummary(explanationInput),
    assumptions: buildAssumptions(explanationInput),
    limitations: buildLimitations(explanationInput),
    documentation_preview: buildDocumentationPreview(explanationInput),
  };

  return buildCalculateResponse("existing_regimen", engineOutput, recommendation, explain) as ReturnType<typeof buildCalculateResponse>;
}
