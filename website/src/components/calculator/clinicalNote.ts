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
import { classifyRegimenChange, infusionMinutes, sameRegimen, type RegimenChange, type RegimenIdentity } from "@/lib/pk/regimenIdentity";

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
  /**
   * The proposed regimen's own projection: the selected candidate row's
   * figures, or the engine's predicted exposure for its recommendation.
   * Never the response's top-level figures, which describe the history given.
   */
  figures?: ExposureFigures;
  origin: "engine" | "selected";
  /** When the clinician selected a candidate other than the engine's: the engine's regimen. */
  engineRecommendation?: string;
  /**
   * How the proposal differs from the regimen entered (regimenIdentity.ts):
   * dose, interval and infusion duration all count. "after_single_dose" when
   * only one dose was given, so there is no entered regimen to compare with.
   */
  change: RegimenChange | "after_single_dose";
  /** The difference from the regimen entered, in words. Absent after a single dose. */
  changeNote?: string;
}

/** A warning or advisory shown with the result on screen, carried into the note and the PDF. */
export interface ExportWarning {
  kind: "review_hold" | "timing" | "fit_quality" | "steady_state" | "auc_high" | "below_target" | "infusion_note";
  /** The advisory's title as on screen. */
  title: string;
  text: string;
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
  /**
   * Every other warning the result carries on screen: the review hold and its
   * reason, lab timing advisories, fit-quality advisories, the steady-state
   * check, AUC above 600, AUC below target and the infusion-rate note.
   */
  warnings: ExportWarning[];
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
  | "timing_warnings"
  | "fit_quality_warnings"
  | "steady_state_warning"
  | "auc_range_status"
  | "infusion_safety_note"
>;

/** A candidate row as the note and the PDF read it. */
export type CandidateRow = Pick<FrequencyOption, "dose_mg" | "interval_hours" | "infusion_duration_hours" | "auc24" | "peak" | "trough" | "is_recommended"> & { clinical_note?: string };

/**
 * The candidate row of THIS response that has the given identity (dose,
 * interval and infusion duration), or null. Every proposed figure in the note
 * and the PDF comes from the row this returns, so a selection that does not
 * belong to the current response (a stale or restored selection) can never
 * lend its figures to a report.
 */
export function resolveCandidate<T extends RegimenIdentity>(options: readonly T[] | null | undefined, selected: RegimenIdentity | null | undefined): T | null {
  if (!selected) return null;
  return (options ?? []).find((o) => sameRegimen(o, selected)) ?? null;
}

export interface ExposureSummaryInput {
  regimen: CalculateRequestRegimen;
  response: ResponseFields;
  /**
   * The candidate row selected; null when the "as entered" row or nothing is
   * selected. It is resolved against response.frequency_options by identity,
   * and ignored when the response has no such row.
   */
  selectedOption: CandidateRow | null;
  singleDoseStatus: SingleDoseStatus;
  levels: { value_mcg_ml: number; time_since_last_dose_hours: number }[];
}

const regimenText = (dose: number, interval: number, infusionHours?: number | null) => {
  const m = infusionMinutes(infusionHours);
  return `${dose} mg every ${interval} h${m !== undefined ? ` infused over ${m} minutes` : ""}`;
};

/** The difference between the regimen entered and a proposed one, attribute by attribute. */
function describeChange(entered: RegimenIdentity, proposed: RegimenIdentity): string {
  const change = classifyRegimenChange(entered, proposed);
  if (change === "none") return "No change from the regimen entered: same dose, interval and infusion duration.";
  const from = infusionMinutes(entered.infusion_duration_hours);
  const to = infusionMinutes(proposed.infusion_duration_hours);
  const infusion =
    from === undefined || to === undefined
      ? "infusion duration not stated for both regimens"
      : Math.abs(from - to) < 1e-3
        ? `infusion duration unchanged at ${to} minutes`
        : `infusion duration from ${from} to ${to} minutes`;
  if (change === "infusion_only") {
    return `Change from the regimen entered: ${infusion}; dose and interval unchanged.`;
  }
  const dose = entered.dose_mg === proposed.dose_mg ? `dose unchanged at ${proposed.dose_mg} mg` : `dose from ${entered.dose_mg} mg to ${proposed.dose_mg} mg`;
  const interval =
    entered.interval_hours === proposed.interval_hours
      ? `interval unchanged at ${proposed.interval_hours} h`
      : `interval from ${entered.interval_hours} h to ${proposed.interval_hours} h`;
  return `Change from the regimen entered: ${dose}; ${interval}; ${infusion}.`;
}

/** The same rule the advisory uses on screen: an existing-regimen result rated "caution" that rests on exactly one level. */
export function oneLevelCautionApplies(response: Pick<CalculateResponse, "recommendation_type" | "calculation_details">, levelCount: number): boolean {
  return (
    response.recommendation_type === "existing_regimen" &&
    response.calculation_details?.review_status?.level === "caution" &&
    levelCount === 1
  );
}

export function buildExposureSummary(input: ExposureSummaryInput): ExposureSummary {
  const { regimen, response, singleDoseStatus } = input;
  const single = regimen.doses_given === 1;
  const topLevel: ExposureFigures = { auc24: response.auc24, peak: response.peak, trough: response.trough };
  // The selected candidate is the row of THIS response with that identity.
  // All of its figures come from that one row.
  const selectedOption = resolveCandidate(response.frequency_options, input.selectedOption);

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
      regimen: `${regimenText(regimen.dose_mg, regimen.interval_hours, regimen.infusion_duration_hours)}${load ? ` after a ${load} mg loading dose` : ""}${count}`,
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

  // A proposed regimen is "continue as entered" only when dose, interval AND
  // infusion duration all match the regimen entered (regimenIdentity.ts). The
  // same dose and interval over a different infusion duration is a change.
  const entered: RegimenIdentity = { dose_mg: regimen.dose_mg, interval_hours: regimen.interval_hours, infusion_duration_hours: regimen.infusion_duration_hours };
  const changeOf = (p: RegimenIdentity): ProposedRegimen["change"] => (single ? "after_single_dose" : classifyRegimenChange(entered, p));
  const titleFor = (change: ProposedRegimen["change"]) =>
    change === "after_single_dose"
      ? "Proposed maintenance regimen (not yet given)"
      : change === "none"
        ? "Proposed regimen (continue as entered)"
        : change === "infusion_only"
          ? "Proposed regimen (same dose and interval, different infusion duration; not yet given)"
          : "Proposed adjustment (not yet given)";
  const periodFor = (change: ProposedRegimen["change"]) =>
    change === "none"
      ? "projected steady-state exposure if this regimen is continued"
      : "projected steady-state exposure if this regimen is given";
  const blocked = response.adjustment_dosing_blocked;
  const hold = response.review_hold;
  const recommendedOption = response.frequency_options?.find((o) => o.is_recommended) ?? null;
  const recDose = Number.parseFloat(String(response.recommended_dose).replace(/[^\d.]/g, ""));
  // The engine's regimen: its flagged candidate row, else the response's own
  // recommendation fields. Its exposure is the row's, else predicted_*; never
  // the top-level figures.
  const engine: (RegimenIdentity & { figures?: ExposureFigures }) | null =
    blocked || hold
      ? null
      : recommendedOption
        ? {
            dose_mg: recommendedOption.dose_mg,
            interval_hours: recommendedOption.interval_hours,
            infusion_duration_hours: recommendedOption.infusion_duration_hours ?? response.recommended_infusion_duration_hours,
            figures: { auc24: recommendedOption.auc24, peak: recommendedOption.peak, trough: recommendedOption.trough },
          }
        : Number.isFinite(recDose) && recDose > 0 && response.recommended_interval_hours > 0
          ? {
              dose_mg: recDose,
              interval_hours: response.recommended_interval_hours,
              infusion_duration_hours: response.recommended_infusion_duration_hours,
              figures:
                response.predicted_auc24 !== undefined && response.predicted_peak !== undefined && response.predicted_trough !== undefined
                  ? { auc24: response.predicted_auc24, peak: response.predicted_peak, trough: response.predicted_trough }
                  : undefined,
            }
          : null;
  const engineRegimen = engine ? regimenText(engine.dose_mg, engine.interval_hours, engine.infusion_duration_hours) : null;

  let proposed: ProposedRegimen | null = null;
  let noneReason: string | undefined;
  if (blocked) {
    noneReason = blocked.recommended_action;
  } else if (hold) {
    noneReason = "Recommendation withheld until the entered levels are reconciled.";
  } else if (selectedOption) {
    const change = changeOf(selectedOption);
    proposed = {
      title: titleFor(change),
      regimen: regimenText(selectedOption.dose_mg, selectedOption.interval_hours, selectedOption.infusion_duration_hours),
      period: periodFor(change),
      figures: { auc24: selectedOption.auc24, peak: selectedOption.peak, trough: selectedOption.trough },
      origin: selectedOption.is_recommended ? "engine" : "selected",
      ...(selectedOption.is_recommended || !engineRegimen ? {} : { engineRecommendation: engineRegimen }),
      change,
      ...(single ? {} : { changeNote: describeChange(entered, selectedOption) }),
    };
  } else if (engine && engineRegimen) {
    const change = changeOf(engine);
    proposed = {
      title: titleFor(change),
      regimen: engineRegimen,
      period: periodFor(change),
      figures: engine.figures,
      origin: "engine",
      change,
      ...(single ? {} : { changeNote: describeChange(entered, engine) }),
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
    warnings: collectExportWarnings(response, { given, proposed, single, viewingProposed: Boolean(selectedOption) }),
  };
}

/**
 * The warnings and advisories the result shows on screen, for the note and
 * the PDF. The texts are copied from the response. Lab timing, fit quality
 * and steady-state warnings keep their on-screen titles; the review hold, the
 * AUC advisories and the infusion note get a short title that can head a note
 * line. (The one-level caution travels separately as `caution`.)
 */
export function collectExportWarnings(
  response: Pick<ResponseFields, "review_hold" | "timing_warnings" | "fit_quality_warnings" | "steady_state_warning" | "auc_range_status" | "predicted_auc24" | "infusion_safety_note" | "adjustment_dosing_blocked">,
  ctx: { given: GivenExposure; proposed: ProposedRegimen | null; single: boolean; viewingProposed: boolean },
): ExportWarning[] {
  const out: ExportWarning[] = [];
  if (response.review_hold) {
    out.push({ kind: "review_hold", title: "Review required, recommendation withheld", text: response.review_hold.message });
  }
  for (const w of response.timing_warnings ?? []) out.push({ kind: "timing", title: "Lab timing advisory", text: w });
  for (const w of response.fit_quality_warnings ?? []) {
    if (w !== response.steady_state_warning) out.push({ kind: "fit_quality", title: "Fit quality advisory", text: w });
  }
  if (response.steady_state_warning) out.push({ kind: "steady_state", title: "Steady-state check", text: response.steady_state_warning });
  // On screen this advisory follows the row being viewed. The current
  // regimen's steady-state exposure is flagged whichever row is viewed; a
  // single dose's first-24 h figure only when that is the row exported.
  const high = (label: string, auc: number) =>
    out.push({ kind: "auc_high", title: "Predicted AUC24 above 600 mg·h/L", text: `${label}: AUC24 ${auc} mg·h/L. Potential for elevated nephrotoxicity risk. Proceed with extreme caution.` });
  if (ctx.given.figures.auc24 > 600 && (!ctx.single || !ctx.viewingProposed)) high(ctx.given.title, ctx.given.figures.auc24);
  if (ctx.proposed?.figures && ctx.proposed.figures.auc24 > 600) high(ctx.proposed.title, ctx.proposed.figures.auc24);
  if (ctx.proposed && !response.adjustment_dosing_blocked && response.auc_range_status === "below_target" && response.predicted_auc24 !== undefined) {
    out.push({
      kind: "below_target",
      title: "AUC24 below target",
      text: `The recommended regimen is predicted to achieve AUC24 of ${response.predicted_auc24} mg·h/L, which is below the target range of 400–600 mg·h/L. Clinical review is required — consider more frequent dosing, higher doses, or continuous infusion.`,
    });
  }
  if (ctx.proposed?.origin === "engine" && response.infusion_safety_note) {
    out.push({ kind: "infusion_note", title: "Infusion note", text: response.infusion_safety_note });
  }
  return out;
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

/** One line per warning, as printed in the note: "<on-screen title>: <text>". */
export function warningLines(s: ExposureSummary): string[] {
  return s.warnings.map((w) => `${w.title}: ${w.text}`);
}

/**
 * Engine note lines the composed note replaces: an exposure or a regimen named
 * without saying whose, the withheld-recommendation line, and the engine's own
 * change summary (the composed note states the change from the regimen
 * entered itself, infusion duration included).
 */
const REPLACED_ENGINE_LINES = /^(AUC24:|Recommendation:|Recommendation withheld|Change summary:)/;

/**
 * The note as shown in the NOTE tab, copied by "Copy Note" and printed in the
 * PDF: the engine's header, the history and levels as entered, the exposure of
 * what was given, the proposed regimen (or none) and how it differs from the
 * regimen entered, every warning shown on screen, the engine's model and fit
 * lines, and the one-level caution when it applies.
 */
export function composeClinicalNote(engineNote: string, s: ExposureSummary): string {
  const lines = engineNote.split("\n").filter((l) => l.trim().length > 0);
  const header = lines[0]?.startsWith("Vancomycin") ? lines.shift()! : "Vancomycin existing regimen evaluation.";
  const warnings = warningLines(s);
  const warningTexts = new Set(s.warnings.map((w) => w.text));
  // A warning the engine note already carries verbatim is printed once, under its title.
  const rest = lines.filter((l) => !REPLACED_ENGINE_LINES.test(l) && !warningTexts.has(l.trim()));
  const { given, proposed } = exposureSummaryLines(s);
  return [
    header,
    s.history ? `Dosing history entered: ${s.history}` : null,
    ...s.levels,
    given,
    proposed,
    s.proposed?.changeNote ?? null,
    ...warnings,
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
  activeOption: CandidateRow | null;
  activeIsCurrent: boolean;
  singleDoseStatus: SingleDoseStatus;
  levels: { value_mcg_ml: number; time_since_last_dose_hours: number }[];
}

/** The note for the active row. Empiric results keep the engine's note untouched. */
export function buildClinicalNote(input: ClinicalNoteInput): { summary: ExposureSummary | null; note: string } {
  if (input.response.recommendation_type !== "existing_regimen") {
    return { summary: null, note: input.activeOption?.clinical_note ?? input.response.documentation_preview?.clinical_note ?? "" };
  }
  // The candidate row of this response, found by identity. Its engine note and
  // its figures are read from that one row.
  const selected = input.activeIsCurrent ? null : resolveCandidate(input.response.frequency_options, input.activeOption);
  const engineNote = selected?.clinical_note ?? input.response.documentation_preview?.clinical_note ?? "";
  const summary = buildExposureSummary({
    regimen: input.regimen,
    response: input.response,
    selectedOption: selected,
    singleDoseStatus: input.singleDoseStatus,
    levels: input.levels,
  });
  return { summary, note: composeClinicalNote(engineNote, summary) };
}
