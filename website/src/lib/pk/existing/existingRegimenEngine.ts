/**
 * Existing-regimen engine: internally consistent two-compartment intermittent-infusion model.
 */

import { runPosteriorEngine } from "../posterior/posteriorEngine";
import { computeExposure, curvePoints, finiteHistoryExposure, loadingDoseCurvePoints } from "../steadyStateTwoCompartment";
import { assessSteadyStateApproach, resolveExposureHorizon, STEADY_STATE_HALF_LIVES } from "../exposureHorizon";
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
    posterior_cl_bound,
  } = posteriorResult;
  const { dose_mg, interval_hours, infusion_duration_hours, doses_given, target_auc24 } = regimen;
  const tau = interval_hours;
  const T_inf = Math.min(Math.max(0, infusion_duration_hours), tau);

  // The exposure horizon is decided ONCE for the request (exposureHorizon.ts)
  // and shared with the posterior fit, so the fitted level, the current-regimen
  // exposure and the candidate rows all describe the same thing. The model's
  // own view of how close the patient is to steady state is an ADVISORY.
  const exposure_horizon = resolveExposureHorizon(regimen);
  const isNonSteadyState = exposure_horizon === "actual_history";
  const isPulseDose = exposure_horizon === "single_dose";

  // Canonical steady-state projection of the current regimen — the same
  // function, parameters and infusion duration every candidate row uses.
  const steadyStateExposure = computeExposure({ CL, V1, Q, V2, dose_mg, tau, T_inf });
  const steady_state_exposure = { ...steadyStateExposure, infusion_duration_hours: T_inf };
  const steady_state_approach = assessSteadyStateApproach(doses_given, tau, { CL, V1, Q, V2 }) ?? undefined;
  const steady_state_warning =
    exposure_horizon === "steady_state" && steady_state_approach && !steady_state_approach.adequate
      ? `Steady state was confirmed for this regimen, but with a terminal half-life of ${steady_state_approach.terminal_half_life_hours.toFixed(1)} h the model predicts only ${(steady_state_approach.fraction_of_steady_state * 100).toFixed(0)}% of the steady-state plateau after ${doses_given} doses (${steady_state_approach.half_lives_elapsed.toFixed(1)} of ${STEADY_STATE_HALF_LIVES} half-lives). If dosing history is incomplete or irregular, use the actual-history mode.`
      : undefined;

  // For loading dose: build a realistic curve showing loading → maintenance transition
  // For regular regimens: use standard multi-dose accumulation curve
  let curve: { time_hours: number; concentration: number }[];
  let curve_engine_recommended: { time_hours: number; concentration: number }[] | undefined;
  let loading_dose_curve: { time_hours: number; concentration: number }[] | undefined;
  if (isPulseDose) {
    // The loading dose on its own (no maintenance), over the first 48 h. This
    // is the profile the top-level single-dose AUC/peak/trough describe, so
    // the loading-dose row plots the same thing it reports.
    loading_dose_curve = loadingDoseCurvePoints({ CL, V1, Q, V2 }, dose_mg, T_inf, 0, tau, T_inf)
      .filter((p) => p.time_hours <= 48);

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
    // For a pre-steady-state regimen the reported peak and trough are taken
    // from the Nth dosing interval, so the plotted curve has to stop there too.
    // Letting it run on to steady state made the graph disagree with the
    // numbers printed beside it — the same panel-vs-graph split the
    // loading-dose curve had, measured at +6.4% on the trough.
    if (isNonSteadyState && doses_given !== undefined && doses_given > 0) {
      const horizonHours = doses_given * tau;
      curve = curve.filter((point) => point.time_hours <= horizonHours + 1e-9);
    }
  }

  // Top-level triple — see ExistingRegimenEngineOutput. Finite-dose peak/trough
  // are NEVER paired with the steady-state daily AUC. The actual-history values
  // are computed analytically (not read off the plotted grid) and carried in
  // their own block.
  let auc24 = steadyStateExposure.auc24;
  let peak = steadyStateExposure.peak;
  let trough = steadyStateExposure.trough;
  let actual_history_exposure: ExistingRegimenEngineOutput["actual_history_exposure"];
  if ((isNonSteadyState || isPulseDose) && doses_given !== undefined && doses_given > 0) {
    const finite = finiteHistoryExposure({ CL, V1, Q, V2, dose_mg, tau, T_inf }, doses_given);
    actual_history_exposure = {
      doses_given,
      peak: Math.round(finite.peak * 100) / 100,
      trough: Math.round(finite.trough * 100) / 100,
      auc_interval_n: Math.round(finite.auc_interval_n * 10) / 10,
      auc_0_24h: Math.round(finite.auc_0_24h * 10) / 10,
    };
    if (isPulseDose) {
      // Loading dose (dose 1): report the first-dose profile and the area
      // under the first 24 hours of that single dose — interval-independent,
      // which is what the label promises and what the 400-600 target is
      // compared against. (The former first-interval × 24/tau scaling read
      // 476 at q8h, 408 at q12h and 274 at q24h for the same dose.)
      auc24 = finite.auc_0_24h;
      peak = finite.peak;
      trough = finite.trough;
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
      ? `Actual-history analysis: the level was fitted after exactly ${doses_given} dose${doses_given === 1 ? "" : "s"}; exposure of the current regimen is reported as its steady-state projection, with dose-${doses_given} peak/trough shown separately.`
      : steady_state_warning
        ? "Steady state confirmed by the clinician (model approach check flagged — see warning)."
        : "Steady state confirmed by the clinician.";

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
    exposure_horizon,
    steady_state_exposure: {
      auc24: Math.round(steady_state_exposure.auc24 * 10) / 10,
      peak: Math.round(steady_state_exposure.peak * 100) / 100,
      trough: Math.round(steady_state_exposure.trough * 100) / 100,
      infusion_duration_hours: T_inf,
    },
    actual_history_exposure,
    steady_state_approach,
    steady_state_warning,
    scr: posteriorScr,
    current_regimen_dose_mg: dose_mg,
    current_regimen_interval_hours: interval_hours,
    curve,
    curve_engine_recommended,
    loading_dose_curve,
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
    posterior_cl_bound,
  };
}
