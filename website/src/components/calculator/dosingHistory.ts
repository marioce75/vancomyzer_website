/**
 * Dosing-history form model for the level workflows.
 *
 * The API keeps one regimen shape (see CalculateRequestRegimen): `doses_given`
 * counts every dose given before the level, INCLUDING a loading dose, and a
 * loading dose travels as `loading_dose_mg` only when `doses_given >= 2`.
 *
 * The form asks the two questions clinicians actually answer instead:
 *   1. Was a loading dose given?          → `loading_dose_mg !== undefined`
 *   2. How many MAINTENANCE doses were given before the level?
 * and converts between the two here, so the request payload is unchanged.
 *
 *   loading dose  maintenance doses   doses_given   what the engine sees
 *   no            1                   1             single dose of dose_mg (pulse)
 *   no            n ≥ 2               n             n equal doses
 *   yes           0                   1             single dose = the loading dose (pulse)
 *   yes           n ≥ 1               n + 1         loading dose, then n maintenance doses
 *
 * In the "loading dose, no maintenance yet" row the loading dose is mirrored
 * into dose_mg / infusion_duration_hours, because that is the dose the
 * single-dose workflow fits (buildRequest drops the loading fields when
 * doses_given < 2, exactly as before).
 */
import type { CalculateRequestRegimen } from "@/types/calculator";

type Regimen = CalculateRequestRegimen;

export function loadingDoseGiven(r: Regimen): boolean {
  return r.loading_dose_mg !== undefined;
}

/** Maintenance doses given before the level, or undefined when not yet chosen. */
export function maintenanceDosesGiven(r: Regimen): number | undefined {
  const n = r.doses_given;
  if (n === undefined || Number.isNaN(n)) return undefined;
  if (!loadingDoseGiven(r)) return n;
  return n >= 2 ? n - 1 : 0;
}

/** True when the only dose given so far is the loading dose. */
export function onlyLoadingDoseGiven(r: Regimen): boolean {
  return loadingDoseGiven(r) && r.doses_given === 1;
}

export function setLoadingDoseGiven(r: Regimen, given: boolean): Regimen {
  if (given === loadingDoseGiven(r)) return r;
  const m = maintenanceDosesGiven(r);
  if (given) {
    return {
      ...r,
      loading_dose_mg: 0,
      loading_infusion_duration_hours: 0,
      loading_to_maintenance_hours: undefined,
      steady_state_confirmed: false,
      // Keep the maintenance count the user already chose; the total gains the load.
      ...(m !== undefined ? { doses_given: m + 1 } : {}),
      ...(m === 1 ? { target_auc24: undefined } : {}),
    };
  }
  const wasOnlyLoad = onlyLoadingDoseGiven(r);
  const next: Regimen = {
    ...r,
    loading_dose_mg: undefined,
    loading_infusion_duration_hours: undefined,
    loading_to_maintenance_hours: undefined,
    steady_state_confirmed: false,
  };
  if (wasOnlyLoad) {
    // dose_mg held a mirror of the loading dose: never let it silently become
    // a maintenance dose. The count goes back to "not chosen".
    return { ...next, dose_mg: 0, infusion_duration_hours: 0, doses_given: undefined, target_auc24: undefined };
  }
  if (m !== undefined) {
    next.doses_given = m;
    if (m === 1) {
      next.interval_hours = r.interval_hours > 0 ? r.interval_hours : 12;
      next.target_auc24 = r.target_auc24 ?? 450;
    }
  }
  return next;
}

export function setMaintenanceDosesGiven(r: Regimen, m: number): Regimen {
  const load = loadingDoseGiven(r);
  const wasOnlyLoad = onlyLoadingDoseGiven(r);
  if (load && m === 0) {
    return {
      ...r,
      doses_given: 1,
      steady_state_confirmed: false,
      dose_mg: r.loading_dose_mg ?? 0,
      infusion_duration_hours: r.loading_infusion_duration_hours ?? 0,
      // Placeholder interval for the single-dose model; the form shows a target AUC instead.
      interval_hours: r.interval_hours > 0 ? r.interval_hours : 12,
      target_auc24: r.target_auc24 ?? 450,
    };
  }
  // Leaving "loading dose only": the maintenance fields held the loading dose.
  const maintenance = wasOnlyLoad ? { dose_mg: 0, infusion_duration_hours: 0, interval_hours: 0 } : {};
  if (!load && m === 1) {
    return {
      ...r,
      ...maintenance,
      doses_given: 1,
      steady_state_confirmed: false,
      interval_hours: r.interval_hours > 0 ? r.interval_hours : 12,
      target_auc24: r.target_auc24 ?? 450,
    };
  }
  return {
    ...r,
    ...maintenance,
    doses_given: load ? m + 1 : m,
    steady_state_confirmed: false,
    target_auc24: undefined,
  };
}

/** Smallest count the exact-count field accepts; smaller counts have their own buttons. */
export const EXACT_COUNT_MIN = 6;

/**
 * True while the exact-count field is blank or holds an unusable entry. The
 * history stays exactly as entered and no calculation may run until a count
 * is typed (the Calculate guard checks this; see CalculatorWorkspace).
 */
export function maintenanceCountMissing(r: Regimen): boolean {
  return r.doses_given !== undefined && !Number.isFinite(r.doses_given);
}

/**
 * The exact-count field ("6 or more"). Only a whole number ≥ EXACT_COUNT_MIN
 * changes the history. A blank or partial entry (the field emits 0 when empty
 * and NaN when out of range) marks the count as missing and leaves every dose,
 * interval, infusion and loading-dose field untouched: clearing the field must
 * never turn the history into "loading dose only", which is reachable only
 * through the explicit 0 button.
 */
export function setExactMaintenanceCount(r: Regimen, n: number): Regimen {
  if (Number.isInteger(n) && n >= EXACT_COUNT_MIN) return setMaintenanceDosesGiven(r, n);
  return { ...r, doses_given: NaN, steady_state_confirmed: false };
}

/** Edit the loading dose; while it is the only dose given, it is also the dose the model fits. */
export function updateLoadingDose(
  r: Regimen,
  update: { loading_dose_mg?: number; loading_infusion_duration_hours?: number },
): Regimen {
  const next = { ...r, ...update };
  if (onlyLoadingDoseGiven(r)) {
    if (update.loading_dose_mg !== undefined) next.dose_mg = update.loading_dose_mg;
    if (update.loading_infusion_duration_hours !== undefined) next.infusion_duration_hours = update.loading_infusion_duration_hours;
  }
  return next;
}

/**
 * Smallest dose (mg) and infusion time (minutes) the "confirm the loading dose
 * given" form accepts. These are the form's minimums as before; every other
 * range check stays with the calculation, which reports it on the field.
 */
export const GIVEN_DOSE_MIN_MG = 1;
export const GIVEN_INFUSION_MIN_MINUTES = 1;

/**
 * The loading dose a clinician confirms as given in the Empiric preview.
 *
 * Takes the two numbers the form's fields emit (0 when empty, NaN when the
 * text is not a usable number or is below the minimum) and returns what is
 * recorded, or null when the entry cannot be recorded. The button is enabled
 * exactly when this is not null, so an enabled button always submits.
 *
 * Fractions are accepted and nothing is rounded: 90.5 minutes is recorded as
 * 90.5 / 60 hours, the same conversion the regimen form uses.
 */
export function confirmedGivenDose(doseMg: number, infusionMinutes: number): { dose_mg: number; infusion_duration_hours: number } | null {
  const usable = (v: number, min: number) => typeof v === "number" && Number.isFinite(v) && v >= min;
  if (!usable(doseMg, GIVEN_DOSE_MIN_MG) || !usable(infusionMinutes, GIVEN_INFUSION_MIN_MINUTES)) return null;
  return { dose_mg: doseMg, infusion_duration_hours: infusionMinutes / 60 };
}

const mg = (v: number | undefined) => (v !== undefined && v > 0 ? `${v.toLocaleString("en-US")} mg` : "? mg");

/** What a result knows about the history beyond the regimen itself. */
export interface DosingHistoryContext {
  /**
   * Measured levels entered with the result. With 0 the summary says that no
   * level was entered instead of "Level drawn after …". Leave undefined where
   * the level is still to be typed (the form's own history line).
   */
  levelCount?: number;
  /**
   * The single dose is a suggestion that has not been given (the Empiric
   * loading-dose simulation). The summary then states that no dose was given
   * and no level was measured, and names the dose as a suggestion only.
   */
  notGiven?: boolean;
}

/**
 * One-line, plain-language reading of the history as entered, e.g.
 * "2,000 mg loading dose at 0 h → 750 mg at 12 h. Level drawn after the 750 mg dose (dose 2 of 2)."
 * Returns null until a dose count is chosen.
 *
 * A note or a report passes `ctx` so the line never asserts a level that was
 * not entered or a dose that was not given.
 */
export function summarizeDosingHistory(r: Regimen, ctx: DosingHistoryContext = {}): string | null {
  const m = maintenanceDosesGiven(r);
  if (m === undefined) return null;
  if (ctx.notGiven) {
    return `No dose has been given. The ${mg(r.dose_mg)} dose is a suggestion only. No measured level entered.`;
  }
  const noLevel = ctx.levelCount === 0;
  const level = (drawn: string) => (noLevel ? "No measured level entered." : drawn);
  const tau = r.interval_hours > 0 ? r.interval_hours : undefined;
  if (loadingDoseGiven(r)) {
    if (m === 0) {
      return `${mg(r.loading_dose_mg)} loading dose only, no maintenance dose yet. ${level("Level drawn after the loading dose.")}`;
    }
    const gap = r.loading_to_maintenance_hours ?? tau;
    const first = `${mg(r.dose_mg)} at ${gap !== undefined ? `${gap} h` : "? h"}`;
    const rest = m >= 2 ? `, then every ${tau ?? "?"} h (${m} maintenance doses)` : "";
    return `${mg(r.loading_dose_mg)} loading dose at 0 h → ${first}${rest}. ${level(`Level drawn after the last ${mg(r.dose_mg)} dose (dose ${m + 1} of ${m + 1}).`)}`;
  }
  if (m === 1) return `One ${mg(r.dose_mg)} dose, no loading dose. ${level("Level drawn after that dose.")}`;
  return `${m} doses of ${mg(r.dose_mg)} every ${tau ?? "?"} h, no loading dose. ${level(`Level drawn after dose ${m}.`)}`;
}

/**
 * The regimen as sent to the API. Loading-dose fields travel only with a
 * multi-dose history where a loading dose was entered (an unfilled 0 is sent
 * so the server rejects it visibly); otherwise they are dropped so a stale or
 * mirrored entry cannot change the fit. Same rule buildRequest always used.
 *
 * `suggestedDoseNotGiven` is passed by the Empiric loading-dose preview only,
 * when no level is entered: it marks the single dose as a suggestion that has
 * not been given.
 */
export function requestRegimen(regimen: Regimen, opts: { suggestedDoseNotGiven?: boolean } = {}): Regimen {
  const hasLoading = (regimen.doses_given ?? 0) >= 2 && regimen.loading_dose_mg !== undefined;
  // Never taken from form state: the flag is set only by the caller, below.
  const { loading_dose_mg, loading_infusion_duration_hours, loading_to_maintenance_hours, suggested_dose_not_given: _stale, ...maintenance } = regimen;
  void _stale;
  const sent: Regimen = hasLoading
    ? { ...maintenance, loading_dose_mg, loading_infusion_duration_hours, ...(loading_to_maintenance_hours !== undefined ? { loading_to_maintenance_hours } : {}) }
    : maintenance;
  // The Empiric loading-dose preview simulates one suggested dose that has not
  // been given. The request says so, so the engine's text never calls that
  // dose "recorded" (wording only; the calculation is the same without it).
  return opts.suggestedDoseNotGiven === true && regimen.doses_given === 1 ? { ...sent, suggested_dose_not_given: true } : sent;
}
