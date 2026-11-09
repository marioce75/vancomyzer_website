/**
 * Clinical note and PDF exposure summary for the level workflows.
 *
 * Display only. Every figure is copied from the response: the entered
 * history's exposure (top-level auc24/peak/trough), the selected candidate's
 * steady-state projection (frequency option) and the engine's recommendation.
 * Nothing is recomputed. The point is to state, in the note and the PDF, which
 * exposure belongs to the dose(s) already given and which to a regimen that is
 * only proposed, and to carry the one-level caution shown on screen into both.
 */
import type { CalculateRequestRegimen, CalculateResponse, FrequencyOption } from "@/types/calculator";
import type { SingleDoseStatus } from "./DoseRecommendationCard";
import { loadingDoseGiven, summarizeDosingHistory } from "./dosingHistory";

/** Shown with a one-level result on screen, in the copied note and in the PDF. Wording only. */
export const ONE_LEVEL_UNCERTAINTY_SUMMARY =
  "With one measured level, the patient's estimated clearance is pulled toward the population estimate from age, weight and serum creatinine. One level does not establish the patient's true renal function or predict how it will change. If renal function is changing (for example, evolving acute kidney injury), serum creatinine lags behind, true clearance may be lower than estimated and exposure may be under-predicted. Confirm with a second level and reassess renal function before relying on this dose.";

export interface ExposureFigures {
  auc24: number;
  peak: number;
  trough: number;
}

/** The dose or doses already given, exactly as entered. */
export interface GivenExposure {
  title: string;
  regimen: string;
  /** What the figures describe: one dose over its first 24 h, or the entered regimen's steady-state projection. */
  period: string;
  figures: ExposureFigures;
  /** Modelled exposure at the last dose actually given (actual-history fits only). */
  atLastDose?: string;
}

/** A regimen that is proposed and has not been given. */
export interface ProposedRegimen {
  title: string;
  regimen: string;
  period: string;
  figures?: ExposureFigures;
  origin: "engine" | "selected";
  /** When the clinician selected a candidate other than the engine's: the engine's regimen. */
  engineRecommendation?: string;
}

export interface ExposureSummary {
  given: GivenExposure;
  /** null when no regimen is proposed; `noneReason` then says why. */
  proposed: ProposedRegimen | null;
  noneReason?: string;
  /** Plain-language reading of the dosing history as entered (dosingHistory.ts). */
  history: string | null;
  /** The measured levels as entered, one sentence each. */
  levels: string[];
  /** One-level / changing renal function caution, when it applies. */
  caution: string | null;
}

type ResponseFields = Pick<
  CalculateResponse,
  | "recommendation_type"
  | "auc24"
  | "peak"
  | "trough"
  | "recommended_dose"
  | "recommended_interval_hours"
  | "recommended_infusion_duration_hours"
  | "adjustment_dosing_blocked"
  | "review_hold"
  | "frequency_options"
  | "actual_history_exposure"
  | "exposure_horizon"
  | "predicted_auc24"
  | "predicted_peak"
  | "predicted_trough"
  | "calculation_details"
>;

export interface ExposureSummaryInput {
  regimen: CalculateRequestRegimen;
  response: ResponseFields;
  /** The candidate row selected; null when the "as entered" row or nothing is selected. */
  selectedOption: Pick<FrequencyOption, "dose_mg" | "interval_hours" | "infusion_duration_hours" | "auc24" | "peak" | "trough" | "is_recommended"> | null;
  singleDoseStatus: SingleDoseStatus;
  levels: { value_mcg_ml: number; time_since_last_dose_hours: number }[];
}

const minutes = (hours: number | undefined) => (hours !== undefined && hours > 0 ? `${Number((hours * 60).toFixed(6))} minutes` : undefined);
const regimenText = (dose: number, interval: number, infusionHours?: number) => {
  const m = minutes(infusionHours);
  return `${dose} mg every ${interval} h${m ? ` infused over ${m}` : ""}`;
};

/** The same rule the advisory uses on screen: an existing-regimen result rated "caution" that rests on exactly one level. */
export function oneLevelCautionApplies(response: Pick<CalculateResponse, "recommendation_type" | "calculation_details">, levelCount: number): boolean {
  return (
    response.recommendation_type === "existing_regimen" &&
    response.calculation_details?.review_status?.level === "caution" &&
    levelCount === 1
  );
}

export function buildExposureSummary(input: ExposureSummaryInput): ExposureSummary {
  const { regimen, response, selectedOption, singleDoseStatus } = input;
  const single = regimen.doses_given === 1;
  const topLevel: ExposureFigures = { auc24: response.auc24, peak: response.peak, trough: response.trough };

  let given: GivenExposure;
  if (single) {
    const noun =
      singleDoseStatus === "suggested" ? "suggested loading dose, not given" : singleDoseStatus === "single" ? "single dose" : "loading dose";
    given = {
      title: singleDoseStatus === "suggested" ? "Suggested dose (not given)" : "Dose already given",
      regimen: `${regimen.dose_mg} mg × 1 (${noun})`,
      period: "exposure of this one dose over its first 24 h, not steady state",
      figures: topLevel,
    };
  } else {
    const n = regimen.doses_given;
    const load = loadingDoseGiven(regimen) ? regimen.loading_dose_mg : undefined;
    const count = n !== undefined && Number.isFinite(n) ? ` (${n} doses given${load ? ", including the loading dose" : ""})` : "";
    const a = response.actual_history_exposure;
    given = {
      title: "Current regimen as entered",
      regimen: `${regimen.dose_mg} mg every ${regimen.interval_hours} h${load ? ` after a ${load} mg loading dose` : ""}${count}`,
      period:
        response.exposure_horizon === "actual_history"
          ? "steady-state projection if this regimen is continued unchanged"
          : "steady-state exposure of this regimen",
      figures: topLevel,
      atLastDose: a
        ? `Modelled exposure at dose ${a.doses_given}: peak ${a.peak.toFixed(1)} mg/L; trough ${a.trough.toFixed(1)} mg/L; AUC over that interval ${a.auc_interval_n.toFixed(0)} mg·h/L.`
        : undefined,
    };
  }

  // A proposed regimen identical to the one entered is "continue as entered",
  // not an adjustment and not "not yet given".
  const sameAsEntered = (dose: number, interval: number) => !single && dose === regimen.dose_mg && interval === regimen.interval_hours;
  const titleFor = (dose: number, interval: number) =>
    sameAsEntered(dose, interval)
      ? "Proposed regimen (continue as entered)"
      : single ? "Proposed maintenance regimen (not yet given)" : "Proposed adjustment (not yet given)";
  const periodFor = (dose: number, interval: number) =>
    sameAsEntered(dose, interval)
      ? "projected steady-state exposure if this regimen is continued"
      : "projected steady-state exposure if this regimen is given";
  const blocked = response.adjustment_dosing_blocked;
  const recommendedOption = response.frequency_options?.find((o) => o.is_recommended) ?? null;
  const recDose = Number.parseFloat(String(response.recommended_dose).replace(/[^\d.]/g, ""));
  const engineRegimen =
    recommendedOption
      ? regimenText(recommendedOption.dose_mg, recommendedOption.interval_hours, recommendedOption.infusion_duration_hours ?? response.recommended_infusion_duration_hours)
      : Number.isFinite(recDose) && recDose > 0 && response.recommended_interval_hours > 0
        ? regimenText(recDose, response.recommended_interval_hours, response.recommended_infusion_duration_hours)
        : null;

  let proposed: ProposedRegimen | null = null;
  let noneReason: string | undefined;
  if (blocked) {
    noneReason = blocked.recommended_action;
  } else if (response.review_hold) {
    noneReason = "No dose adjustment is presented until the entered levels are reconciled (see the review hold).";
  } else if (selectedOption) {
    proposed = {
      title: titleFor(selectedOption.dose_mg, selectedOption.interval_hours),
      regimen: regimenText(selectedOption.dose_mg, selectedOption.interval_hours, selectedOption.infusion_duration_hours),
      period: periodFor(selectedOption.dose_mg, selectedOption.interval_hours),
      figures: { auc24: selectedOption.auc24, peak: selectedOption.peak, trough: selectedOption.trough },
      origin: selectedOption.is_recommended ? "engine" : "selected",
      ...(selectedOption.is_recommended || !engineRegimen ? {} : { engineRecommendation: engineRegimen }),
    };
  } else if (engineRegimen) {
    const rec = recommendedOption ?? {
      dose_mg: recDose,
      interval_hours: response.recommended_interval_hours,
      auc24: response.predicted_auc24,
      peak: response.predicted_peak,
      trough: response.predicted_trough,
    };
    const figures =
      rec.auc24 !== undefined && rec.peak !== undefined && rec.trough !== undefined
        ? { auc24: rec.auc24, peak: rec.peak, trough: rec.trough }
        : undefined;
    proposed = {
      title: titleFor(rec.dose_mg, rec.interval_hours),
      regimen: engineRegimen,
      period: periodFor(rec.dose_mg, rec.interval_hours),
      figures,
      origin: "engine",
    };
  } else {
    noneReason = "No maintenance regimen is proposed.";
  }

  return {
    given,
    proposed,
    noneReason,
    history: summarizeDosingHistory(regimen),
    levels: input.levels.map((l, i) => `Measured level ${i + 1}: ${l.value_mcg_ml} mg/L, ${l.time_since_last_dose_hours} h after the start of the last dose.`),
    caution: oneLevelCautionApplies(response, input.levels.length) ? ONE_LEVEL_UNCERTAINTY_SUMMARY : null,
  };
}

const figuresText = (f: ExposureFigures) => `AUC24 ${f.auc24} mg·h/L; peak ${f.peak} mg/L; trough ${f.trough} mg/L`;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Sentences for the note: the dose(s) given, then the proposed regimen (or why there is none). */
export function exposureSummaryLines(s: ExposureSummary): { given: string; proposed: string } {
  const given = `${s.given.title}: ${s.given.regimen}. ${capitalize(s.given.period)}: ${figuresText(s.given.figures)}.${s.given.atLastDose ? ` ${s.given.atLastDose}` : ""}`;
  const p = s.proposed;
  const proposed = p
    ? `${p.title}: ${p.regimen}. ${capitalize(p.period)}${p.figures ? `: ${figuresText(p.figures)}` : ""}.` +
      (p.origin === "selected"
        ? ` Candidate selected by the clinician${p.engineRecommendation ? `; the engine recommendation is ${p.engineRecommendation}` : ""}.`
        : " Engine recommendation.")
    : `Proposed maintenance regimen: none.${s.noneReason ? ` ${s.noneReason}` : ""}`;
  return { given, proposed };
}

/** Engine note lines that named an exposure or a regimen without saying whose; the summary lines replace them. */
const REPLACED_ENGINE_LINES = /^(AUC24:|Recommendation:)/;

/**
 * The note as shown in the NOTE tab, copied by "Copy Note" and printed in the
 * PDF: the engine's header, the history and levels as entered, the exposure of
 * what was given, the proposed regimen (or none), the engine's model and fit
 * lines, and the one-level caution when it applies.
 */
export function composeClinicalNote(engineNote: string, s: ExposureSummary): string {
  const lines = engineNote.split("\n").filter((l) => l.trim().length > 0);
  const header = lines[0]?.startsWith("Vancomycin") ? lines.shift()! : "Vancomycin existing regimen evaluation.";
  const rest = lines.filter((l) => !REPLACED_ENGINE_LINES.test(l));
  const { given, proposed } = exposureSummaryLines(s);
  return [
    header,
    s.history ? `Dosing history entered: ${s.history}` : null,
    ...s.levels,
    given,
    proposed,
    ...rest,
    s.caution ? `One measured level: ${s.caution}` : null,
  ]
    .filter((l): l is string => Boolean(l))
    .join("\n");
}

export interface ClinicalNoteInput {
  regimen: CalculateRequestRegimen;
  response: ResponseFields & { documentation_preview?: { clinical_note: string } };
  /** The active row: a candidate, or the synthetic "as entered" row (then activeIsCurrent is true). */
  activeOption: (Pick<FrequencyOption, "dose_mg" | "interval_hours" | "infusion_duration_hours" | "auc24" | "peak" | "trough" | "is_recommended"> & { clinical_note?: string }) | null;
  activeIsCurrent: boolean;
  singleDoseStatus: SingleDoseStatus;
  levels: { value_mcg_ml: number; time_since_last_dose_hours: number }[];
}

/** The note for the active row. Empiric results keep the engine's note untouched. */
export function buildClinicalNote(input: ClinicalNoteInput): { summary: ExposureSummary | null; note: string } {
  const engineNote = input.activeOption?.clinical_note ?? input.response.documentation_preview?.clinical_note ?? "";
  if (input.response.recommendation_type !== "existing_regimen") return { summary: null, note: engineNote };
  const summary = buildExposureSummary({
    regimen: input.regimen,
    response: input.response,
    selectedOption: input.activeIsCurrent ? null : input.activeOption,
    singleDoseStatus: input.singleDoseStatus,
    levels: input.levels,
  });
  return { summary, note: composeClinicalNote(engineNote, summary) };
}
