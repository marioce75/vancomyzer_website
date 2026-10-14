import { loadingDoseCurvePoints } from "./steadyStateTwoCompartment";
import { validateRawInput } from "./validate/validateRawInput";
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
import type { DosePolicy } from "./dosePolicy";

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
    steady_state_confirmed?: unknown;
    target_auc24?: unknown;
    /** Loading dose as dose 1 (doses_given ≥ 2); see doseHistory.ts. */
    loading_dose_mg?: unknown;
    loading_infusion_duration_hours?: unknown;
    loading_to_maintenance_hours?: unknown;
    /** Not modelled — refused by validateRawInput rather than silently reinterpreted. */
    administration_history?: unknown;
    dose_history?: unknown;
  };
  /** Not modelled — see hasAdministrationHistory. */
  administration_history?: unknown;
  dose_history?: unknown;
  /**
   * Institutional dose ceilings for this user's department. Absent means the
   * guideline defaults; a configured value can only tighten a cap, never raise
   * one (dosePolicyFromSettings).
   */
  policy?: DosePolicy;
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
  const rawErrors = validateRawInput(input);
  if (Object.keys(rawErrors).length) return { ok: false, error_type: "validation_error", message: "Invalid or unsupported inputs; no calculation was performed.", field_errors: rawErrors };
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
  const recommendation = buildAdjustmentRecommendation(engineOutput, input.policy);

  // A blocked single-dose result must not plot an implied maintenance plan.
  // The engine's default pulse curve continues the entered dose repeatedly;
  // retain only the actual single-dose history when no regimen is suggested.
  if (regimen.doses_given === 1 && recommendation.adjustment_dosing_blocked) {
    engineOutput.curve = engineOutput.loading_dose_curve ?? [];
  }

  // The optional comparison must describe the same policy-checked regimen as
  // the card, candidate table and exports. Never run a second uncapped selector.
  if (regimen.doses_given === 1 && !recommendation.adjustment_dosing_blocked) {
    const uncertainty = engineOutput.parameter_uncertainty;
    engineOutput.curve_engine_recommended = loadingDoseCurvePoints(
      { CL: engineOutput.CL, V1: engineOutput.V1, Q: engineOutput.Q, V2: engineOutput.V2 },
      regimen.dose_mg, regimen.infusion_duration_hours,
      Number.parseFloat(recommendation.recommended_dose), recommendation.recommended_interval_hours,
      recommendation.recommended_infusion_duration_hours ?? 1,
      undefined,
      uncertainty && uncertainty.method !== "unavailable" ? { draws: uncertainty.draws, level: uncertainty.level } : undefined,
    );
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
  const fitQualityWarnings: string[] = [];
  const diag = engineOutput.fit_diagnostic;
  if (diag && diag.max_relative_error > FIT_QUALITY_THRESHOLD) {
    const worst = diag.posterior_predicted_at_levels.reduce(
      (acc, r) => (r.relative_error > acc.relative_error ? r : acc),
      diag.posterior_predicted_at_levels[0],
    );
    fitQualityWarnings.push(
      `Posterior fit cannot fully explain the measured level (predicted ${worst.predicted.toFixed(1)} mg/L vs observed ${worst.observed.toFixed(1)} mg/L — ${(worst.relative_error * 100).toFixed(0)}% error). Patient PK appears to differ substantially from the population prior. Recommend a confirmatory level before adjusting the dose.`,
    );
  }

  // The fitted clearance hit a physiological bound. Say so — an adjusted
  // estimate presented as if it were the raw fit is the failure this prevents.
  if (engineOutput.posterior_cl_bound === "floored_nonrenal") {
    fitQualityWarnings.push(
      "Estimated clearance was raised to the lowest physiologically plausible non-renal value. At this serum creatinine the population model extrapolates below what an anuric adult still clears, so the prior cannot be trusted here — rely on measured levels, and repeat one before adjusting the dose.",
    );
  }
  if (engineOutput.posterior_cl_bound === "capped_renal") {
    fitQualityWarnings.push(
      "Estimated clearance was capped: the fit implied a vancomycin clearance more than twice this patient's estimated creatinine clearance, which is not plausible for a renally cleared drug. Check that the level was drawn from the correct lumen, after the infusion finished, and correctly labelled — repeat it before escalating the dose.",
    );
  }

  if (engineOutput.steady_state_warning) {
    fitQualityWarnings.push(engineOutput.steady_state_warning);
  }

  if (fitQualityWarnings.length > 0) {
    (response as Record<string, unknown>).fit_quality_warnings = fitQualityWarnings;
  }

  // Discordant same-time entries: two levels at (nearly) the same time whose
  // values disagree by more than assay-scale error. These are not two
  // well-spaced samples and cannot identify the parameters; they are either
  // replicate assays of one draw or a data-entry error. Hold the actionable
  // adjustment until the clinician reconciles them — the exposure estimates
  // and the fit diagnostics stay visible for review.
  const conflicts = engineOutput.posterior_fit.observation_conflicts ?? [];
  if (conflicts.length > 0) {
    const described = conflicts
      .map((c) => `${c.values[0]} and ${c.values[1]} mg/L both recorded at ${c.time_hours} h (${(c.relative_difference * 100).toFixed(0)}% apart)`)
      .join("; ");
    (response as Record<string, unknown>).review_hold = {
      reason: "discordant_duplicate_samples",
      message:
        `Two levels were entered at the same time with discordant values: ${described}. Same-time entries are not independent ` +
        "samples and cannot separate clearance from volume; the fit averaged through the conflict. Confirm whether these are " +
        "assay replicates of one draw (enter one reconciled value) or a data-entry error (correct the time), then recalculate. " +
        "No dose adjustment is presented until the observations are reconciled.",
      conflicts,
    };
    // Withdraw the actionable recommendation; keep exposure estimates and candidates out of the "recommended" state.
    const r = response as Record<string, unknown>;
    r.recommended_dose = "";
    r.recommended_interval_hours = 0;
    r.recommended_infusion_duration_hours = undefined;
    r.predicted_auc24 = undefined;
    r.predicted_peak = undefined;
    r.predicted_trough = undefined;
    r.auc_range_status = undefined;
    r.frequency_options = [];
  }

  return response;
}
