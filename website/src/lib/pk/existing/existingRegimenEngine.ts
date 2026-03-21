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
    crcl,
    success: used_posterior_refinement,
    diagnostics: posterior_fit,
  } = posteriorResult;
  const { dose_mg, interval_hours, infusion_duration_hours } = regimen;
  const tau = interval_hours;
  const T_inf = Math.min(Math.max(0, infusion_duration_hours), tau);

  const exposure = computeExposure({ CL, V1, Q, V2, dose_mg, tau, T_inf });
  const curve = curvePoints({ CL, V1, Q, V2, dose_mg, tau, T_inf }, tau * 2, 0.5);

  const measured_levels = levels.map((l) => ({
    time_hours: l.time_since_last_dose_hours,
    concentration: l.value_mcg_ml,
  }));

  const priorMsg = "Colin 2019 two-compartment adult population prior";

  const data_quality_note = used_posterior_refinement
    ? `Bounded MAP-style posterior update from measured level(s) using the ${priorMsg}; fit quality ${posterior_fit.fit_quality} (${posterior_fit.fit_quality_reason}). Sparse-level fits should be interpreted cautiously and are not equivalent to a full commercial Bayesian engine.`
    : levels.length === 1
      ? `Single level present but posterior fit not applied. Outputs remain from the ${priorMsg}. Fit quality ${posterior_fit.fit_quality} (${posterior_fit.fit_quality_reason}).`
      : `No posterior update applied; outputs remain from the ${priorMsg}. Fit quality ${posterior_fit.fit_quality} (${posterior_fit.fit_quality_reason}).`;

  return {
    auc24: Math.round(exposure.auc24 * 10) / 10,
    peak: Math.round(exposure.peak * 10) / 10,
    trough: Math.round(exposure.trough * 10) / 10,
    crcl,
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
  };
}
