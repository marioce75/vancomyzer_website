/**
 * The data behind the PDF report, built in one place from the result and the
 * row selected on screen.
 *
 * Display only: every figure is copied from the response. The rule this file
 * exists to enforce is that a report never mixes sources:
 *
 *  - a proposed regimen's dose, interval, infusion duration, AUC24, peak and
 *    trough all come from ONE candidate row of the current response, found by
 *    identity (dose, interval and infusion duration);
 *  - with no such row (the "as entered" row is selected, the recommendation is
 *    blocked or withheld, or the selection does not belong to this response)
 *    the report shows the history as entered, labelled as such. The response's
 *    top-level figures describe that history and are never printed under a
 *    "proposed" heading.
 */
import type { CalculateRequestRegimen, CalculateResponse, FrequencyOption } from "@/types/calculator";
import type { ReportData } from "@/lib/generateReport";
import type { SingleDoseStatus } from "./DoseRecommendationCard";
import { buildClinicalNote, resolveCandidate } from "./clinicalNote";
import { summarizeDosingHistory } from "./dosingHistory";

export interface ReportSelection {
  patient: { age: number; weight_kg: number; serum_creatinine_mg_dl: number };
  regimen: CalculateRequestRegimen;
  /** The measured levels sent to the calculation. */
  levels: { value_mcg_ml: number; time_since_last_dose_hours: number }[];
  response: CalculateResponse;
  /** The active row on screen: a candidate, or the synthetic "as entered" row (then activeIsCurrent is true). */
  activeOption: FrequencyOption | null;
  activeIsCurrent: boolean;
  singleDoseStatus: SingleDoseStatus;
}

export function buildReportData(sel: ReportSelection): ReportData {
  const { patient, regimen, levels, response } = sel;
  const levelWorkflow = response.recommendation_type === "existing_regimen";
  const { note, summary } = buildClinicalNote({
    regimen,
    response,
    activeOption: sel.activeOption,
    activeIsCurrent: sel.activeIsCurrent,
    singleDoseStatus: sel.singleDoseStatus,
    levels,
  });

  // Level workflows: the candidate row of this response, or the history as
  // entered. Empiric results have no entered history: the active option, else
  // the engine's recommendation (the top-level figures are its own there).
  const candidate = levelWorkflow
    ? (sel.activeIsCurrent ? null : resolveCandidate(response.frequency_options, sel.activeOption))
    : sel.activeOption;
  const showsHistory = levelWorkflow && candidate === null;

  const shown = candidate
    ? {
        dose: String(candidate.dose_mg),
        interval: candidate.interval_hours,
        infusion: candidate.infusion_duration_hours ?? response.recommended_infusion_duration_hours,
        auc24: candidate.auc24,
        peak: candidate.peak,
        trough: candidate.trough,
        interpretation: candidate.interpretation_summary ?? response.interpretation_summary,
      }
    : showsHistory
      ? {
          dose: String(regimen.dose_mg),
          interval: regimen.interval_hours,
          infusion: regimen.infusion_duration_hours,
          auc24: response.auc24,
          peak: response.peak,
          trough: response.trough,
          interpretation: response.interpretation_summary,
        }
      : {
          dose: response.recommended_dose,
          interval: response.recommended_interval_hours,
          infusion: response.recommended_infusion_duration_hours,
          auc24: response.auc24,
          peak: response.peak,
          trough: response.trough,
          interpretation: response.interpretation_summary,
        };

  return {
    age: patient.age,
    weight_kg: patient.weight_kg,
    serum_creatinine_mg_dl: patient.serum_creatinine_mg_dl,
    mode: response.recommendation_type,
    recommendation_blocked: response.adjustment_dosing_blocked?.safety_message ?? response.empiric_dosing_blocked?.safety_message,
    regimen_is_current: showsHistory,
    recommended_dose: shown.dose,
    recommended_interval_hours: shown.interval,
    recommended_infusion_duration_hours: shown.infusion,
    auc24: shown.auc24,
    peak: shown.peak,
    trough: shown.trough,
    pk_parameters: response.pk_parameters
      ? {
          CL: response.pk_parameters.CL,
          V1: response.pk_parameters.V1,
          Q: response.pk_parameters.Q,
          V2: response.pk_parameters.V2,
          used_posterior_refinement: response.pk_parameters.used_posterior_refinement,
        }
      : undefined,
    pk_model_name: response.pk_parameters?.pk_model_name,
    interpretation_summary: shown.interpretation,
    assumptions: response.assumptions,
    limitations: response.limitations,
    clinical_note: note || undefined,
    // What was entered and modelled, so the report can be checked against the form.
    ...(levelWorkflow
      ? {
          dosing_history: summarizeDosingHistory(regimen) ?? undefined,
          entered_levels: levels.map((l) => ({ value_mg_l: l.value_mcg_ml, hours_after_last_dose: l.time_since_last_dose_hours })),
          single_dose: regimen.doses_given === 1
            ? { dose_mg: regimen.dose_mg, kind: regimen.loading_dose_mg !== undefined ? ("loading" as const) : ("single" as const) }
            : undefined,
          // The dose(s) given vs. the regimen proposed, every warning shown on
          // screen and the one-level caution, as in the note.
          exposure_summary: summary ?? undefined,
          one_level_caution: summary?.caution ?? undefined,
          warnings: summary?.warnings.map((w) => ({ title: w.title, text: w.text })),
          review_hold: response.review_hold ? { message: response.review_hold.message } : undefined,
        }
      : {}),
    frequency_options: response.frequency_options?.filter((o) => o.auc24 >= 400 && o.auc24 <= 600).map((o) => ({
      dose_mg: o.dose_mg,
      interval_hours: o.interval_hours,
      auc24: o.auc24,
      peak: o.peak,
      trough: o.trough,
    })),
  };
}
