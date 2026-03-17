/**
 * Existing-regimen engine: one internally consistent one-compartment intermittent-infusion model.
 * All of posterior update, AUC24, peak, trough, and curve come from the same parameter set
 * via steadyStateOneCompartment. Timing validity is enforced in validation (reject if
 * time_since_last_dose_hours > interval_hours).
 */

import { runPosteriorEngine } from "../posterior/posteriorEngine";
import { computeExposure, curvePoints } from "../steadyStateOneCompartment";
import type { ExistingRegimenEngineInput, ExistingRegimenEngineOutput } from "../types";

export function runExistingRegimenEngine(
  input: ExistingRegimenEngineInput
): ExistingRegimenEngineOutput {
  const { patient, regimen, levels } = input;
  const posteriorResult = runPosteriorEngine({ patient, regimen, levels });
  const {
    Ke,
    V,
    crcl,
    success: used_posterior_refinement,
    diagnostics: posterior_fit,
  } = posteriorResult;
  const { dose_mg, interval_hours, infusion_duration_hours } = regimen;
  const tau = interval_hours;
  const T_inf = Math.min(Math.max(0, infusion_duration_hours), tau);

  const exposure = computeExposure({ Ke, V, dose_mg, tau, T_inf });
  const curve = curvePoints({ Ke, V, dose_mg, tau, T_inf }, tau * 2, 0.5);

  const measured_levels = levels.map((l) => ({
    time_hours: l.time_since_last_dose_hours,
    concentration: l.value_mcg_ml,
  }));

  const data_quality_note = used_posterior_refinement
    ? `Bounded MAP-style posterior update from measured level(s) using the explicit adult population prior (Ducharme 1994 CL-CrCl relationship; V from 0.69 L/kg IBW) and the shared one-compartment infusion model; fit quality ${posterior_fit.fit_quality} (${posterior_fit.fit_quality_reason}). Sparse-level fits should be interpreted cautiously and are not equivalent to a full commercial Bayesian engine.`
    : levels.length === 1
      ? `Single level present but posterior fit not applied. Outputs remain from the explicit adult population prior model (Ducharme 1994 CL-CrCl relationship; V from 0.69 L/kg IBW). Fit quality ${posterior_fit.fit_quality} (${posterior_fit.fit_quality_reason}).`
      : `No posterior update applied; outputs remain from the explicit adult population prior model (Ducharme 1994 CL-CrCl relationship; V from 0.69 L/kg IBW). Fit quality ${posterior_fit.fit_quality} (${posterior_fit.fit_quality_reason}).`;

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
    Ke,
    V,
    current_regimen_infusion_hours: T_inf,
  };
}
