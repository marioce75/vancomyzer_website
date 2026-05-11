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

  // For pulse-dose (single dose given), the patient hasn't reached steady
  // state — only one dose has accumulated. The fitter's SS math must collapse
  // to single-dose math, which happens as tau → ∞ (accumulation factor → 1
  // and no modulo wrap of time-in-interval). The previous bound
  //   Math.max(tau, maxLevelTime + 1)
  // didn't actually achieve this — for a q24h regimen with a level drawn at
  // 16h, effectiveTau stayed at 24h, and the SS accumulation factor was 3.4×
  // the single-dose value, biasing the fit toward "no shift needed" even
  // when the curve plotter (which uses real multi-dose schedule math) showed
  // far less drug at that time. Force a very large effectiveTau here so SS
  // math = single-dose math regardless of the user's entered interval.
  const isPulseDose = regimen.doses_given === 1;
  const PULSE_DOSE_EFFECTIVE_TAU_HOURS = 10000;
  const effectiveTau = isPulseDose ? PULSE_DOSE_EFFECTIVE_TAU_HOURS : tau;

  const observations: NormalizedObservation[] = levels.map((l) => {
    const time_hours = Math.max(0, l.time_since_last_dose_hours);
    const concentration = Math.max(0, l.value_mcg_ml);
    // For non-pulse-dose (SS or multi-dose accumulation) workflows: when the
    // level was drawn slightly past the dosing interval (a "late trough" — the
    // next dose hasn't been given yet), wrapping via modulo would put it at
    // the next cycle's peak time, which is the wrong physical interpretation.
    // Clamp to tau instead so the SS posterior fitter sees it as the trough.
    let time_in_interval: number;
    if (!isPulseDose && tau > 0 && time_hours > tau) {
      time_in_interval = tau;
    } else {
      time_in_interval = timeInInterval(time_hours, effectiveTau);
    }
    return { time_hours, concentration, time_in_interval };
  });
  return {
    observations,
    context: { tau: effectiveTau, T_inf },
  };
}
