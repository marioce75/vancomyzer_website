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
  /** The engine's recommended maintenance regimen, when the response carries one (names the toggle's curve). */
  engineRecommended?: { dose_mg: number; interval_hours: number } | null;
}

/** Which row the single-dose banner describes: the dose as entered, a candidate regimen, or no regimen at all. */
export type SingleDoseView = "current" | "option" | "none";

export function singleDoseView(s: Pick<CurveSelection, "viewingCurrent" | "activeOption"> & {
  /** False when the response proposes no regimen (blocked or held): there is no candidate to select. */
  regimenProposed: boolean;
}): SingleDoseView {
  if (!s.regimenProposed || !s.activeOption) return "none";
  return s.viewingCurrent ? "current" : "option";
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
  if (s.showEngineRecommended && s.hasEngineRecommendedCurve) {
    const rec = s.engineRecommended;
    return rec ? `${single}, then ${rec.dose_mg} mg q${rec.interval_hours}h (suggested regimen)` : "suggested regimen";
  }
  // No regimen is selected or proposed (for example the recommendation is
  // blocked). The workspace then draws the single dose on its own whenever the
  // response carries that curve, so the legend must not imply repeats.
  if (s.singleDose) {
    return s.hasSingleDoseCurve
      ? `${single} × 1, no further doses`
      : `${single} repeated every ${regimen.interval_hours} h (illustrative)`;
  }
  return `your regimen ${regimen.dose_mg} mg q${regimen.interval_hours}h`;
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
  view: SingleDoseView | boolean,
): SingleDoseBannerCaption {
  const v: SingleDoseView = typeof view === "boolean" ? (view ? "current" : "option") : view;
  const before = status === "suggested" ? ["Preview only.", "Graph shows:"] : ["Graph shows:"];
  const after =
    status === "suggested"
      ? ["It is not part of the dosing history until you confirm the dose actually given."]
      : v === "current"
        ? ["Select a candidate regimen to see it continued with maintenance doses."]
        : v === "option"
          ? ["The maintenance regimen below is a projection after this dose."]
          : ["No maintenance regimen is shown; the graph has only this dose."];
  return { before, curve: curveDescription, after };
}

/** The caption as one plain string (tests and non-React callers). */
export function singleDoseBannerCaptionText(caption: SingleDoseBannerCaption): string {
  return [...caption.before, `${caption.curve}.`, ...caption.after].join(" ");
}

/**
 * Where the measured levels are drawn, and how they are labelled.
 *
 * A measured level is an observation made under the dosing history as entered.
 * Its place on the time axis is counted from that history's own doses (the
 * response's measured_levels[].time_hours). It belongs on the fitted curve of
 * that history and nowhere else: drawn on a candidate regimen's projection it
 * would sit at a time that means nothing on that curve (a level taken 11 h
 * after dose 6 of q12h lands 5 h into a q6h candidate's interval) and would
 * read as a point the projection was fitted to.
 *
 * Display only. Nothing here touches the PK calculation.
 */
export interface MeasuredLevelsInput {
  /** The response's measured levels: value and absolute time on the entered history's axis. */
  levels: { time_hours: number; concentration: number }[];
  /** Hours after the start of the last dose, as entered (same order as `levels`). */
  hoursAfterLastDose: (number | undefined)[];
  /** The solid curve is the entered history itself (the "as entered" row, or no candidate). */
  solidIsEnteredHistory: boolean;
  /** The entered history's own curve is available to carry the markers. */
  hasEnteredHistoryCurve: boolean;
  /** Legend phrase of the entered history's curve (describeSelectedCurve with the "as entered" row). */
  enteredHistoryLabel: string;
  /** Doses given before the level (undefined when not stated). */
  dosesGiven?: number;
}

export interface MeasuredLevelsDisplay {
  /**
   * "solid": markers on the solid curve, which is the entered history.
   * "reference": the solid curve is a projection of a regimen not given; the
   * markers sit on a separate dotted curve of the entered history.
   * "hidden": no entered-history curve is available, so no marker is drawn.
   */
  placement: "solid" | "reference" | "hidden";
  /** Legend label for the markers. */
  legend: string;
  /**
   * Legend phrase of the dotted entered-history curve ("reference" only): the
   * same phrase the legend uses when that history is the solid curve. The
   * legend prints it after MEASURED_REFERENCE_PREFIX.
   */
  referenceLabel: string | null;
  /** Sentence that separates the observations from the projection (null when the solid curve is the history). */
  note: string | null;
  /** One line per level: value, time after the dose it followed, and where that is on the axis. */
  anchors: string[];
}

/** Legend prefix of the dotted entered-history curve: "Levels measured under: <that history>". */
export const MEASURED_REFERENCE_PREFIX = "Levels measured under";

export function describeMeasuredLevels(s: MeasuredLevelsInput): MeasuredLevelsDisplay | null {
  if (s.levels.length === 0) return null;
  const placement: MeasuredLevelsDisplay["placement"] = s.solidIsEnteredHistory ? "solid" : s.hasEnteredHistoryCurve ? "reference" : "hidden";
  const dose = s.dosesGiven !== undefined && Number.isFinite(s.dosesGiven) && s.dosesGiven >= 1
    ? (s.dosesGiven === 1 ? "the dose given" : `dose ${s.dosesGiven}`)
    : "the last dose";
  const axis = placement === "hidden" ? null : placement === "solid" ? "on this curve" : "on the dotted entered-history curve";
  const anchors = s.levels.map((l, i) => {
    const after = s.hoursAfterLastDose[i];
    // The time after the dose is stated only when it is known for this level;
    // the value and the place on the axis always come from the response.
    const when = after !== undefined && Number.isFinite(after) ? `, ${after} h after the start of ${dose}` : "";
    return `Level ${i + 1}: ${l.concentration} mg/L${when}${axis ? ` (T+${Number(l.time_hours.toFixed(2))} h ${axis})` : ""}`;
  });
  if (placement === "solid") {
    return { placement, legend: "Measured (entered history)", referenceLabel: null, note: null, anchors };
  }
  if (placement === "reference") {
    return {
      placement,
      legend: "Measured (on the dotted entered-history curve, not on the projection)",
      referenceLabel: s.enteredHistoryLabel,
      note: "The solid curve is a projection of a regimen not yet given. Measured levels were drawn under the entered history and are plotted on its dotted curve at their own times, not on the projection.",
      anchors,
    };
  }
  return {
    placement,
    legend: "Measured (not plotted)",
    referenceLabel: null,
    note: "The solid curve is a projection of a regimen not yet given. Measured levels were drawn under the entered history and are not plotted on the projection.",
    anchors,
  };
}
