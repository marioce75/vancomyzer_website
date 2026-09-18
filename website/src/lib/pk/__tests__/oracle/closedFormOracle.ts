/**
 * INDEPENDENT closed-form oracle for the vancomycin two-compartment PK engine.
 *
 * This file imports NOTHING from src/lib/pk (other than living in its test
 * tree). Every formula is re-derived below from the primary equations so that
 * it can serve as a reference against which the production engine
 * (steadyStateTwoCompartment.ts, posterior/buildPriorParameters.ts) is checked.
 *
 * Source model: Colin PJ et al. Clin Pharmacokinet. 2019;58(6):767-780.
 *               DOI 10.1007/s40262-018-0727-5
 *
 * Units: mg, L, h, mg/L (== mcg/mL), SCr mg/dL, age years.
 *
 * ── Derivation ──────────────────────────────────────────────────────────────
 * State: A1 (central amount), A2 (peripheral amount), input R(t) into central.
 *   dA1/dt = R(t) - (k10 + k12) A1 + k21 A2
 *   dA2/dt = k12 A1 - k21 A2
 *   k10 = CL/V1, k12 = Q/V1, k21 = Q/V2, C = A1/V1
 *
 * Eigenvalues of the homogeneous system are -alpha, -beta with
 *   alpha + beta = k10 + k12 + k21 =: s
 *   alpha * beta = k10 * k21
 *   alpha, beta = (s ± sqrt(s^2 - 4 k10 k21)) / 2
 * The discriminant is written in the cancellation-free form
 *   s^2 - 4 k10 k21 = (k10 - k21)^2 + k12^2 + 2 k12 (k10 + k21)   (>= 0 always)
 *
 * Unit bolus response of the central compartment (mg/L per mg):
 *   c1(t) = [ (alpha - k21) e^{-alpha t} + (k21 - beta) e^{-beta t} ] / (V1 (alpha - beta))
 *        =: Ca e^{-alpha t} + Cb e^{-beta t}
 * (check: c1(0) = 1/V1; dc1/dt(0) = -(k10 + k12)/V1 as required by the ODE with A2(0)=0.)
 * Peripheral unit bolus response (mg per mg):
 *   a2(t) = k12 (e^{-beta t} - e^{-alpha t}) / (alpha - beta)
 *
 * A constant infusion R0 = D/T_inf for 0 <= t <= T_inf is the convolution of the
 * bolus response with the rate:
 *   C(t)  = R0 Σ_i (Ci/λi) (1 - e^{-λi t})                          t <= T_inf
 *   C(t)  = R0 Σ_i (Ci/λi) (1 - e^{-λi T_inf}) e^{-λi (t - T_inf)}  t >  T_inf
 * Cumulative AUC from 0 (analytic integral of the above):
 *   AUC(t) = R0 Σ_i (Ci/λi) [ t - (1 - e^{-λi t})/λi ]              t <= T_inf
 *   AUC(t) = AUC(T_inf) + R0 Σ_i (Ci/λi)(1 - e^{-λi T_inf})(1 - e^{-λi (t-T_inf)})/λi
 *
 * Multiple doses: linear system ⇒ superposition of shifted single doses.
 * Steady state for a regular train (interval tau): sum over all previous doses
 * of the post-infusion tail is a geometric series,
 *   Σ_{n>=1} e^{-λ n tau} = e^{-λ tau} / (1 - e^{-λ tau}),
 * so within an interval (0 <= t < tau):
 *   Css(t) = C_single(t) + R0 Σ_i (Ci/λi)(1 - e^{-λi T_inf}) e^{-λi (t - T_inf)} e^{-λi tau}/(1 - e^{-λi tau})
 * which for t >= T_inf collapses to C_single(t) / (1 - e^{-λi tau}) termwise.
 */

export interface OracleParams {
  CL: number;
  V1: number;
  Q: number;
  V2: number;
}

export interface OracleDose {
  time: number; // h, start of infusion
  dose_mg: number;
  T_inf: number; // h
}

interface Macro {
  alpha: number;
  beta: number;
  Ca: number; // coefficient of e^{-alpha t} in unit-bolus central concentration
  Cb: number;
  k12: number;
  discriminantSq: number;
}

export function macroConstants(p: OracleParams): Macro {
  const k10 = p.CL / p.V1;
  const k12 = p.Q / p.V1;
  const k21 = p.Q / p.V2;
  const s = k10 + k12 + k21;
  const discriminantSq = (k10 - k21) * (k10 - k21) + k12 * k12 + 2 * k12 * (k10 + k21);
  const d = Math.sqrt(discriminantSq);
  const alpha = (s + d) / 2;
  // beta via the product identity alpha*beta = k10*k21 avoids cancellation in (s - d)/2
  const beta = (k10 * k21) / alpha;
  const Ca = (alpha - k21) / (p.V1 * (alpha - beta));
  const Cb = (k21 - beta) / (p.V1 * (alpha - beta));
  return { alpha, beta, Ca, Cb, k12, discriminantSq };
}

export function terminalHalfLife(p: OracleParams): number {
  return Math.LN2 / macroConstants(p).beta;
}

/** Concentration (mg/L) at time t (h) after the START of a single infusion. */
export function singleDoseC(p: OracleParams, dose_mg: number, T_inf: number, t: number): number {
  if (t <= 0) return 0;
  const { alpha, beta, Ca, Cb } = macroConstants(p);
  const R0 = dose_mg / T_inf;
  const term = (C: number, l: number): number =>
    t <= T_inf
      ? (C / l) * (1 - Math.exp(-l * t))
      : (C / l) * (1 - Math.exp(-l * T_inf)) * Math.exp(-l * (t - T_inf));
  return R0 * (term(Ca, alpha) + term(Cb, beta));
}

/** Peripheral amount (mg) at time t after the start of a single infusion. */
export function singleDoseA2(p: OracleParams, dose_mg: number, T_inf: number, t: number): number {
  if (t <= 0) return 0;
  const { alpha, beta, k12 } = macroConstants(p);
  const R0 = dose_mg / T_inf;
  const g = (l: number): number =>
    t <= T_inf
      ? (1 - Math.exp(-l * t)) / l
      : ((1 - Math.exp(-l * T_inf)) * Math.exp(-l * (t - T_inf))) / l;
  return (R0 * k12 * (g(beta) - g(alpha))) / (alpha - beta);
}

/** Cumulative AUC (mg·h/L) from 0 to t for a single infusion. Analytic. */
export function singleDoseCumAuc(p: OracleParams, dose_mg: number, T_inf: number, t: number): number {
  if (t <= 0) return 0;
  const { alpha, beta, Ca, Cb } = macroConstants(p);
  const R0 = dose_mg / T_inf;
  const term = (C: number, l: number): number => {
    const tin = Math.min(t, T_inf);
    let a = (C / l) * (tin - (1 - Math.exp(-l * tin)) / l);
    if (t > T_inf) {
      a += (C / l) * (1 - Math.exp(-l * T_inf)) * ((1 - Math.exp(-l * (t - T_inf))) / l);
    }
    return a;
  };
  return R0 * (term(Ca, alpha) + term(Cb, beta));
}

export function singleDoseAucWindow(p: OracleParams, dose_mg: number, T_inf: number, from: number, to: number): number {
  return singleDoseCumAuc(p, dose_mg, T_inf, to) - singleDoseCumAuc(p, dose_mg, T_inf, from);
}

// ── Arbitrary schedule by superposition ─────────────────────────────────────

export function scheduleC(p: OracleParams, schedule: OracleDose[], t: number): number {
  let c = 0;
  for (const d of schedule) if (t > d.time) c += singleDoseC(p, d.dose_mg, d.T_inf, t - d.time);
  return c;
}

export function scheduleA2(p: OracleParams, schedule: OracleDose[], t: number): number {
  let a = 0;
  for (const d of schedule) if (t > d.time) a += singleDoseA2(p, d.dose_mg, d.T_inf, t - d.time);
  return a;
}

export function scheduleCumAuc(p: OracleParams, schedule: OracleDose[], t: number): number {
  let a = 0;
  for (const d of schedule) if (t > d.time) a += singleDoseCumAuc(p, d.dose_mg, d.T_inf, t - d.time);
  return a;
}

export function scheduleAucWindow(p: OracleParams, schedule: OracleDose[], from: number, to: number): number {
  return scheduleCumAuc(p, schedule, to) - scheduleCumAuc(p, schedule, from);
}

export function regularTrain(dose_mg: number, tau: number, T_inf: number, n: number): OracleDose[] {
  const out: OracleDose[] = [];
  for (let k = 0; k < n; k++) out.push({ time: k * tau, dose_mg, T_inf });
  return out;
}

// ── Steady state by geometric accumulation ──────────────────────────────────

/**
 * Steady-state concentration at time t (0 <= t <= tau) after the start of an
 * infusion in an infinite regular train. t = tau is the pre-dose trough of the
 * next dose (equals Css(0) by periodicity).
 */
export function steadyStateC(p: OracleParams, dose_mg: number, tau: number, T_inf: number, t: number): number {
  const { alpha, beta, Ca, Cb } = macroConstants(p);
  const R0 = dose_mg / T_inf;
  const tail = (C: number, l: number): number => {
    const acc = Math.exp(-l * tau) / (1 - Math.exp(-l * tau)); // Σ_{n>=1} e^{-l n tau}
    return (C / l) * (1 - Math.exp(-l * T_inf)) * Math.exp(-l * (t - T_inf)) * acc;
  };
  return singleDoseC(p, dose_mg, T_inf, t) + R0 * (tail(Ca, alpha) + tail(Cb, beta));
}

/** Analytic AUC of the steady-state profile over [from, to], 0 <= from <= to <= tau. */
export function steadyStateAucWindow(p: OracleParams, dose_mg: number, tau: number, T_inf: number, from: number, to: number): number {
  const { alpha, beta, Ca, Cb } = macroConstants(p);
  const R0 = dose_mg / T_inf;
  const tailInt = (C: number, l: number): number => {
    const acc = Math.exp(-l * tau) / (1 - Math.exp(-l * tau));
    // ∫_{from}^{to} e^{-l (t - T_inf)} dt = (e^{-l (from - T_inf)} - e^{-l (to - T_inf)}) / l
    const integral = (Math.exp(-l * (from - T_inf)) - Math.exp(-l * (to - T_inf))) / l;
    return (C / l) * (1 - Math.exp(-l * T_inf)) * acc * integral;
  };
  return singleDoseAucWindow(p, dose_mg, T_inf, from, to) + R0 * (tailInt(Ca, alpha) + tailInt(Cb, beta));
}

export function steadyStateExposure(p: OracleParams, dose_mg: number, tau: number, T_inf: number) {
  const aucTau = steadyStateAucWindow(p, dose_mg, tau, T_inf, 0, tau);
  return {
    peak: steadyStateC(p, dose_mg, tau, T_inf, T_inf),
    trough: steadyStateC(p, dose_mg, tau, T_inf, tau),
    aucTau,
    auc24: (aucTau * 24) / tau,
  };
}

// ── Colin 2019 covariate model ──────────────────────────────────────────────

export interface ColinPatient {
  age: number; // years
  weight_kg: number;
  scr_mg_dl: number;
}

export function colinPrior(pt: ColinPatient): OracleParams & { FMat: number; FDecline: number; SCRstd: number; FSCR: number } {
  const PMA = pt.age + 40 / 52;
  const PMAwk = PMA * 52;
  const FSize = pt.weight_kg / 70;
  const FMat = Math.pow(PMAwk, 2.89) / (Math.pow(PMAwk, 2.89) + Math.pow(46.4, 2.89));
  const FDecline = 1 / (1 + Math.pow(PMA / 61.6, 2.24));
  const SCRstd = Math.exp(-1.228 + 0.672 * Math.log10(PMA) + 6.27 * Math.exp(-3.11 * PMA));
  const FSCR = Math.exp(-0.649 * (pt.scr_mg_dl - SCRstd));
  return {
    CL: 5.31 * Math.pow(FSize, 0.75) * FMat * FDecline * FSCR,
    V1: 42.9 * FSize,
    V2: 41.7 * FSize,
    Q: 3.22 * Math.pow(FSize, 0.75),
    FMat,
    FDecline,
    SCRstd,
    FSCR,
  };
}
