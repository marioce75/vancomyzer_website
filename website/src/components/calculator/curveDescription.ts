/**
 * One description of the curve that is actually drawn, shared by the graph
 * legend and the single-dose banner so the two can never disagree.
 *
 * Display only: nothing here touches the PK calculation. The inputs are the
 * workspace's selection state (which row is active) and two facts from the
 * response (whether a single-dose-only curve exists and whether the exposure
 * horizon is the actual history).
 */
import type { SingleDoseStatus } from "./DoseRecommendationCard";

export interface CurveSelection {
  /** Level path with doses_given === 1 (one dose given, or the Empiric preview). */
  singleDose: boolean;
  singleDoseStatus: SingleDoseStatus;
  regimen: { dose_mg: number; interval_hours: number; doses_given?: number; loading_dose_mg?: number };
  /** The "as entered" row is selected. */
  viewingCurrent: boolean;
  /** The selected candidate regimen (null when no option is active). */
  activeOption: { dose_mg: number; interval_hours: number } | null;
  /** The response carries the single dose on its own (loading_dose_curve). */
  hasSingleDoseCurve: boolean;
  /** response.exposure_horizon === "actual_history". */
  actualHistory: boolean;
  /** Pulse-dose toggle: the engine-recommended curve is shown instead of the entered regimen. */
  showEngineRecommended: boolean;
  hasEngineRecommendedCurve: boolean;
}

export function singleDoseNoun(status: SingleDoseStatus): string {
  return status === "single" ? "Single dose" : status === "suggested" ? "Suggested loading dose" : "Loading dose";
}

/** Legend phrase for the solid predicted curve, e.g. "loading dose 2000 mg × 1, no further doses". */
export function describeSelectedCurve(s: CurveSelection): string {
  const { regimen, activeOption } = s;
  const notGiven = s.singleDoseStatus === "suggested" ? " (not given)" : "";
  const single = `${singleDoseNoun(s.singleDoseStatus).toLowerCase()} ${regimen.dose_mg} mg${notGiven}`;
  if (activeOption && s.viewingCurrent) {
    if (s.singleDose) {
      return s.hasSingleDoseCurve
        ? `${single} × 1, no further doses`
        : `${single} repeated every ${regimen.interval_hours} h (illustrative)`;
    }
    const n = regimen.doses_given;
    if (regimen.loading_dose_mg !== undefined && n !== undefined && n >= 2) {
      return `entered history: ${regimen.loading_dose_mg} mg loading dose, then ${regimen.dose_mg} mg q${regimen.interval_hours}h × ${n - 1}`;
    }
    return s.actualHistory && n !== undefined
      ? `entered history: ${regimen.dose_mg} mg q${regimen.interval_hours}h × ${n}`
      : `current regimen ${regimen.dose_mg} mg q${regimen.interval_hours}h, from the first dose`;
  }
  if (activeOption) {
    const regimenText = `${activeOption.dose_mg} mg q${activeOption.interval_hours}h`;
    return s.singleDose ? `${single}, then ${regimenText}` : `${regimenText}, from the first dose (no loading dose)`;
  }
  if (s.showEngineRecommended && s.hasEngineRecommendedCurve) return "suggested regimen";
  return s.singleDose
    ? `${single} repeated every ${regimen.interval_hours} h (illustrative)`
    : `your regimen ${regimen.dose_mg} mg q${regimen.interval_hours}h`;
}

export interface SingleDoseBannerCaption {
  /** Sentences before the curve description (each localized on its own). */
  before: string[];
  /** The legend phrase verbatim, so banner and legend always name the same curve. */
  curve: string;
  /** Sentences after the curve description. */
  after: string[];
}

/** Caption for the single-dose banner: "<before> Graph shows: <curve>. <after>". */
export function singleDoseBannerCaption(
  status: SingleDoseStatus,
  curveDescription: string,
  viewingCurrent: boolean,
): SingleDoseBannerCaption {
  const before = status === "suggested" ? ["Preview only.", "Graph shows:"] : ["Graph shows:"];
  const after =
    status === "suggested"
      ? ["It is not part of the dosing history until you confirm the dose actually given."]
      : viewingCurrent
        ? ["Select a candidate regimen to see it continued with maintenance doses."]
        : ["The maintenance regimen below is a projection after this dose."];
  return { before, curve: curveDescription, after };
}

/** The caption as one plain string (tests and non-React callers). */
export function singleDoseBannerCaptionText(caption: SingleDoseBannerCaption): string {
  return [...caption.before, `${caption.curve}.`, ...caption.after].join(" ");
}
