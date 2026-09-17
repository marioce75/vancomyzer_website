/**
 * Existing-regimen engine: internally consistent two-compartment intermittent-infusion model.
 */

import { runPosteriorEngine } from "../posterior/posteriorEngine";
import { computeExposure, curvePoints, loadingDoseCurvePoints, singleDoseAuc } from "../steadyStateTwoCompartment";
import { computeSafeInfusionDurationHours } from "../recommend/infusionSafety";
import type { ExistingRegimenEngineInput, ExistingRegimenEngineOutput } from "../types";
import { modelShortName } from "../modelRegistry";

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
    model_name,
    ffm_kg,
    prior_CL,
    prior_V1,
    per_level_residuals,
  } = posteriorResult;
  const { dose_mg, interval_hours, infusion_duration_hours, doses_given, target_auc24 } = regimen;
  const tau = interval_hours;
  const T_inf = Math.min(Math.max(0, infusion_duration_hours), tau);

  const isNonSteadyState = doses_given !== undefined && doses_given < 5;
  const isPulseDose = doses_given === 1;

  const steadyStateExposure = computeExposure({ CL, V1, Q, V2, dose_mg, tau, T_inf });

  // For loading dose: build a realistic curve showing loading → maintenance transition
  // For regular regimens: use standard multi-dose accumulation curve
  let curve: { time_hours: number; concentration: number }[];
  let curve_engine_recommended: { time_hours: number; concentration: number }[] | undefined;
  if (isPulseDose) {
    // PRIMARY curve = user's entered regimen continued forward (loading +
    // same-dose maintenance at the user's interval). This is what the
    // clinician asked: "If I continue 500mg q24h, what does the profile
    // look like for THIS patient?" — the previously-default behavior of
    // showing the engine's auto-pick instead is now the optional toggle.
    curve = loadingDoseCurvePoints(
      { CL, V1, Q, V2 },
      dose_mg,
      T_inf,
      dose_mg,    // maintenance dose = loading dose (user is continuing the same regimen)
      tau,        // maintenance interval = user's interval
      T_inf,      // maintenance infusion = same as loading
    );

    // Engine's optimized maintenance recommendation, computed as a separate
    // curve so the UI can offer a toggle to compare.
    const targetAuc = target_auc24 ?? 450;
    const maintIntervals = [8, 12, 24];
    let bestMaintDose = 500;
    let bestMaintTau = 12;
    let bestMaintTinf = 1;
    let bestAucDiff = Infinity;
    for (const mTau of maintIntervals) {
      const idealDose = Math.round((targetAuc * CL * mTau / 24) / 250) * 250;
      const clampedDose = Math.max(250, Math.min(2000, idealDose));
      const mTinf = computeSafeInfusionDurationHours(clampedDose).infusion_duration_hours;
      const mExposure = computeExposure({ CL, V1, Q, V2, dose_mg: clampedDose, tau: mTau, T_inf: mTinf });
      const diff = Math.abs(mExposure.auc24 - targetAuc);
      if (diff < bestAucDiff) {
        bestAucDiff = diff;
        bestMaintDose = clampedDose;
        bestMaintTau = mTau;
        bestMaintTinf = mTinf;
      }
    }
    curve_engine_recommended = loadingDoseCurvePoints(
      { CL, V1, Q, V2 },
      dose_mg, T_inf,
      bestMaintDose, bestMaintTau, bestMaintTinf,
    );
  } else {
    curve = curvePoints({ CL, V1, Q, V2, dose_mg, tau, T_inf });
  }

  // For steady-state, use the SS AUC24 = TDD/CL
  // For non-steady-state, extract actual peak/trough from the Nth dose cycle in the curve
  let auc24 = steadyStateExposure.auc24;
  let peak = steadyStateExposure.peak;
  let trough = steadyStateExposure.trough;
  if (isNonSteadyState) {
    const doseStart = (doses_given - 1) * tau;
    const doseEnd = doses_given * tau;
    const doseCycle = curve.filter(p => p.time_hours >= doseStart && p.time_hours <= doseEnd);
    if (doseCycle.length > 0) {
      peak = Math.max(...doseCycle.map(p => p.concentration));
      const endOfIntervalPoint = doseCycle.find(p => p.time_hours === doseEnd);
      if (endOfIntervalPoint) {
        trough = endOfIntervalPoint.concentration;
      }
    }

    // For a loading dose (dose 1), report the area under the first 24 hours of
    // that single dose. This previously integrated the first interval and scaled
    // by 24/tau, which made a number labelled "first-dose AUC24" depend on an
    // interval at which no dose had yet been given: the same 1500 mg dose and
    // the same measured level read 476 at q8h, 408 at q12h and 274 at q24h —
    // straddling the 400-600 target boundary on a value the clinician could not
    // trace to any input, because the interval control is hidden in pulse mode.
    // AUC0-24 of one dose is interval-independent, which is what the label
    // promises and what the 400-600 target is compared against.
    if (isPulseDose) {
      auc24 = singleDoseAuc({ CL, V1, Q, V2, dose_mg, tau, T_inf }, 0, 24);
    }
  }

  // Plot the level marker on the SAME absolute time axis the curve uses.
  // `curvePoints` places dose k at t = k*tau (dose 1 at t=0, dose 2 at t=tau, …),
  // so a level drawn 7.47h after dose 4 must be plotted at (4-1)*tau + 7.47,
  // not at 7.47. The fitter still consumes time_since_last_dose_hours via its
  // own modulo-tau wrapping, so the math is unchanged — this shift is purely
  // for chart-marker placement.
  const doseIndexForMarker = Math.max(1, doses_given ?? 1);
  const doseShiftHours = (doseIndexForMarker - 1) * tau;
  const measured_levels = levels.map((l) => ({
    time_hours: doseShiftHours + l.time_since_last_dose_hours,
    concentration: l.value_mcg_ml,
  }));

  const steadyStateNote = isPulseDose
    ? "Loading dose simulation (single dose). AUC₂₄ is the area under the first 24 hours of this one dose, not steady-state exposure."
    : isNonSteadyState
      ? `Non-steady-state analysis based on ${doses_given} dose${doses_given === 1 ? "" : "s"}.`
      : "Steady-state assumed (≥5 doses).";

  const priorMsg = `${modelShortName(model_name)} two-compartment adult population prior`;

  const data_quality_note = used_posterior_refinement
    ? `Bounded MAP posterior update from measured level(s) using the ${priorMsg}. Fit quality: ${posterior_fit.fit_quality} (${posterior_fit.fit_quality_reason}). ${steadyStateNote}`
    : `No posterior update applied; outputs from ${priorMsg}. Fit quality: ${posterior_fit.fit_quality} (${posterior_fit.fit_quality_reason}). ${steadyStateNote}`;

  const maxRelativeError = per_level_residuals.length > 0
    ? Math.max(...per_level_residuals.map((r) => r.relative_error))
    : 0;
  const fit_diagnostic = used_posterior_refinement
    ? {
        prior_CL,
        prior_V1,
        posterior_CL: CL,
        posterior_V1: V1,
        posterior_shift_cl_pct: prior_CL > 0 ? Math.abs((CL - prior_CL) / prior_CL) * 100 : 0,
        posterior_shift_v1_pct: prior_V1 > 0 ? Math.abs((V1 - prior_V1) / prior_V1) * 100 : 0,
        posterior_predicted_at_levels: per_level_residuals,
        max_relative_error: maxRelativeError,
      }
    : undefined;

  return {
    auc24: Math.round(auc24 * 10) / 10,
    peak: Math.round(peak * 10) / 10,
    trough: Math.round(trough * 10) / 10,
    scr: posteriorScr,
    current_regimen_dose_mg: dose_mg,
    current_regimen_interval_hours: interval_hours,
    curve,
    curve_engine_recommended,
    measured_levels,
    level_count: levels.length,
    data_quality_note,
    used_posterior_refinement,
    posterior_fit,
    CL,
    V1,
    Q,
    V2,
    model_name,
    ffm_kg,
    current_regimen_infusion_hours: T_inf,
    doses_given,
    target_auc24,
    fit_diagnostic,
  };
}
