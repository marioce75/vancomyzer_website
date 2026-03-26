/**
 * Existing-regimen engine: internally consistent two-compartment intermittent-infusion model.
 */

import { runPosteriorEngine } from "../posterior/posteriorEngine";
import { computeExposure, curvePoints } from "../steadyStateTwoCompartment";
import type { ExistingRegimenEngineInput, ExistingRegimenEngineOutput } from "../types";

export function runExistingRegimenEngine(
  input: ExistingRegimenEngineInput
): ExistingRegimenEngineOutput {
  const { patient, regimen, levels } = input;
  const posteriorResult = runPosteriorEngine({ patient, regimen, levels });
  const {
    CL,
    V1,
    Q,
    V2,
    scr: posteriorScr,
    success: used_posterior_refinement,
    diagnostics: posterior_fit,
  } = posteriorResult;
  const { dose_mg, interval_hours, infusion_duration_hours, doses_given, target_auc24 } = regimen;
  const tau = interval_hours;
  const T_inf = Math.min(Math.max(0, infusion_duration_hours), tau);

  const isNonSteadyState = doses_given !== undefined && doses_given < 5;
  
  // AUC24 is the same at steady state or non-steady-state for linear PK
  const steadyStateExposure = computeExposure({ CL, V1, Q, V2, dose_mg, tau, T_inf });
  const curve = curvePoints({ CL, V1, Q, V2, dose_mg, tau, T_inf });
  
  // If non-steady-state, find the peak/trough for the Nth dose from the curve
  let peak = steadyStateExposure.peak;
  let trough = steadyStateExposure.trough;
  if (isNonSteadyState) {
    const doseStart = (doses_given - 1) * tau;
    const doseEnd = doses_given * tau;
    const doseCycle = curve.filter(p => p.time_hours >= doseStart && p.time_hours <= doseEnd);
    if (doseCycle.length > 0) {
      peak = Math.max(...doseCycle.map(p => p.concentration));
      // Trough is concentration at end of interval for that specific dose cycle
      const endOfIntervalPoint = doseCycle.find(p => p.time_hours === doseEnd);
      if (endOfIntervalPoint) {
        trough = endOfIntervalPoint.concentration;
      }
    }
  }

  const measured_levels = levels.map((l) => ({
    time_hours: l.time_since_last_dose_hours,
    concentration: l.value_mcg_ml,
  }));

    const steadyStateNote = isNonSteadyState
    ? `Non-steady-state analysis based on ${doses_given} dose${doses_given === 1 ? "" : "s"}.`
    : "Steady-state assumed (≥5 doses).";

  const priorMsg = "Colin 2019 two-compartment adult population prior";

  const data_quality_note = used_posterior_refinement
    ? `Bounded MAP posterior update from measured level(s) using the ${priorMsg}. Fit quality: ${posterior_fit.fit_quality} (${posterior_fit.fit_quality_reason}). ${steadyStateNote}`
    : `No posterior update applied; outputs from ${priorMsg}. Fit quality: ${posterior_fit.fit_quality} (${posterior_fit.fit_quality_reason}). ${steadyStateNote}`;

  return {
    auc24: Math.round(steadyStateExposure.auc24 * 10) / 10,
    peak: Math.round(peak * 10) / 10,
    trough: Math.round(trough * 10) / 10,
    scr: posteriorScr,
    current_regimen_dose_mg: dose_mg,
    current_regimen_interval_hours: interval_hours,
    curve,
    measured_levels,
    level_count: levels.length,
    data_quality_note,
    used_posterior_refinement,
    posterior_fit,
    CL,
    V1,
    Q,
    V2,
    current_regimen_infusion_hours: T_inf,
    doses_given,
    target_auc24,
  };
}
