/**
 * Normalize observed levels for posterior fitting.
 * Concentration, time_since_last_dose, and regimen timing context.
 */

import type { NormalizedLevel, NormalizedRegimen } from "../types";
import { resolveExposureHorizon, type ExposureHorizon } from "../exposureHorizon";
import { buildDoseHistory, loadingDoseOf } from "../doseHistory";
import type { DoseEvent } from "../steadyStateTwoCompartment";

export interface NormalizedObservation {
  time_hours: number;
  concentration: number;
  /** Absolute sample time for duplicate detection; never used as time since dose. */
  sample_time_hours?: number;
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
  /** Actual dose history when dose 1 was a loading dose (doseHistory.ts). */
  dose_history?: DoseEvent[];
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
    // The steady-state solution extends elimination beyond tau when the next
    // infusion has not happened. Preserve actual elapsed time: clamping a late
    // sample to tau biases the fit; wrapping would invent another dose.
    const time_in_interval = time_hours;
    const parsed = Date.parse(l.collection_time);
    return { time_hours, concentration, time_in_interval,
      sample_time_hours: Number.isFinite(parsed) ? parsed / 3600000 : undefined };

  });
  return {
    observations,
    context: (() => {
      const loading = loadingDoseOf(regimen);
      return {
        tau: effectiveTau, T_inf, doses_given: regimen.doses_given, horizon: resolveExposureHorizon(regimen),
        ...(loading ? { dose_history: buildDoseHistory(regimen, loading) } : {}),
      };
    })(),
  };
}
