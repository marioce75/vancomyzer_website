/**
 * Prediction error calculation engine for Aim 1 of the IRB study.
 *
 * Computes a priori (population-only) and a posteriori (Bayesian MAP) prediction errors
 * using the existing PK engine. Does NOT modify any existing calculation logic.
 */

import { buildPriorParameters } from "@/lib/pk/posterior/buildPriorParameters";
import { fitPosteriorParameters } from "@/lib/pk/posterior/fitPosteriorParameters";
import { concentrationAtTime } from "@/lib/pk/steadyStateTwoCompartment";
import type { NormalizedPatient, NormalizedRegimen } from "@/lib/pk/types";
import type {
  ResearchPatient,
  DosingRecord,
  LevelRecord,
  PredictionError,
  PredictionErrorSummary,
} from "@/types/research";

/**
 * Compute a priori prediction errors — population parameters only, no measured levels.
 */
export function computeAPrioriErrors(
  patient: ResearchPatient,
  doses: DosingRecord[],
  levels: LevelRecord[]
): PredictionErrorSummary | null {
  if (levels.length === 0 || doses.length === 0) return null;

  const normalizedPatient: NormalizedPatient = {
    age: patient.age,
    weight_kg: patient.weight_kg,
    height_cm: patient.height_cm,
    sex: patient.sex,
    serum_creatinine_mg_dl: patient.scr_baseline,
  };

  // Use the primary dose as the regimen descriptor
  const primaryDose = doses[0];
  const interval = doses.length >= 2
    ? doses[1].time_hours - doses[0].time_hours
    : 12; // fallback

  const regimen: NormalizedRegimen = {
    dose_mg: primaryDose.dose_mg,
    interval_hours: interval,
    infusion_duration_hours: primaryDose.infusion_duration_min / 60,
  };

  const prior = buildPriorParameters(normalizedPatient, regimen);

  const errors: PredictionError[] = levels.map((level) => {
    // Predict concentration at the level's timepoint using population parameters
    const timeInInterval = level.time_hours % interval;
    const predicted = concentrationAtTime({
      CL: prior.CL,
      V1: prior.V1,
      Q: prior.Q,
      V2: prior.V2,
      dose_mg: primaryDose.dose_mg,
      tau: interval,
      T_inf: primaryDose.infusion_duration_min / 60,
      t: timeInInterval > 0 ? timeInInterval : interval,
    });

    const observed = level.concentration_mcg_ml;
    const pe = observed > 0 ? ((predicted - observed) / observed) * 100 : 0;

    return {
      level_id: level.id,
      observed,
      predicted: Math.round(predicted * 100) / 100,
      pe_percent: Math.round(pe * 10) / 10,
      ape_percent: Math.round(Math.abs(pe) * 10) / 10,
      within_20_pct: Math.abs(pe) <= 20,
    };
  });

  return buildSummary("a_priori", errors);
}

/**
 * Compute a posteriori prediction errors — Bayesian MAP with measured levels.
 */
export function computeAPosterioriErrors(
  patient: ResearchPatient,
  doses: DosingRecord[],
  levels: LevelRecord[]
): PredictionErrorSummary | null {
  if (levels.length === 0 || doses.length === 0) return null;

  const normalizedPatient: NormalizedPatient = {
    age: patient.age,
    weight_kg: patient.weight_kg,
    height_cm: patient.height_cm,
    sex: patient.sex,
    serum_creatinine_mg_dl: patient.scr_baseline,
  };

  const primaryDose = doses[0];
  const interval = doses.length >= 2
    ? doses[1].time_hours - doses[0].time_hours
    : 12;

  const regimen: NormalizedRegimen = {
    dose_mg: primaryDose.dose_mg,
    interval_hours: interval,
    infusion_duration_hours: primaryDose.infusion_duration_min / 60,
  };

  const prior = buildPriorParameters(normalizedPatient, regimen);

  // Normalize observations for the posterior fitting
  const observations = levels.map(l => ({
    time_hours: l.time_hours,
    time_in_interval: l.time_hours % interval || interval,
    concentration: l.concentration_mcg_ml,
  }));

  const fit = fitPosteriorParameters({
    priorCL: prior.CL,
    priorV1: prior.V1,
    priorQ: prior.Q,
    priorV2: prior.V2,
    dose_mg: primaryDose.dose_mg,
    tau: interval,
    T_inf: primaryDose.infusion_duration_min / 60,
    observations,
    omega_CL: prior.omega_CL,
    omega_V1: prior.omega_V1,
    omega_Q: prior.omega_Q,
    omega_V2: prior.omega_V2,
  });

  if (!fit.success) return null;

  const errors: PredictionError[] = levels.map((level) => {
    const timeInInterval = level.time_hours % interval;
    const predicted = concentrationAtTime({
      CL: fit.CL_posterior,
      V1: fit.V1_posterior,
      Q: fit.Q_posterior,
      V2: fit.V2_posterior,
      dose_mg: primaryDose.dose_mg,
      tau: interval,
      T_inf: primaryDose.infusion_duration_min / 60,
      t: timeInInterval > 0 ? timeInInterval : interval,
    });

    const observed = level.concentration_mcg_ml;
    const pe = observed > 0 ? ((predicted - observed) / observed) * 100 : 0;

    return {
      level_id: level.id,
      observed,
      predicted: Math.round(predicted * 100) / 100,
      pe_percent: Math.round(pe * 10) / 10,
      ape_percent: Math.round(Math.abs(pe) * 10) / 10,
      within_20_pct: Math.abs(pe) <= 20,
    };
  });

  return buildSummary("a_posteriori", errors);
}

function buildSummary(
  method: "a_priori" | "a_posteriori",
  errors: PredictionError[]
): PredictionErrorSummary {
  const n = errors.length;
  if (n === 0) {
    return { method, n_levels: 0, mpe: 0, rmse: 0, nrmse: 0, pct_within_20: 0, individual_errors: [] };
  }

  const mpe = errors.reduce((sum, e) => sum + e.pe_percent, 0) / n;
  const meanObserved = errors.reduce((sum, e) => sum + e.observed, 0) / n;

  const squaredErrors = errors.map(e => {
    const diff = e.predicted - e.observed;
    return diff * diff;
  });
  const rmse = Math.sqrt(squaredErrors.reduce((a, b) => a + b, 0) / n);
  const nrmse = meanObserved > 0 ? rmse / meanObserved : 0;

  const within20 = errors.filter(e => e.within_20_pct).length;
  const pct_within_20 = (within20 / n) * 100;

  return {
    method,
    n_levels: n,
    mpe: Math.round(mpe * 10) / 10,
    rmse: Math.round(rmse * 100) / 100,
    nrmse: Math.round(nrmse * 100) / 100,
    pct_within_20: Math.round(pct_within_20 * 10) / 10,
    individual_errors: errors,
  };
}
