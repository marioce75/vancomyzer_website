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
  /** Lower edge of the credible band at this time (mg/L), when a band was requested. */
  lower?: number;
  /** Upper edge of the credible band at this time (mg/L), when a band was requested. */
  upper?: number;
}

/**
 * Request for a pointwise credible band on a plotted curve: parameter draws
 * (posterior/parameterUncertainty.ts) and the central credible mass.
 */
export interface CredibleBandSpec {
  draws: TwoCompartmentParameters[];
  level: number;
}

/** One administered dose: start time (h from dose 1), amount and infusion duration. */
export interface DoseEvent {
  time: number;
  dose_mg: number;
  T_inf: number;
}

/** Type-7 (linear-interpolated) quantile of an ascending-sorted array. */
function sortedQuantile(sorted: Float64Array, q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Pointwise credible band: every parameter draw is simulated on the same dose
 * schedule and time grid as the plotted curve, and each time point takes the
 * central `level` quantiles across draws. Uses the same biexponential
 * superposition as singleDoseConcentration, with constants precomputed per draw.
 */
function applyCredibleBand(points: CurvePoint[], schedule: DoseEvent[], band: CredibleBandSpec): CurvePoint[] {
  const nDraws = band.draws.length;
  const nTimes = points.length;
  if (nDraws < 20 || nTimes === 0) return points;
  const values = new Float64Array(nDraws * nTimes);
  for (let d = 0; d < nDraws; d++) {
    const { alpha, beta, A, B } = computeConstants(band.draws[d]);
    const doseTerms = schedule.map((ev) => {
      const R0 = ev.dose_mg / ev.T_inf;
      return {
        time: ev.time,
        T_inf: ev.T_inf,
        R0,
        a: (R0 * A) / alpha,
        b: (R0 * B) / beta,
        aEnd: ((R0 * A) / alpha) * (1 - Math.exp(-alpha * ev.T_inf)),
        bEnd: ((R0 * B) / beta) * (1 - Math.exp(-beta * ev.T_inf)),
      };
    });
    for (let i = 0; i < nTimes; i++) {
      const t = points[i].time_hours;
      let c = 0;
      for (const ev of doseTerms) {
        const dt = t - ev.time;
        if (dt < 0) break;
        if (dt <= ev.T_inf) {
          c += ev.a * (1 - Math.exp(-alpha * dt)) + ev.b * (1 - Math.exp(-beta * dt));
        } else {
          const post = dt - ev.T_inf;
          c += ev.aEnd * Math.exp(-alpha * post) + ev.bEnd * Math.exp(-beta * post);
        }
      }
      values[i * nDraws + d] = Number.isFinite(c) ? Math.max(0, c) : 0;
    }
  }
  const qLo = (1 - band.level) / 2;
  const qHi = 1 - qLo;
  return points.map((p, i) => {
    const column = values.subarray(i * nDraws, (i + 1) * nDraws).slice().sort();
    return {
      ...p,
      lower: Math.round(sortedQuantile(column, qLo) * 100) / 100,
      upper: Math.round(sortedQuantile(column, qHi) * 100) / 100,
    };
  });
}

/**
 * Ceilings on the plotted curve. The horizon used to come from the terminal
 * half-life with no bound: at CL 0.0047 L/h (85 y, SCr 10) that asked for 2,253
 * doses, and one request produced two 108,193-point curves spanning 6.18 years
 * in an 11.6 MB response — which the chart then redrew every animation frame.
 *
 * 336 h (14 days) already exceeds the widest zoom the chart offers (168 h), and
 * capping the point count keeps the payload flat regardless of PK parameters.
 * Neither affects a dose: these bound what is drawn, not what is computed.
 */
const MAX_CURVE_HORIZON_HOURS = 336;
const MAX_CURVE_POINTS = 2000;

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
export function singleDoseConcentration(input: SteadyStateInput, t: number): number {
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

/**
 * Area under the concentration-time curve of a SINGLE dose over [from, to]
 * hours, integrated ANALYTICALLY from the biexponential solution (piecewise:
 * during infusion, after infusion). Used for the loading-dose workflow, where
 * the quantity the clinician is shown must be the exposure from the one dose
 * actually given over a fixed 24 h window — independent of any dosing interval,
 * since no second dose has been given to define one.
 *
 * Until 17 Sep 2026 this was a 0.02 h trapezoid, which the independent oracle
 * (src/lib/pk/__tests__/oracle) showed ran 1e-6 to 1.2e-5 relative LOW on
 * every regimen. Analytic integration removes the quadrature error; the
 * closed-form value is exact to floating point.
 */
export function singleDoseAuc(
  input: SteadyStateInput,
  from: number,
  to: number,
): number {
  if (!(to > from)) return 0;
  const { dose_mg, T_inf } = input;
  const R0 = dose_mg / T_inf;
  const { alpha, beta, A, B } = computeConstants(input);
  const a = Math.max(0, from);
  const b = to;
  if (!(b > a)) return 0;

  const termArea = (rate: number, coef: number): number => {
    let area = 0;
    // Infusion segment [a, min(b, T_inf)]
    const a1 = a;
    const b1 = Math.min(b, T_inf);
    if (b1 > a1) {
      area += (b1 - a1) - (Math.exp(-rate * a1) - Math.exp(-rate * b1)) / rate;
    }
    // Post-infusion segment [max(a, T_inf), b]
    const a2 = Math.max(a, T_inf);
    const b2 = b;
    if (b2 > a2) {
      area += ((1 - Math.exp(-rate * T_inf)) / rate) * (Math.exp(-rate * (a2 - T_inf)) - Math.exp(-rate * (b2 - T_inf)));
    }
    return (coef / rate) * area;
  };

  return R0 * (termArea(alpha, A) + termArea(beta, B));
}

/**
 * Concentration after exactly `doses_given` doses of the same regimen, at
 * `t_since_last_dose` hours after the START of the most recent infusion,
 * by superposition of the single-dose solution (dose k was given k·tau hours
 * before the most recent one). This is the ACTUAL-HISTORY horizon.
 */
export function finiteHistoryConcentration(
  input: SteadyStateInput,
  doses_given: number,
  t_since_last_dose: number,
): number {
  const n = Math.max(1, Math.floor(doses_given));
  let total = 0;
  for (let k = 0; k < n; k++) {
    total += singleDoseConcentration(input, t_since_last_dose + k * input.tau);
  }
  return total;
}

export interface FiniteHistoryExposure {
  doses_given: number;
  /** Concentration at the end of the infusion of dose N. */
  peak: number;
  /** Concentration at the end of the Nth dosing interval (just before dose N+1). */
  trough: number;
  /** AUC over the Nth dosing interval (mg·h/L) — NOT a daily AUC. */
  auc_interval_n: number;
  /** AUC over the first 24 h after dose 1 (mg·h/L) — first-day exposure. */
  auc_0_24h: number;
}

/**
 * Exposure for the ACTUAL-HISTORY horizon: exactly `doses_given` doses,
 * evaluated analytically (never read off the plotted curve grid). Reported
 * beside — never mixed with — the steady-state projection.
 */
export function finiteHistoryExposure(input: SteadyStateInput, doses_given: number): FiniteHistoryExposure {
  const n = Math.max(1, Math.floor(doses_given));
  const { tau, T_inf } = input;
  const peak = finiteHistoryConcentration(input, n, T_inf);
  const trough = finiteHistoryConcentration(input, n, tau);
  // AUC over the Nth interval = sum over doses k of the single-dose AUC of dose k
  // over the window it sees: dose k (k = 0 most recent) contributes its
  // single-dose AUC over [k·tau, (k+1)·tau].
  let aucIntervalN = 0;
  for (let k = 0; k < n; k++) {
    aucIntervalN += singleDoseAuc(input, k * tau, (k + 1) * tau);
  }
  // First 24 h after dose 1: doses given at 0, tau, 2tau, … within 24 h.
  let auc0_24 = 0;
  for (let k = 0; k < n; k++) {
    const doseTime = k * tau;
    if (doseTime >= 24) break;
    auc0_24 += singleDoseAuc(input, 0, 24 - doseTime);
  }
  return { doses_given: n, peak, trough, auc_interval_n: aucIntervalN, auc_0_24h: auc0_24 };
}

/** Steady-state concentration at t hours after the start of an infusion (0 ≤ t ≤ tau). */
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

/**
 * Terminal (beta-phase) half-life in hours. This is the patient's own
 * accumulation timescale, derived from the smaller eigenvalue of the
 * two-compartment system.
 */
export function terminalHalfLifeHours(params: TwoCompartmentParameters): number {
  const { beta } = computeConstants(params);
  if (!(beta > 0) || !Number.isFinite(beta)) return Infinity;
  return Math.LN2 / beta;
}

/**
 * Steady-state exposure of a regimen — THE canonical function. Every number
 * labelled "steady state" anywhere (current row, candidate rows, band, graph
 * landmarks, interpretation, note, PDF) must come from here with the same
 * parameters, dose, interval and infusion duration.
 *
 * The former isSteadyStateRegimen() predicate (dose count + half-lives) lived
 * here and silently changed which horizon the engine reported; horizon is now
 * decided once in exposureHorizon.ts and the half-life check is an advisory.
 */
export function computeExposure(input: SteadyStateInput): ExposureResult {
  const { dose_mg, tau, T_inf, CL } = input;
  // Linear PK at steady state: daily AUC = daily dose / CL.
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
export function curvePoints(input: SteadyStateInput, step_hours: number = 0.5, band?: CredibleBandSpec): CurvePoint[] {
  const { tau } = input;
  const { beta } = computeConstants(input);

  // Determine number of doses needed to show near-steady-state (≥5 half-lives),
  // then bound it — see MAX_CURVE_HORIZON_HOURS.
  const halfLifeBeta = 0.693 / beta;
  const idealDoses = Math.max(10, Math.ceil((5 * halfLifeBeta) / tau) + 2);
  const n_doses = Math.min(idealDoses, Math.max(1, Math.ceil(MAX_CURVE_HORIZON_HOURS / tau)));
  const total_time = n_doses * tau;
  const step = Math.max(step_hours, total_time / MAX_CURVE_POINTS);

  // Build time points: uniform grid + key pharmacokinetic landmarks (end of each infusion, start of each dose)
  const times = new Set<number>();
  for (let t = 0; t <= total_time + 1e-9; t += step) {
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

  if (band) {
    const schedule: DoseEvent[] = Array.from({ length: n_doses }, (_, k) => ({
      time: k * tau,
      dose_mg: input.dose_mg,
      T_inf: input.T_inf,
    }));
    return applyCredibleBand(points, schedule, band);
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
  step_hours: number = 0.5,
  band?: CredibleBandSpec,
  /** Start of the first maintenance dose, hours after the loading dose starts (default maintTau). */
  firstMaintenanceHours?: number,
): CurvePoint[] {
  const { beta } = computeConstants(params);
  const halfLifeBeta = 0.693 / beta;

  // First maintenance dose starts after the loading dose interval
  const firstMaintTime = firstMaintenanceHours !== undefined && firstMaintenanceHours > 0 ? firstMaintenanceHours : maintTau;
  // Ensure enough doses to visibly approach steady state (≥5 half-lives, min 10
  // maintenance doses), bounded by MAX_CURVE_HORIZON_HOURS.
  const idealMaint = Math.max(10, Math.ceil((5 * halfLifeBeta) / maintTau) + 2);
  const n_maint = Math.min(
    idealMaint,
    Math.max(1, Math.ceil(Math.max(0, MAX_CURVE_HORIZON_HOURS - firstMaintTime) / maintTau)),
  );
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

  // Build time grid, with the point count bounded the same way.
  const step = Math.max(step_hours, total_time / MAX_CURVE_POINTS);
  const times = new Set<number>();
  for (let t = 0; t <= total_time + 1e-9; t += step) {
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

  if (band) return applyCredibleBand(points, doseSchedule, band);
  return points;
}

/** Alias with the horizon in the name, for call sites that must be explicit. */
export const steadyStateExposure = computeExposure;
