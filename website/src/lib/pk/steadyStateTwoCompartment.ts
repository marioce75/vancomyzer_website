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
  const discriminant = Math.sqrt(sum_k * sum_k - 4 * k10 * k21);
  
  const alpha = (sum_k + discriminant) / 2;
  const beta = (sum_k - discriminant) / 2;

  const A = (alpha - k21) / (V1 * (alpha - beta));
  const B = (k21 - beta) / (V1 * (alpha - beta));

  return { alpha, beta, A, B };
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

export function curvePoints(input: SteadyStateInput, max_time: number, step_hours: number = 0.5): CurvePoint[] {
  const points: CurvePoint[] = [];
  // Ensure we capture end of infusion
  const times = new Set<number>();
  for (let t = 0; t <= max_time; t += step_hours) {
    times.add(t);
  }
  
  // Add specific points like T_inf, tau, etc.
  for (let t = 0; t <= max_time; t += input.tau) {
    times.add(t);
    if (t + input.T_inf <= max_time) {
      times.add(t + input.T_inf);
    }
  }

  const sortedTimes = Array.from(times).sort((a, b) => a - b);
  for (const t of sortedTimes) {
    const time_in_interval = t % input.tau;
    // Handle exact modulo landing on 0 except for t=0
    const eff_t = (time_in_interval === 0 && t > 0) ? input.tau : time_in_interval;
    
    points.push({
      time_hours: t,
      concentration: concentrationAtTime({ ...input, t: eff_t })
    });
  }

  return points;
}
