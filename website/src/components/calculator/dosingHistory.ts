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

const mg = (v: number | undefined) => (v !== undefined && v > 0 ? `${v.toLocaleString("en-US")} mg` : "? mg");

/**
 * One-line, plain-language reading of the history as entered, e.g.
 * "2,000 mg loading dose at 0 h → 750 mg at 12 h. Level drawn after the 750 mg dose (dose 2 of 2)."
 * Returns null until a dose count is chosen.
 */
export function summarizeDosingHistory(r: Regimen): string | null {
  const m = maintenanceDosesGiven(r);
  if (m === undefined) return null;
  const tau = r.interval_hours > 0 ? r.interval_hours : undefined;
  if (loadingDoseGiven(r)) {
    if (m === 0) {
      return `${mg(r.loading_dose_mg)} loading dose only, no maintenance dose yet. Level drawn after the loading dose.`;
    }
    const gap = r.loading_to_maintenance_hours ?? tau;
    const first = `${mg(r.dose_mg)} at ${gap !== undefined ? `${gap} h` : "? h"}`;
    const rest = m >= 2 ? `, then every ${tau ?? "?"} h (${m} maintenance doses)` : "";
    return `${mg(r.loading_dose_mg)} loading dose at 0 h → ${first}${rest}. Level drawn after the last ${mg(r.dose_mg)} dose (dose ${m + 1} of ${m + 1}).`;
  }
  if (m === 1) return `One ${mg(r.dose_mg)} dose, no loading dose. Level drawn after that dose.`;
  return `${m} doses of ${mg(r.dose_mg)} every ${tau ?? "?"} h, no loading dose. Level drawn after dose ${m}.`;
}

/**
 * The regimen as sent to the API. Loading-dose fields travel only with a
 * multi-dose history where a loading dose was entered (an unfilled 0 is sent
 * so the server rejects it visibly); otherwise they are dropped so a stale or
 * mirrored entry cannot change the fit. Same rule buildRequest always used.
 */
export function requestRegimen(regimen: Regimen): Regimen {
  const hasLoading = (regimen.doses_given ?? 0) >= 2 && regimen.loading_dose_mg !== undefined;
  const { loading_dose_mg, loading_infusion_duration_hours, loading_to_maintenance_hours, ...maintenance } = regimen;
  return hasLoading
    ? { ...maintenance, loading_dose_mg, loading_infusion_duration_hours, ...(loading_to_maintenance_hours !== undefined ? { loading_to_maintenance_hours } : {}) }
    : maintenance;
}
