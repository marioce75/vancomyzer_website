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
import { highBmiAdvisory } from "./modelRegistry";

export interface ExistingRegimenPipelineInput {
  patient: {
    age?: unknown;
    weight_kg?: unknown;
    serum_creatinine_mg_dl?: unknown;
    /** Optional. Used for the high-BMI advisory and the informational CrCl
     *  comparison only — neither switches the PK model. */
    height_cm?: unknown;
    sex?: unknown;
  };
  regimen: {
    dose_mg?: unknown;
    interval_hours?: unknown;
    infusion_duration_hours?: unknown;
    doses_given?: unknown;
    target_auc24?: unknown;
    /** Not modelled — see hasAdministrationHistory. Accepted only so the
     *  request can be answered honestly rather than silently reinterpreted. */
    loading_dose_mg?: unknown;
    administration_history?: unknown;
    dose_history?: unknown;
  };
  /** Not modelled — see hasAdministrationHistory. */
  administration_history?: unknown;
  dose_history?: unknown;
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

/**
 * True when the caller supplied any per-dose administration history: a loading
 * dose, an explicit dose list, or a regimen change. The engine models a single
 * uniform regimen, so these are not accounted for. Detecting them lets the
 * result say so rather than returning a number that silently assumes the
 * history away.
 */
function hasAdministrationHistory(input: ExistingRegimenPipelineInput): boolean {
  const top = input as unknown as Record<string, unknown>;
  const regimen = (input.regimen ?? {}) as Record<string, unknown>;
  const present = (value: unknown) =>
    value !== undefined && value !== null && (!Array.isArray(value) || value.length > 0);
  return (
    present(top.administration_history) ||
    present(top.dose_history) ||
    present(regimen.administration_history) ||
    present(regimen.dose_history) ||
    present(regimen.loading_dose_mg)
  );
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

  // `engineOutput.curve` must stay the series the shipped auc24/peak/trough were
  // sampled from. A block here used to overwrite it, for doses_given === 1, with
  // a curve built on the *recommended* maintenance regimen after those metrics
  // had already been computed from the patient's own regimen. When the
  // recommended interval was shorter than the entered one it placed a
  // maintenance dose inside the first interval, so the panel read trough 5.9 /
  // AUC24 300 ("increase the dose") while the graph beside it never fell below
  // ~17.9 mcg/mL ("hold or reduce") — opposite actions from one result. Across
  // 2025 simulated cases the shipped curve disagreed with the shipped numbers in
  // 727 of them, worst case 15.75 mcg/mL of trough.
  //
  // The override was redundant as well as wrong: existingRegimenEngine already
  // ships the forward plan separately as `curve_engine_recommended`, and
  // buildCalculateResponse builds a per-option curve for each frequency tab.
  // The engine picks its comparison maintenance regimen from an uncapped grid,
  // so in the one state where the safety layer has determined that no safe
  // maintenance regimen exists, the chart still offered an "Engine
  // recommendation" toggle plotting a regimen above the trough and AUC caps —
  // the very regimen class just refused (measured: 250 mg q24h at trough 55.1,
  // AUC24 1371, beside a card saying to hold dosing). A refusal gets no
  // comparison curve.
  if (recommendation.adjustment_dosing_blocked) {
    engineOutput.curve_engine_recommended = undefined;
  }

  const explanationInput: ExplanationInput = { engineOutput, recommendation };

  const explain = {
    interpretation_summary: buildInterpretationSummary(explanationInput),
    assumptions: buildAssumptions(explanationInput),
    limitations: buildLimitations(explanationInput),
    documentation_preview: buildDocumentationPreview(explanationInput),
  };
  // High body size gets an advisory, never a different model (modelRegistry.ts).
  const bmiAdvisory = highBmiAdvisory(patient);
  if (bmiAdvisory) explain.limitations.unshift(bmiAdvisory);

  if (hasAdministrationHistory(input)) {
    explain.limitations.unshift(
      "Administration history is not modelled. This result assumes every dose was the dose entered above, given exactly every " +
        `${regimen.interval_hours} h and infused over the entered duration. A loading dose, a regimen change, a missed or held ` +
        "dose, and an actual infusion end time that differs from the schedule are all ignored — the dose history supplied with " +
        "this request did not change the fit. Where the real history differs, document the actual dose times and interpret this " +
        "result accordingly, or use the loading-dose workflow for a single dose.",
    );
  }

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
