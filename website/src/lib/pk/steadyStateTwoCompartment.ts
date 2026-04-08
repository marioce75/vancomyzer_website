export interface TwoCompartmentParameters {
  CL: number; // Clearance (L/h)
  V1: number; // Central volume (L)
  Q: number;  // Intercompartmental clearance (L/h)
  V2: number; // Peripheral volume (L)
}

export interface SteadyStateInput extends TwoCompartmentParameters {
  dose_mg: number;
  tau: number; // dosing interval (hours)
  T_inf: number; // infusion duration (hours)
}

export interface ExposureResult {
  auc24: number;
  peak: number;
  trough: number;
}

export interface CurvePoint {
  time_hours: number;
  concentration: number;
}

function computeConstants({ CL, V1, Q, V2 }: TwoCompartmentParameters) {
  const k10 = CL / V1;
  const k12 = Q / V1;
  const k21 = Q / V2;

  const sum_k = k10 + k12 + k21;
  // Guard: discriminant must be non-negative for real eigenvalues.
  // For physically valid PK parameters this always holds, but clamp to prevent NaN.
  const disc_sq = sum_k * sum_k - 4 * k10 * k21;
  const discriminant = Math.sqrt(Math.max(0, disc_sq));
  
  const alpha = (sum_k + discriminant) / 2;
  const beta = (sum_k - discriminant) / 2;

  const A = (alpha - k21) / (V1 * (alpha - beta));
  const B = (k21 - beta) / (V1 * (alpha - beta));

  return { alpha, beta, A, B };
}

/**
 * Concentration from a single IV infusion dose at time t after that dose was given.
 * Uses the two-compartment biexponential model.
 * t must be >= 0.
 */
function singleDoseConcentration(input: SteadyStateInput, t: number): number {
  if (t < 0) return 0;
  const { dose_mg, T_inf } = input;
  const R0 = dose_mg / T_inf;
  const { alpha, beta, A, B } = computeConstants(input);

  if (t <= T_inf) {
    // During infusion
    return R0 * (
      A / alpha * (1 - Math.exp(-alpha * t)) +
      B / beta  * (1 - Math.exp(-beta  * t))
    );
  } else {
    // After end of infusion
    return R0 * (
      A / alpha * (1 - Math.exp(-alpha * T_inf)) * Math.exp(-alpha * (t - T_inf)) +
      B / beta  * (1 - Math.exp(-beta  * T_inf)) * Math.exp(-beta  * (t - T_inf))
    );
  }
}

export function concentrationAtTime(input: SteadyStateInput & { t: number }): number {
  const { dose_mg, tau, T_inf, t } = input;
  const R0 = dose_mg / T_inf;
  const { alpha, beta, A, B } = computeConstants(input);

  const term = (rate: number, coef: number) => {
    const acc = 1 / (1 - Math.exp(-rate * tau));
    if (t <= T_inf) {
      // During infusion
      const current = coef / rate * (1 - Math.exp(-rate * t));
      const previous = coef / rate * (1 - Math.exp(-rate * T_inf)) * Math.exp(-rate * (t + tau - T_inf)) * acc;
      return R0 * (current + previous);
    } else {
      // After infusion
      return R0 * coef / rate * (1 - Math.exp(-rate * T_inf)) * Math.exp(-rate * (t - T_inf)) * acc;
    }
  };

  return term(alpha, A) + term(beta, B);
}

export function computeExposure(input: SteadyStateInput): ExposureResult {
  const { dose_mg, tau, T_inf, CL } = input;
  const auc24 = (dose_mg / CL) * (24 / tau);
  
  // Peak is at end of infusion
  const peak = concentrationAtTime({ ...input, t: T_inf });
  // Trough is at end of dosing interval
  const trough = concentrationAtTime({ ...input, t: tau });

  return { auc24, peak, trough };
}

/**
 * Generate concentration-time curve points showing multi-dose accumulation to steady state.
 *
 * Unlike concentrationAtTime (which uses steady-state superposition for PK metrics),
 * this function simulates each dose individually and superposes them so the graph
 * correctly shows dose 1, dose 2, ... accumulating toward steady state over time.
 *
 * The number of doses is chosen to cover at least 4 terminal half-lives (t½β),
 * ensuring near-steady-state is visible in the graph.
 */
export function curvePoints(input: SteadyStateInput, step_hours: number = 0.5): CurvePoint[] {
  const { tau } = input;
  const { beta } = computeConstants(input);

  // Determine number of doses needed to show near-steady-state (≥5 half-lives)
  const halfLifeBeta = 0.693 / beta;
  const n_doses = Math.max(10, Math.ceil((5 * halfLifeBeta) / tau) + 2);
  const total_time = n_doses * tau;

  // Build time points: uniform grid + key pharmacokinetic landmarks (end of each infusion, start of each dose)
  const times = new Set<number>();
  for (let t = 0; t <= total_time + 1e-9; t += step_hours) {
    times.add(Math.round(t * 1000) / 1000);
  }
  for (let k = 0; k < n_doses; k++) {
    const doseTime = k * tau;
    times.add(doseTime);
    const endInf = doseTime + input.T_inf;
    if (endInf <= total_time) {
      times.add(endInf);
    }
    // One point just before next dose (trough)
    const preDose = (k + 1) * tau;
    if (preDose <= total_time) {
      times.add(preDose);
    }
  }

  const sortedTimes = Array.from(times).sort((a, b) => a - b);

  const points: CurvePoint[] = [];
  for (const t of sortedTimes) {
    if (t > total_time + 1e-9) break;

    // Superpose contributions from all doses given at or before time t
    let concentration = 0;
    for (let k = 0; k < n_doses; k++) {
      const doseTime = k * tau;
      if (t < doseTime) break; // doses are in order, none later will apply
      concentration += singleDoseConcentration(input, t - doseTime);
    }

    points.push({
      time_hours: t,
      concentration: Math.max(0, concentration),
    });
  }

  return points;
}

/**
 * Generate a concentration-time curve for a loading dose followed by maintenance doses.
 *
 * Dose 1 uses the loading dose parameters (loadDose_mg, loadT_inf).
 * Subsequent doses use the maintenance parameters (maintDose_mg, maintTau, maintT_inf).
 * The maintenance doses start at t = maintTau after the loading dose.
 *
 * This produces a realistic clinical curve showing rapid attainment from
 * the loading dose followed by steady-state accumulation of maintenance.
 */
export function loadingDoseCurvePoints(
  params: TwoCompartmentParameters,
  loadDose_mg: number,
  loadT_inf: number,
  maintDose_mg: number,
  maintTau: number,
  maintT_inf: number,
  step_hours: number = 0.5
): CurvePoint[] {
  const { beta } = computeConstants(params);
  const halfLifeBeta = 0.693 / beta;

  // First maintenance dose starts after the loading dose interval
  const firstMaintTime = maintTau;
  // Ensure enough doses to visibly approach steady state (≥5 half-lives, min 10 maintenance doses)
  const n_maint = Math.max(10, Math.ceil((5 * halfLifeBeta) / maintTau) + 2);
  const total_time = firstMaintTime + n_maint * maintTau;

  // Build dose schedule: [{ time, dose_mg, T_inf }]
  const doseSchedule: { time: number; dose_mg: number; T_inf: number }[] = [];
  // Loading dose at t=0
  doseSchedule.push({ time: 0, dose_mg: loadDose_mg, T_inf: loadT_inf });
  // Maintenance doses
  for (let k = 0; k < n_maint; k++) {
    doseSchedule.push({
      time: firstMaintTime + k * maintTau,
      dose_mg: maintDose_mg,
      T_inf: maintT_inf,
    });
  }

  // Build time grid
  const times = new Set<number>();
  for (let t = 0; t <= total_time + 1e-9; t += step_hours) {
    times.add(Math.round(t * 1000) / 1000);
  }
  for (const d of doseSchedule) {
    times.add(d.time);
    times.add(d.time + d.T_inf); // end of infusion
    // Trough just before next dose
    const idx = doseSchedule.indexOf(d);
    if (idx < doseSchedule.length - 1) {
      times.add(doseSchedule[idx + 1].time);
    }
  }

  const sortedTimes = Array.from(times).sort((a, b) => a - b);
  const points: CurvePoint[] = [];

  for (const t of sortedTimes) {
    if (t > total_time + 1e-9) break;

    let concentration = 0;
    for (const d of doseSchedule) {
      if (t < d.time) break;
      // Create input for this specific dose
      const doseInput: SteadyStateInput = {
        ...params,
        dose_mg: d.dose_mg,
        tau: maintTau, // not used by singleDoseConcentration, but needed for type
        T_inf: d.T_inf,
      };
      concentration += singleDoseConcentration(doseInput, t - d.time);
    }

    points.push({
      time_hours: t,
      concentration: Math.max(0, concentration),
    });
  }

  return points;
}
