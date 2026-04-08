/**
 * Existing-regimen engine: internally consistent two-compartment intermittent-infusion model.
 */

import { runPosteriorEngine } from "../posterior/posteriorEngine";
import { computeExposure, curvePoints, loadingDoseCurvePoints } from "../steadyStateTwoCompartment";
import { computeSafeInfusionDurationHours } from "../recommend/infusionSafety";
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
    model_name,
    ffm_kg,
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
  if (isPulseDose) {
    // Calculate what the maintenance dose will be (simple AUC-proportional scaling)
    const targetAuc = target_auc24 ?? 450;
    // Best maintenance: find dose at Q8h or Q12h that hits target AUC
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

    curve = loadingDoseCurvePoints(
      { CL, V1, Q, V2 },
      dose_mg,     // loading dose
      T_inf,       // loading infusion duration
      bestMaintDose, // maintenance dose
      bestMaintTau,  // maintenance interval
      bestMaintTinf, // maintenance infusion duration
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

    // For a loading dose (dose 1), compute actual AUC over first interval via trapezoidal rule
    // SS AUC overestimates single-dose exposure because it includes accumulation
    if (isPulseDose && doseCycle.length > 1) {
      let trapAuc = 0;
      for (let i = 1; i < doseCycle.length; i++) {
        const dt = doseCycle[i].time_hours - doseCycle[i - 1].time_hours;
        const avgC = (doseCycle[i].concentration + doseCycle[i - 1].concentration) / 2;
        trapAuc += dt * avgC;
      }
      // Scale to 24h equivalent for clinical comparison with AUC₂₄ target
      auc24 = trapAuc * (24 / tau);
    }
  }

  const measured_levels = levels.map((l) => ({
    time_hours: l.time_since_last_dose_hours,
    concentration: l.value_mcg_ml,
  }));

  const steadyStateNote = isPulseDose
    ? "Loading dose simulation (single dose). AUC₂₄ is the first-dose extrapolation, not steady-state."
    : isNonSteadyState
      ? `Non-steady-state analysis based on ${doses_given} dose${doses_given === 1 ? "" : "s"}.`
      : "Steady-state assumed (≥5 doses).";

  const priorMsg = model_name === "vancomyzer_obesity"
    ? "Vancomyzer Obesity Model (Smit 2020 + Zhang 2023) two-compartment adult population prior"
    : "Colin 2019 two-compartment adult population prior";

  const data_quality_note = used_posterior_refinement
    ? `Bounded MAP posterior update from measured level(s) using the ${priorMsg}. Fit quality: ${posterior_fit.fit_quality} (${posterior_fit.fit_quality_reason}). ${steadyStateNote}`
    : `No posterior update applied; outputs from ${priorMsg}. Fit quality: ${posterior_fit.fit_quality} (${posterior_fit.fit_quality_reason}). ${steadyStateNote}`;

  return {
    auc24: Math.round(auc24 * 10) / 10,
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
    model_name,
    ffm_kg,
    current_regimen_infusion_hours: T_inf,
    doses_given,
    target_auc24,
  };
}
