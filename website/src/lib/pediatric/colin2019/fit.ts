/**
 * Bayesian (MAP) individual estimation for the Colin 2019 pediatric preview.
 *
 * Objective, minimised over η = (η_CL, η_V1, η_V2) — Q has no η in the final model:
 *
 *   −2LL-equivalent / 2 =  Σ_i [ ½·ln(2π·var_i) + ½·(y_i − f_i)²/var_i ]  +  Σ_k η_k² / (2·ω_k²)
 *   var_i = σ²_prop · f_i² + σ²_add               (published residual model: Y = F·(1+ε1) + ε2)
 *
 * f_i is the two-compartment prediction from the ACTUAL dose history
 * (superposition of every recorded infusion, src/lib/pk/doseHistory.ts).
 *
 * Posterior uncertainty: the credible intervals come from deterministic
 * importance sampling of the EXACT posterior p(η|y) ∝ L(y|η)·N(η;0,Ω) with a
 * defensive mixture proposal (½ prior + ½ inflated Laplace normal at the MAP),
 * weighted draws pushed through the model by the caller. The Laplace
 * approximation (covariance = inverse numerical Hessian at the MAP) is still
 * computed and reported as a diagnostic (η SDs) and used in the proposal; its
 * intervals were 14-16 % too narrow and centred 4 % low in the synthetic study
 * (docs/pediatric/INTERVAL-COVERAGE.md). The population-only ("prior")
 * uncertainty uses draws from N(0, Ω).
 */

import { concentrationFromHistory } from "@/lib/pk/doseHistory";
import type { DoseEvent, TwoCompartmentParameters } from "@/lib/pk/steadyStateTwoCompartment";
import { COLIN_2019_NONMEM_FINAL as N, type Colin2019Formulation } from "./manifest";
import { individualParameters, type Eta, type PediatricCovariates } from "./prior";

export interface Observation {
  /** Hours after the start of dose 1. */
  timeHours: number;
  /** Measured concentration, mg/L. */
  concentration: number;
}

export interface FitInput {
  covariates: PediatricCovariates;
  formulation: Colin2019Formulation;
  schedule: DoseEvent[];
  observations: Observation[];
}

export interface PredictedAtObservation {
  timeHours: number;
  observed: number;
  predicted: number;
  residual: number;
  sigma: number;
  standardisedResidual: number;
}

export interface FitResult {
  success: boolean;
  eta: Eta;
  parameters: TwoCompartmentParameters;
  objective: number;
  objectiveComponents: { nll: number; priorPenalty: number };
  iterations: number;
  converged: boolean;
  starts: number;
  /** Laplace covariance of η (order CL, V1, V2) or null when the Hessian is not positive definite. */
  etaCovariance: number[][] | null;
  etaSd: { CL: number; V1: number; V2: number } | null;
  predictedAtObservations: PredictedAtObservation[];
  warnings: string[];
}

export const OMEGA_SD = {
  CL: Math.sqrt(N.omega.CL),
  V1: Math.sqrt(N.omega.V1),
  V2: Math.sqrt(N.omega.V2),
} as const;

export const SIGMA = {
  proportionalSd: Math.sqrt(N.sigma.proportionalVariance),
  additiveSd: Math.sqrt(N.sigma.additiveVariance),
} as const;

export const FIT_SETTINGS = {
  maxIterations: 800,
  tolerance: 1e-10,
  hessianStep: 0.02,
  etaBound: 5, // |η| beyond this is treated as a failed/implausible fit
} as const;

export function residualVariance(predicted: number): number {
  return N.sigma.proportionalVariance * predicted * predicted + N.sigma.additiveVariance;
}

function etaFromVector(v: number[]): Eta {
  return { CL: v[0], V1: v[1], V2: v[2] };
}

export function objectiveAt(etaVec: number[], input: FitInput): { total: number; nll: number; priorPenalty: number; perObservation: PredictedAtObservation[] } {
  const eta = etaFromVector(etaVec);
  const p = individualParameters(input.covariates, eta, input.formulation);
  let nll = 0;
  const perObservation = input.observations.map((o) => {
    const f = concentrationFromHistory(p, input.schedule, o.timeHours);
    const v = residualVariance(f);
    const r = o.concentration - f;
    nll += 0.5 * Math.log(2 * Math.PI * v) + (0.5 * r * r) / v;
    return { timeHours: o.timeHours, observed: o.concentration, predicted: f, residual: r, sigma: Math.sqrt(v), standardisedResidual: r / Math.sqrt(v) };
  });
  const priorPenalty = (eta.CL * eta.CL) / (2 * N.omega.CL) + (eta.V1 * eta.V1) / (2 * N.omega.V1) + (eta.V2 * eta.V2) / (2 * N.omega.V2);
  return { total: nll + priorPenalty, nll, priorPenalty, perObservation };
}

/** Nelder–Mead on a 3-vector. Returns best vertex, iterations and convergence. */
function nelderMead(start: number[], f: (x: number[]) => number, step = 0.4): { x: number[]; iterations: number; converged: boolean } {
  const n = start.length;
  let simplex = [start.slice()];
  for (let i = 0; i < n; i++) {
    const v = start.slice();
    v[i] += step;
    simplex.push(v);
  }
  let scores = simplex.map(f);
  let converged = false;
  let it = 0;
  for (; it < FIT_SETTINGS.maxIterations; it++) {
    const order = simplex.map((_, i) => i).sort((a, b) => scores[a] - scores[b]);
    simplex = order.map((i) => simplex[i]);
    scores = order.map((i) => scores[i]);
    const spread = Math.max(...simplex.map((v) => Math.max(...v.map((x, j) => Math.abs(x - simplex[0][j])))));
    if (scores[n] - scores[0] < FIT_SETTINGS.tolerance && spread < 1e-6) {
      converged = true;
      break;
    }
    const centroid = Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) centroid[j] += simplex[i][j] / n;
    const worst = simplex[n];
    const reflected = centroid.map((c, j) => c + (c - worst[j]));
    const fr = f(reflected);
    if (fr < scores[0]) {
      const expanded = centroid.map((c, j) => c + 2 * (reflected[j] - c));
      const fe = f(expanded);
      if (fe < fr) { simplex[n] = expanded; scores[n] = fe; } else { simplex[n] = reflected; scores[n] = fr; }
      continue;
    }
    if (fr < scores[n - 1]) { simplex[n] = reflected; scores[n] = fr; continue; }
    const outside = fr < scores[n];
    const contracted = outside
      ? centroid.map((c, j) => c + 0.5 * (reflected[j] - c))
      : centroid.map((c, j) => c + 0.5 * (worst[j] - c));
    const fc = f(contracted);
    if (fc < (outside ? fr : scores[n])) { simplex[n] = contracted; scores[n] = fc; continue; }
    for (let i = 1; i <= n; i++) {
      simplex[i] = simplex[i].map((x, j) => simplex[0][j] + 0.5 * (x - simplex[0][j]));
      scores[i] = f(simplex[i]);
    }
  }
  const best = scores.indexOf(Math.min(...scores));
  return { x: simplex[best], iterations: it, converged };
}

/** Numerical Hessian (central differences) of f at x. */
export function numericalHessian(x: number[], f: (v: number[]) => number, h = FIT_SETTINGS.hessianStep): number[][] {
  const n = x.length;
  const H: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const f0 = f(x);
  for (let i = 0; i < n; i++) {
    const xp = x.slice(); xp[i] += h;
    const xm = x.slice(); xm[i] -= h;
    H[i][i] = (f(xp) - 2 * f0 + f(xm)) / (h * h);
    for (let j = i + 1; j < n; j++) {
      const pp = x.slice(); pp[i] += h; pp[j] += h;
      const pm = x.slice(); pm[i] += h; pm[j] -= h;
      const mp = x.slice(); mp[i] -= h; mp[j] += h;
      const mm = x.slice(); mm[i] -= h; mm[j] -= h;
      H[i][j] = H[j][i] = (f(pp) - f(pm) - f(mp) + f(mm)) / (4 * h * h);
    }
  }
  return H;
}

/** Lower Cholesky factor or null if not positive definite. */
export function cholesky(m: number[][]): number[][] | null {
  const n = m.length;
  const L: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = m[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (!(s > 0) || !Number.isFinite(s)) return null;
        L[i][i] = Math.sqrt(s);
      } else L[i][j] = s / L[j][j];
    }
  }
  return L;
}

/** Inverse of a symmetric positive-definite matrix via Cholesky; null if not SPD. */
export function spdInverse(m: number[][]): number[][] | null {
  const L = cholesky(m);
  if (!L) return null;
  const n = m.length;
  // Solve L·Y = I, then Lᵀ·X = Y.
  const inv: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let col = 0; col < n; col++) {
    const y = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = i === col ? 1 : 0;
      for (let k = 0; k < i; k++) s -= L[i][k] * y[k];
      y[i] = s / L[i][i];
    }
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i];
      for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k];
      x[i] = s / L[i][i];
    }
    for (let i = 0; i < n; i++) inv[i][col] = x[i];
  }
  // Symmetrise against round-off.
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const v = 0.5 * (inv[i][j] + inv[j][i]); inv[i][j] = inv[j][i] = v; }
  return inv;
}

export function fitEta(input: FitInput): FitResult {
  const warnings: string[] = [];
  const f = (v: number[]) => {
    if (v.some((x) => !Number.isFinite(x) || Math.abs(x) > 12)) return Number.POSITIVE_INFINITY;
    return objectiveAt(v, input).total;
  };
  const starts: number[][] = [
    [0, 0, 0],
    [0.6, 0, 0], [-0.6, 0, 0],
    [0, 0.5, 0], [0, -0.5, 0],
    [0.5, 0.5, 0.5], [-0.5, -0.5, -0.5],
    [-0.9, 0.4, 0.4], [0.9, -0.4, -0.4],
  ];
  let best: { x: number[]; iterations: number; converged: boolean } | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const s of starts) {
    const run = nelderMead(s, f);
    const score = f(run.x);
    if (score < bestScore) { bestScore = score; best = run; }
  }
  if (!best || !Number.isFinite(bestScore)) {
    const typical = individualParameters(input.covariates, { CL: 0, V1: 0, V2: 0 }, input.formulation);
    return {
      success: false, eta: { CL: 0, V1: 0, V2: 0 }, parameters: typical, objective: Number.NaN,
      objectiveComponents: { nll: Number.NaN, priorPenalty: Number.NaN }, iterations: 0, converged: false, starts: starts.length,
      etaCovariance: null, etaSd: null, predictedAtObservations: objectiveAt([0, 0, 0], input).perObservation,
      warnings: ["The posterior fit did not produce a finite objective; results remain on the population prior."],
    };
  }
  // Polish from the best vertex with a smaller simplex.
  const polished = nelderMead(best.x, f, 0.05);
  const x = f(polished.x) <= bestScore ? polished.x : best.x;
  const eta = etaFromVector(x);
  const comps = objectiveAt(x, input);
  const outOfBound = Math.max(Math.abs(eta.CL), Math.abs(eta.V1), Math.abs(eta.V2)) > FIT_SETTINGS.etaBound;
  for (const k of ["CL", "V1", "V2"] as const) {
    const z = Math.abs(eta[k]) / OMEGA_SD[k];
    if (z > 3) warnings.push(`η_${k} = ${eta[k].toFixed(2)} is ${z.toFixed(1)} population SDs from zero (beyond 99.7% of the Colin 2019 population): the levels disagree strongly with the dose history or the model. Check timing, units and dose entries.`);
  }
  if (outOfBound) warnings.push("An η estimate exceeds ±5 (over 150-fold from the population value): the levels are inconsistent with the dose history or the model. Check timing, units and the recorded doses.");
  const H = numericalHessian(x, f);
  const cov = spdInverse(H);
  if (!cov) warnings.push("The posterior curvature is not positive definite at the optimum, so no credible interval is reported.");
  const etaSd = cov ? { CL: Math.sqrt(cov[0][0]), V1: Math.sqrt(cov[1][1]), V2: Math.sqrt(cov[2][2]) } : null;
  if (!best.converged && !polished.converged) warnings.push("The optimiser reached its iteration limit; the reported optimum may be imprecise.");
  return {
    success: !outOfBound,
    eta,
    parameters: individualParameters(input.covariates, eta, input.formulation),
    objective: comps.total,
    objectiveComponents: { nll: comps.nll, priorPenalty: comps.priorPenalty },
    iterations: best.iterations + polished.iterations,
    converged: best.converged || polished.converged,
    starts: starts.length,
    etaCovariance: cov,
    etaSd,
    predictedAtObservations: comps.perObservation,
    warnings,
  };
}

// ── Deterministic random draws ───────────────────────────────────────────────

/** Small deterministic PRNG (mulberry32) so identical inputs give identical intervals. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function standardNormal(rng: () => number): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const DRAW_SEED = 20191106;
export const N_DRAWS = 1000;

/** η draws from N(mean, cov) (cov SPD) or N(0, Ω) when cov is omitted. */
export function drawEta(mean: Eta, cov: number[][] | null, n = N_DRAWS, seed = DRAW_SEED): Eta[] {
  const rng = makeRng(seed);
  const L = cov ? cholesky(cov) : [[OMEGA_SD.CL, 0, 0], [0, OMEGA_SD.V1, 0], [0, 0, OMEGA_SD.V2]];
  if (!L) return [];
  const out: Eta[] = [];
  for (let i = 0; i < n; i++) {
    const z = [standardNormal(rng), standardNormal(rng), standardNormal(rng)];
    out.push({
      CL: mean.CL + L[0][0] * z[0],
      V1: mean.V1 + L[1][0] * z[0] + L[1][1] * z[1],
      V2: mean.V2 + L[2][0] * z[0] + L[2][1] * z[1] + L[2][2] * z[2],
    });
  }
  return out;
}

export function quantile(sortedAscending: number[], q: number): number {
  if (sortedAscending.length === 0) return Number.NaN;
  const pos = (sortedAscending.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sortedAscending[lo] + (sortedAscending[hi] - sortedAscending[lo]) * (pos - lo);
}

export interface Interval {
  median: number;
  lower: number;
  upper: number;
  level: number;
  n: number;
}

export function summariseDraws(values: number[], level = 0.9): Interval {
  const s = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const q = (1 - level) / 2;
  return { median: quantile(s, 0.5), lower: quantile(s, q), upper: quantile(s, 1 - q), level, n: s.length };
}

// ── Exact-posterior importance sampling ──────────────────────────────────────

export const IS_DRAWS = 4000;
export const IS_LAPLACE_INFLATION = 1.5;
export const IS_PRIOR_FRACTION = 0.5;
export const IS_MIN_ESS = 200;

export interface WeightedDraws {
  etas: Eta[];
  /** Normalised importance weights (sum to 1). */
  weights: number[];
  effectiveSampleSize: number;
  method: "importance_sampling_mixture" | "importance_sampling_prior";
}

const LOG_2PI = Math.log(2 * Math.PI);

function logPrior(e: Eta): number {
  return -0.5 * ((e.CL * e.CL) / N.omega.CL + (e.V1 * e.V1) / N.omega.V1 + (e.V2 * e.V2) / N.omega.V2) - 0.5 * Math.log(N.omega.CL * N.omega.V1 * N.omega.V2) - 1.5 * LOG_2PI;
}

/**
 * Deterministic importance sampling of p(η|y) for a fitted individual.
 * Proposal q = f·N(0,Ω) + (1−f)·N(η_MAP, c²·Σ_Laplace) when the Laplace
 * covariance exists, otherwise the prior alone. Weight = L(y|η)·prior/q.
 */
export function posteriorDraws(fit: FitResult, input: FitInput, n = IS_DRAWS, seed = DRAW_SEED): WeightedDraws {
  const rng = makeRng(seed + 7);
  const cov = fit.etaCovariance;
  const H = cov ? spdInverse(cov) : null; // precision of the Laplace normal
  const Lc = cov ? cholesky(cov.map((row) => row.map((v) => v * IS_LAPLACE_INFLATION * IS_LAPLACE_INFLATION))) : null;
  const useMixture = !!(cov && H && Lc);
  const c2 = IS_LAPLACE_INFLATION * IS_LAPLACE_INFLATION;
  const logDetLap = Lc ? 2 * (Math.log(Lc[0][0]) + Math.log(Lc[1][1]) + Math.log(Lc[2][2])) : 0; // log det(c²Σ)
  const logLaplace = (e: Eta): number => {
    const d = [e.CL - fit.eta.CL, e.V1 - fit.eta.V1, e.V2 - fit.eta.V2];
    let q = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) q += d[i] * (H as number[][])[i][j] * d[j];
    return -0.5 * q / c2 - 0.5 * logDetLap - 1.5 * LOG_2PI;
  };
  const etas: Eta[] = [];
  const logw: number[] = [];
  for (let i = 0; i < n; i++) {
    const fromPrior = !useMixture || rng() < IS_PRIOR_FRACTION;
    const z = [standardNormal(rng), standardNormal(rng), standardNormal(rng)];
    const e: Eta = fromPrior
      ? { CL: OMEGA_SD.CL * z[0], V1: OMEGA_SD.V1 * z[1], V2: OMEGA_SD.V2 * z[2] }
      : { CL: fit.eta.CL + (Lc as number[][])[0][0] * z[0], V1: fit.eta.V1 + (Lc as number[][])[1][0] * z[0] + (Lc as number[][])[1][1] * z[1], V2: fit.eta.V2 + (Lc as number[][])[2][0] * z[0] + (Lc as number[][])[2][1] * z[1] + (Lc as number[][])[2][2] * z[2] };
    const lp = logPrior(e);
    const ll = -objectiveAt([e.CL, e.V1, e.V2], input).nll;
    const lq = useMixture ? logSumExp(Math.log(IS_PRIOR_FRACTION) + lp, Math.log(1 - IS_PRIOR_FRACTION) + logLaplace(e)) : lp;
    etas.push(e);
    logw.push(ll + lp - lq);
  }
  const m = Math.max(...logw);
  const w = logw.map((x) => Math.exp(x - m));
  const sw = w.reduce((a, b) => a + b, 0);
  const weights = w.map((x) => x / sw);
  const ess = 1 / weights.reduce((a, b) => a + b * b, 0);
  return { etas, weights, effectiveSampleSize: ess, method: useMixture ? "importance_sampling_mixture" : "importance_sampling_prior" };
}

function logSumExp(a: number, b: number): number {
  const m = Math.max(a, b);
  return m + Math.log(Math.exp(a - m) + Math.exp(b - m));
}

/** Weighted quantile summary (weights need not be normalised). */
export function summariseWeightedDraws(values: number[], weights: number[], level = 0.9): Interval {
  const idx = values.map((_, i) => i).filter((i) => Number.isFinite(values[i])).sort((a, b) => values[a] - values[b]);
  const total = idx.reduce((s, i) => s + weights[i], 0);
  const targets = [(1 - level) / 2, 0.5, 1 - (1 - level) / 2];
  const out: number[] = [];
  let acc = 0, k = 0;
  for (const i of idx) {
    acc += weights[i] / total;
    while (k < targets.length && acc >= targets[k]) { out.push(values[i]); k++; }
    if (k >= targets.length) break;
  }
  while (out.length < 3) out.push(values[idx[idx.length - 1]]);
  return { lower: out[0], median: out[1], upper: out[2], level, n: idx.length };
}
