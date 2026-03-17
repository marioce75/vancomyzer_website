/**
 * Simulate expected exposure for a candidate regimen using the shared one-compartment model.
 * Used by the recommendation layer only. Ensures coherence with engine and posterior.
 */

import { computeExposure } from "../steadyStateOneCompartment";

export interface CandidateRegimen {
  dose_mg: number;
  interval_hours: number;
  infusion_duration_hours: number;
}

export interface SimulatedExposure {
  auc24: number;
  peak: number;
  trough: number;
}

export function simulateCandidateExposure(
  Ke: number,
  V: number,
  candidate: CandidateRegimen
): SimulatedExposure {
  const tau = candidate.interval_hours;
  const T_inf = Math.min(
    Math.max(0, candidate.infusion_duration_hours),
    tau || 1
  );
  return computeExposure({
    Ke,
    V,
    dose_mg: candidate.dose_mg,
    tau,
    T_inf,
  });
}
