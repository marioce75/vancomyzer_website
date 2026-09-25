/**
 * Exposure-horizon semantics — the ONE place that decides whether a result
 * describes steady state, the actual dosing history, or a single dose.
 *
 * Before 17 Sep 2026 three modules each applied their own steady-state rule:
 *   - the validator treated doses_given < 5 as pre-steady-state,
 *   - the posterior fitter treated doses_given >= 5 as steady state,
 *   - the engine treated doses_given >= 5 AND elapsed >= 4 terminal half-lives
 *     as steady state, and otherwise reported finite-dose peak/trough taken from
 *     the plotted curve NEXT TO a steady-state daily AUC (dose/CL).
 * For the reference patient (35 y, 70 kg, SCr 0.83; 1000 mg q12h over 1.75 h,
 * "6+ (SS)", level 12.9 mg/L at 12 h) that produced a "current" row of
 * AUC 486.9 / peak 30.6 / trough 12.0 beside a "recommended" row for the SAME
 * regimen of 486.9 / 31.9 / 12.9, both labelled steady state. The fitter had
 * matched the level with the steady-state trough (12.9), the engine then showed
 * six-dose values (12.0), and the candidate rows were steady state again.
 *
 * Rules now:
 *   - "single_dose": doses_given === 1 (loading/pulse dose workflow).
 *   - "steady_state": the clinician confirms steady state (steady_state_confirmed
 *     true — the "≥6 · steady state" control), or no history is given, or — for
 *     API clients that never send the flag — doses_given >= LEGACY_STEADY_STATE_DOSES.
 *   - "actual_history": every other case (a known finite number of doses). The
 *     fit superposes exactly that many doses and exposure is reported for that
 *     dose, labelled as such; the steady-state projection is reported beside it.
 * Dose count alone never promotes a regimen to steady state when the client
 * has said what it knows (steady_state_confirmed === false).
 *
 * assessSteadyStateApproach() reports how far the model thinks the patient is
 * along the approach to steady state; it is an ADVISORY, never a silent switch
 * of horizon.
 */

import type { TwoCompartmentParameters } from "./steadyStateTwoCompartment";
import { terminalHalfLifeHours } from "./steadyStateTwoCompartment";

export type ExposureHorizon = "steady_state" | "actual_history" | "single_dose";

/** Kept for API clients that predate steady_state_confirmed (UI always sends the flag). */
export const LEGACY_STEADY_STATE_DOSES = 5;

/** Fraction of steady state regarded as adequate (4 half-lives ≈ 93.75%). */
export const STEADY_STATE_HALF_LIVES = 4;

export interface HorizonRegimen {
  doses_given?: number;
  steady_state_confirmed?: boolean;
  /** A loading dose means the doses were not all equal: always actual history. */
  loading_dose_mg?: number;
}

export function resolveExposureHorizon(regimen: HorizonRegimen): ExposureHorizon {
  const n = regimen.doses_given;
  if (n === 1) return "single_dose";
  if (n !== undefined && (regimen.loading_dose_mg ?? 0) > 0) return "actual_history";
  if (regimen.steady_state_confirmed === true) return "steady_state";
  if (n === undefined) return "steady_state";
  if (regimen.steady_state_confirmed === false) return "actual_history";
  return n >= LEGACY_STEADY_STATE_DOSES ? "steady_state" : "actual_history";
}

export interface SteadyStateApproach {
  terminal_half_life_hours: number;
  elapsed_hours: number;
  half_lives_elapsed: number;
  /** 1 − 2^(−elapsed/t½): fraction of the steady-state plateau reached at the last dose. */
  fraction_of_steady_state: number;
  adequate: boolean;
}

export function assessSteadyStateApproach(
  doses_given: number | undefined,
  tau: number,
  params: TwoCompartmentParameters,
): SteadyStateApproach | null {
  if (doses_given === undefined || !(doses_given > 0) || !(tau > 0)) return null;
  const halfLife = terminalHalfLifeHours(params);
  if (!Number.isFinite(halfLife) || !(halfLife > 0)) return null;
  const elapsed = doses_given * tau;
  const halfLives = elapsed / halfLife;
  return {
    terminal_half_life_hours: halfLife,
    elapsed_hours: elapsed,
    half_lives_elapsed: halfLives,
    fraction_of_steady_state: 1 - Math.pow(2, -halfLives),
    adequate: halfLives >= STEADY_STATE_HALF_LIVES,
  };
}

export function horizonLabel(h: ExposureHorizon, doses_given?: number): string {
  switch (h) {
    case "steady_state": return "steady state (confirmed)";
    case "single_dose": return "single dose (first 24 h)";
    case "actual_history": return `actual history (dose ${doses_given ?? "?"})`;
  }
}
