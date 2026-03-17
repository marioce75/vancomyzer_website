/**
 * Single source of truth: one-compartment steady-state intermittent infusion.
 * Used by posterior fitting, engine exposure, and recommendation candidate simulation.
 * All AUC24, peak, trough, and curve outputs must come from this module for coherence.
 */

const T_INF_BOLUS_THRESHOLD_H = 0.05;

/** Steady-state concentration at time t (within interval [0, tau]). */
export function steadyStateConcentration(
  t: number,
  Ke: number,
  V: number,
  dose_mg: number,
  tau: number,
  T_inf: number
): number {
  const T_infClamped = Math.min(Math.max(0, T_inf), tau || 1);
  if (T_infClamped < T_INF_BOLUS_THRESHOLD_H) {
    const peak = (dose_mg / V) / (1 - Math.exp(-Ke * tau));
    return peak * Math.exp(-Ke * t);
  }
  const peak =
    (dose_mg / (V * Ke * T_infClamped)) *
    (1 - Math.exp(-Ke * T_infClamped)) /
    (1 - Math.exp(-Ke * tau));
  const trough = peak * Math.exp(-Ke * (tau - T_infClamped));
  if (t <= T_infClamped) {
    return (
      trough * Math.exp(-Ke * t) +
      (dose_mg / (V * Ke * T_infClamped)) * (1 - Math.exp(-Ke * t))
    );
  }
  return peak * Math.exp(-Ke * (t - T_infClamped));
}

export interface ExposureParams {
  Ke: number;
  V: number;
  dose_mg: number;
  tau: number;
  T_inf: number;
}

export interface Exposure {
  auc24: number;
  peak: number;
  trough: number;
}

export function computeExposure(params: ExposureParams): Exposure {
  const { Ke, V, dose_mg, tau, T_inf } = params;
  const T_infClamped = Math.min(Math.max(0, T_inf), tau || 1);

  const auc24 = (dose_mg * (24 / tau)) / (Ke * V);

  let peak: number;
  let trough: number;
  if (T_infClamped < T_INF_BOLUS_THRESHOLD_H) {
    const expKetau = Math.exp(-Ke * tau);
    peak = (dose_mg / V) / (1 - expKetau);
    trough = peak * expKetau;
  } else {
    const expKeTinf = Math.exp(-Ke * T_infClamped);
    const expKetau = Math.exp(-Ke * tau);
    peak =
      (dose_mg / (V * Ke * T_infClamped)) *
      (1 - expKeTinf) /
      (1 - expKetau);
    trough = peak * Math.exp(-Ke * (tau - T_infClamped));
  }

  return { auc24, peak, trough };
}

/** Time within one dosing interval (for t possibly > tau). */
export function timeInInterval(t: number, tau: number): number {
  if (tau <= 0) return 0;
  const n = Math.floor(t / tau);
  return t - n * tau;
}

export function curvePoints(
  params: ExposureParams,
  maxHours: number,
  stepHours: number = 0.5
): { time_hours: number; concentration: number }[] {
  const { Ke, V, dose_mg, tau, T_inf } = params;
  const T_infClamped = Math.min(Math.max(0, T_inf), tau || 1);
  const points: { time_hours: number; concentration: number }[] = [];
  for (let t = 0; t <= maxHours; t += stepHours) {
    const tLocal = timeInInterval(t, tau);
    const c = steadyStateConcentration(
      tLocal,
      Ke,
      V,
      dose_mg,
      tau,
      T_infClamped
    );
    points.push({ time_hours: t, concentration: Math.max(0, c) });
  }
  return points;
}
