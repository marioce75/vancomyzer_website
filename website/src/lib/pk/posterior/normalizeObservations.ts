/**
 * Normalize observed levels for posterior fitting.
 * Concentration, time_since_last_dose, and regimen timing context.
 */

import type { NormalizedLevel, NormalizedRegimen } from "../types";
import { resolveExposureHorizon, type ExposureHorizon } from "../exposureHorizon";

export interface NormalizedObservation {
  time_hours: number;
  concentration: number;
  /** Time within the dosing interval [0, tau] for steady-state. */
  time_in_interval: number;
}

export interface ObservationContext {
  tau: number;
  T_inf: number;
  /**
   * Doses actually given, when the regimen is still pre-steady-state. The
   * fitter superposes exactly this many doses instead of assuming the infinite
   * dose train the steady-state equations describe. Undefined when the caller
   * gave no dose count (treated as steady state).
   */
  doses_given?: number;
  /** Horizon decided once for the whole request (exposureHorizon.ts). */
  horizon: ExposureHorizon;
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
    // When the level was drawn past the dosing interval (a "late trough" — the
    // next dose hasn't been given yet), wrapping via modulo would put it at
    // the next cycle's peak time, which is the wrong physical interpretation.
    // Clamp to tau instead so the steady-state fitter sees it as the trough.
    //
    // This clamp only shapes `time_in_interval`, which is read by the
    // steady-state prediction path. Pre-steady-state fits read `time_hours`
    // below and superpose the doses actually given, so for those a late draw
    // keeps its true elapsed time and is modelled as the extended trough it
    // is (fitPosteriorParameters.predictConcentration).
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
    context: { tau: effectiveTau, T_inf, doses_given: regimen.doses_given, horizon: resolveExposureHorizon(regimen) },
  };
}
