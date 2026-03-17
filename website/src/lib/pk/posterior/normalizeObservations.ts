/**
 * Normalize observed levels for posterior fitting.
 * Concentration, time_since_last_dose, and regimen timing context.
 */

import type { NormalizedLevel, NormalizedRegimen } from "../types";

export interface NormalizedObservation {
  time_hours: number;
  concentration: number;
  /** Time within the dosing interval [0, tau] for steady-state. */
  time_in_interval: number;
}

export interface ObservationContext {
  tau: number;
  T_inf: number;
}

function timeInInterval(t: number, tau: number): number {
  if (tau <= 0) return 0;
  const n = Math.floor(t / tau);
  return t - n * tau;
}

export function normalizeObservations(
  levels: NormalizedLevel[],
  regimen: NormalizedRegimen
): { observations: NormalizedObservation[]; context: ObservationContext } {
  const tau = Math.max(0, regimen.interval_hours);
  const T_inf = Math.min(
    Math.max(0, regimen.infusion_duration_hours ?? 0),
    tau || 1
  );
  const observations: NormalizedObservation[] = levels.map((l) => {
    const time_hours = Math.max(0, l.time_since_last_dose_hours);
    const concentration = Math.max(0, l.value_mcg_ml);
    return {
      time_hours,
      concentration,
      time_in_interval: timeInInterval(time_hours, tau),
    };
  });
  return {
    observations,
    context: { tau, T_inf },
  };
}
