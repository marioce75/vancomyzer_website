/**
 * Actual dose history for the level workflows when the first dose differed
 * from maintenance (a loading dose).
 *
 * Without this, a 1- or 2-level fit assumed every dose was the maintenance
 * dose. A loading dose then looked like slow clearance: in a simulated
 * 60 y / 80 kg adult given 2,000 mg then 1,000 mg q12h, a trough after dose 2
 * fitted CL 2.30 L/h against a true 2.92 and over-predicted steady-state AUC24
 * by 27% (39% after a 2,500 mg load), which steered the recommendation toward
 * an unneeded reduction. The bias fell to ~2% by dose 8.
 *
 * Schedule (dose 1 = the loading dose, at t = 0):
 *   dose 1  t = 0                               loading_dose_mg over loading_infusion_duration_hours
 *   dose 2  t = G                               maintenance dose over infusion_duration_hours
 *   dose j  t = G + (j − 2)·τ                   maintenance
 * where G = loading_to_maintenance_hours (default τ) and doses_given counts
 * the loading dose. Every level's time_since_last_dose_hours is measured from
 * the start of dose N (the last dose given), as in the equal-dose workflow.
 *
 * Maintenance steady-state exposure does not depend on the loading dose and
 * is still computed with the steady-state equations; only the fit to the
 * measured levels and the actual-history (dose-N) values use this schedule.
 */
import type { NormalizedRegimen } from "./types";
import {
  singleDoseAuc,
  singleDoseConcentration,
  type DoseEvent,
  type FiniteHistoryExposure,
  type TwoCompartmentParameters,
} from "./steadyStateTwoCompartment";

export interface LoadingDose {
  dose_mg: number;
  infusion_duration_hours: number;
  /** Start of dose 2 (first maintenance dose), hours after the loading dose started. */
  hours_to_first_maintenance: number;
}

/** The regimen's loading dose, when one was entered and more than one dose has been given. */
export function loadingDoseOf(regimen: NormalizedRegimen): LoadingDose | undefined {
  const mg = regimen.loading_dose_mg;
  if (!(mg !== undefined && mg > 0) || !(regimen.doses_given !== undefined && regimen.doses_given >= 2)) return undefined;
  return {
    dose_mg: mg,
    infusion_duration_hours: regimen.loading_infusion_duration_hours ?? regimen.infusion_duration_hours,
    hours_to_first_maintenance: regimen.loading_to_maintenance_hours ?? regimen.interval_hours,
  };
}

/** All doses given (dose 1 … dose N), in order. */
export function buildDoseHistory(regimen: NormalizedRegimen, loading: LoadingDose): DoseEvent[] {
  const n = regimen.doses_given ?? 1;
  const tau = regimen.interval_hours;
  const T_inf = Math.min(Math.max(0, regimen.infusion_duration_hours), tau || 1);
  const events: DoseEvent[] = [{ time: 0, dose_mg: loading.dose_mg, T_inf: loading.infusion_duration_hours }];
  for (let j = 2; j <= n; j++) {
    events.push({ time: loading.hours_to_first_maintenance + (j - 2) * tau, dose_mg: regimen.dose_mg, T_inf });
  }
  return events;
}

/** Start of the last dose given. */
export function lastDoseStart(events: DoseEvent[]): number {
  return events[events.length - 1].time;
}

/** Concentration at absolute time t (hours after dose 1 started). */
export function concentrationFromHistory(params: TwoCompartmentParameters, events: DoseEvent[], t: number): number {
  let c = 0;
  for (const ev of events) {
    if (t < ev.time) break;
    c += singleDoseConcentration({ ...params, dose_mg: ev.dose_mg, tau: 1, T_inf: ev.T_inf }, t - ev.time);
  }
  return Math.max(0, c);
}

/** AUC over [from, to] in absolute time, integrated analytically dose by dose. */
export function aucFromHistory(params: TwoCompartmentParameters, events: DoseEvent[], from: number, to: number): number {
  let auc = 0;
  for (const ev of events) {
    if (to <= ev.time) break;
    auc += singleDoseAuc({ ...params, dose_mg: ev.dose_mg, tau: 1, T_inf: ev.T_inf }, Math.max(0, from - ev.time), to - ev.time);
  }
  return auc;
}

/**
 * Dose-N values for the actual-history horizon, same definitions as
 * finiteHistoryExposure: peak at the end of dose N's infusion, trough one
 * interval after dose N started, AUC over dose N's interval, and AUC over the
 * first 24 h after dose 1.
 */
export function historyExposure(params: TwoCompartmentParameters, events: DoseEvent[], tau: number): FiniteHistoryExposure {
  const last = events[events.length - 1];
  const start = last.time;
  return {
    doses_given: events.length,
    peak: concentrationFromHistory(params, events, start + last.T_inf),
    trough: concentrationFromHistory(params, events, start + tau),
    auc_interval_n: aucFromHistory(params, events, start, start + tau),
    auc_0_24h: aucFromHistory(params, events, 0, 24),
  };
}
