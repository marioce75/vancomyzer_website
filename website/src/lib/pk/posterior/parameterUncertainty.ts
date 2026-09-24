/**
 * Parameter uncertainty for the concentration-time band.
 *
 * Replaces the former illustrative ±% band (a fixed percentage chosen from a
 * qualitative label) with an interval computed from the same prior and error
 * model the MAP fit uses:
 *
 *  - With a successful fit: draws from the posterior itself, by sampling-
 *    importance-resampling. A Laplace (normal) approximation at the MAP
 *    estimate — covariance = inverse Hessian of the MAP objective (the negative
 *    log posterior, fitPosteriorParameters.ts), by central finite differences —
 *    is widened and used as the proposal; each proposal draw is weighted by
 *    exact posterior / proposal density and N_PARAMETER_DRAWS are resampled.
 *    This corrects the skew a plain normal approximation misses (checked
 *    against brute-force importance sampling from the prior: the pure Laplace
 *    band ran up to ~10% narrow at the upper edge after one level).
 *  - With no levels (or a fit that fell back to the prior): the population
 *    prior itself, log-normal with the prior SDs the fit uses.
 *
 * Parameter vectors are then drawn from that normal in log space and pushed
 * through the model; the band is the pointwise 5th–95th percentile of the
 * simulated concentrations (a 90% credible band for the model-predicted
 * concentration). Draws use a fixed seed, so the same inputs always produce
 * the same band.
 *
 * What the band is NOT:
 *  - It carries only parameter uncertainty. Assay/residual error is excluded,
 *    so it is not a prediction interval for a newly measured level.
 *  - It is conditional on the model: the prior SDs are this application's
 *    (PRIOR_LOG_*_SD, not the Colin 2019 published IIV) and the residual error
 *    model is application-specific. A different prior gives a different band.
 *  - It is a Monte Carlo estimate: the effective sample size is reported, and
 *    below MIN_EFFECTIVE_SAMPLE_SIZE no band is drawn.
 *
 * No band is produced when the reported parameters are not the MAP estimate
 * (optimizer clamp or a post-fit clearance policy bound): the curvature at the
 * optimum no longer describes the parameters being plotted.
 */

import type { TwoCompartmentParameters } from "../steadyStateTwoCompartment";
import {
  objectiveComponents,
  PRIOR_LOG_CL_SD,
  PRIOR_LOG_V1_SD,
  PRIOR_LOG_Q_SD,
  PRIOR_LOG_V2_SD,
  type FitPosteriorInput,
} from "./fitPosteriorParameters";

/** Central credible mass of the band (5th–95th percentile). */
export const CREDIBLE_LEVEL = 0.9;
/** Monte Carlo draws. 400 keeps the 5th/95th percentile error to ~1–2% of the band edge. */
export const N_PARAMETER_DRAWS = 400;
/** Fixed seed: identical inputs give an identical band. */
export const PARAMETER_DRAW_SEED = 20190601;
/** Finite-difference step in log-parameter space for the Hessian. */
export const HESSIAN_LOG_STEP = 0.01;
/** Proposal draws for sampling-importance-resampling. */
export const N_PROPOSAL_DRAWS = 4000;
/** Proposal = Laplace normal with SDs widened by this factor (heavier than the target). */
export const PROPOSAL_SCALE = 1.5;
/** Below this effective sample size the posterior estimate is not trusted. */
export const MIN_EFFECTIVE_SAMPLE_SIZE = 400;

const PARAM_KEYS = ["CL", "V1", "Q", "V2"] as const;

export type ParameterUncertaintyMethod = "posterior_sir" | "population_prior";

export interface ParameterUncertainty {
  method: ParameterUncertaintyMethod;
  level: number;
  n_draws: number;
  seed: number;
  /** Mean of the log-parameter normal (natural log of CL, V1, Q, V2). */
  log_mean: number[];
  /** Covariance of the log-parameter normal, order CL, V1, Q, V2. */
  log_covariance: number[][];
  /** Marginal SDs in log space (≈ CV for small values). */
  log_sd: { CL: number; V1: number; Q: number; V2: number };
  /** Correlation between log CL and log V1 — the pair a single level confounds. */
  corr_CL_V1: number;
  /** Importance-sampling effective sample size (posterior_sir only). */
  effective_sample_size?: number;
  /** Parameter draws. Server-side only; never serialized to the client. */
  draws: TwoCompartmentParameters[];
}

export interface ParameterUncertaintyUnavailable {
  method: "unavailable";
  reason: string;
}

export type ParameterUncertaintyResult = ParameterUncertainty | ParameterUncertaintyUnavailable;

/** Client-safe summary (drops the draws). */
export function summarizeParameterUncertainty(u: ParameterUncertaintyResult | undefined) {
  if (!u) return undefined;
  if (u.method === "unavailable") return { method: u.method, reason: u.reason };
  const r = (x: number) => Math.round(x * 1e4) / 1e4;
  return {
    method: u.method,
    level: u.level,
    n_draws: u.n_draws,
    seed: u.seed,
    log_sd: { CL: r(u.log_sd.CL), V1: r(u.log_sd.V1), Q: r(u.log_sd.Q), V2: r(u.log_sd.V2) },
    corr_CL_V1: r(u.corr_CL_V1),
    ...(u.effective_sample_size !== undefined ? { effective_sample_size: Math.round(u.effective_sample_size) } : {}),
  };
}

// ── Linear algebra (4×4, symmetric positive definite) ───────────────────────

/** Lower Cholesky factor, or null when the matrix is not positive definite. */
export function cholesky(m: number[][]): number[][] | null {
  const n = m.length;
  const L = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = m[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (!(s > 0) || !Number.isFinite(s)) return null;
        L[i][i] = Math.sqrt(s);
      } else {
        L[i][j] = s / L[j][j];
      }
    }
  }
  return L;
}

function invertFromCholesky(L: number[][]): number[][] {
  const n = L.length;
  // Invert L (lower triangular), then A^-1 = L^-T L^-1.
  const Li = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    Li[i][i] = 1 / L[i][i];
    for (let j = 0; j < i; j++) {
      let s = 0;
      for (let k = j; k < i; k++) s -= L[i][k] * Li[k][j];
      Li[i][j] = s / L[i][i];
    }
  }
  const inv = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = Math.max(i, j); k < n; k++) s += Li[k][i] * Li[k][j];
      inv[i][j] = s;
    }
  }
  return inv;
}

// ── Seeded normal draws ─────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inverse standard-normal CDF (Acklam's rational approximation, |rel. error| < 1.2e-9). */
function inverseNormalCdf(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/**
 * Latin-hypercube standard normals, laid out z[s*d + k]. Each dimension gets
 * exactly one draw per 1/n probability stratum, so the marginal percentiles
 * are right for every draw set. Plain pseudo-random draws with one fixed seed
 * gave every patient the SAME sampling error: in the synthetic coverage check
 * the 400 CL draws spanned z −1.60 to +1.77 at the 5th/95th percentile (ideal
 * ±1.645), which shifted the band and made misses above the band 1.6× as
 * common as misses below it.
 */
function latinHypercubeNormals(n: number, d: number, seed: number): number[] {
  const rand = mulberry32(seed);
  const z = new Array<number>(n * d);
  for (let k = 0; k < d; k++) {
    const perm = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let s = 0; s < n; s++) z[s * d + k] = inverseNormalCdf((perm[s] + rand()) / n);
  }
  return z;
}

function drawLogNormal(logMean: number[], L: number[][], n: number, seed: number): TwoCompartmentParameters[] {
  const d = logMean.length;
  const z = latinHypercubeNormals(n, d, seed);
  const draws: TwoCompartmentParameters[] = [];
  for (let s = 0; s < n; s++) {
    const x = logMean.slice();
    for (let i = 0; i < d; i++) {
      let acc = 0;
      for (let k = 0; k <= i; k++) acc += L[i][k] * z[s * d + k];
      x[i] += acc;
    }
    draws.push({ CL: Math.exp(x[0]), V1: Math.exp(x[1]), Q: Math.exp(x[2]), V2: Math.exp(x[3]) });
  }
  return draws;
}

function build(
  method: ParameterUncertaintyMethod,
  logMean: number[],
  cov: number[][],
): ParameterUncertaintyResult {
  const L = cholesky(cov);
  if (!L) return { method: "unavailable", reason: "The parameter covariance is not positive definite." };
  const sd = cov.map((row, i) => Math.sqrt(row[i]));
  return {
    method,
    level: CREDIBLE_LEVEL,
    n_draws: N_PARAMETER_DRAWS,
    seed: PARAMETER_DRAW_SEED,
    log_mean: logMean,
    log_covariance: cov,
    log_sd: { CL: sd[0], V1: sd[1], Q: sd[2], V2: sd[3] },
    corr_CL_V1: cov[0][1] / (sd[0] * sd[1]),
    draws: drawLogNormal(logMean, L, N_PARAMETER_DRAWS, PARAMETER_DRAW_SEED),
  };
}

/** Population-prior uncertainty: independent log-normals with the fit's prior SDs. */
export function priorParameterUncertainty(
  prior: TwoCompartmentParameters,
  omega?: { CL?: number; V1?: number; Q?: number; V2?: number },
): ParameterUncertaintyResult {
  const sd = [
    omega?.CL ?? PRIOR_LOG_CL_SD,
    omega?.V1 ?? PRIOR_LOG_V1_SD,
    omega?.Q ?? PRIOR_LOG_Q_SD,
    omega?.V2 ?? PRIOR_LOG_V2_SD,
  ];
  const logMean = PARAM_KEYS.map((k) => Math.log(prior[k]));
  const cov = sd.map((si, i) => sd.map((_, j) => (i === j ? si * si : 0)));
  return build("population_prior", logMean, cov);
}

/**
 * Posterior draws around the MAP estimate. `map` must be the optimizer's own
 * (unclamped, unbounded) optimum; the caller decides that.
 */
export function posteriorParameterUncertainty(
  fitInput: FitPosteriorInput,
  map: TwoCompartmentParameters,
): ParameterUncertaintyResult {
  const x0 = PARAM_KEYS.map((k) => Math.log(map[k]));
  const f = (x: number[]) =>
    objectiveComponents(Math.exp(x[0]), Math.exp(x[1]), Math.exp(x[2]), Math.exp(x[3]), fitInput).total;
  const h = HESSIAN_LOG_STEP;
  const n = x0.length;
  const f0 = f(x0);
  const shifted = (i: number, di: number, j?: number, dj?: number) => {
    const x = x0.slice();
    x[i] += di;
    if (j !== undefined && dj !== undefined) x[j] += dj;
    return f(x);
  };
  const H = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    H[i][i] = (shifted(i, h) - 2 * f0 + shifted(i, -h)) / (h * h);
    for (let j = 0; j < i; j++) {
      const v =
        (shifted(i, h, j, h) - shifted(i, h, j, -h) - shifted(i, -h, j, h) + shifted(i, -h, j, -h)) / (4 * h * h);
      H[i][j] = v;
      H[j][i] = v;
    }
  }
  // The finite-difference Hessian is only a proposal shape. Where it is not
  // positive definite (the error model's 1 mg/L floor puts a kink in the
  // objective near low concentrations; ~7% of single-level synthetic patients)
  // fall back to the prior's covariance, which is wider than the posterior in
  // every direction. The importance weights correct for either proposal, and
  // the effective-sample-size check below still guards the result.
  const LH = H.every((row) => row.every(Number.isFinite)) ? cholesky(H) : null;
  const priorSd = [
    fitInput.omega_CL ?? PRIOR_LOG_CL_SD,
    fitInput.omega_V1 ?? PRIOR_LOG_V1_SD,
    fitInput.omega_Q ?? PRIOR_LOG_Q_SD,
    fitInput.omega_V2 ?? PRIOR_LOG_V2_SD,
  ];
  const proposalCov = LH
    ? invertFromCholesky(LH)
    : priorSd.map((si, i) => priorSd.map((_, j) => (i === j ? (si * si) / (PROPOSAL_SCALE * PROPOSAL_SCALE) : 0)));
  return posteriorBySir(f, x0, proposalCov);
}

/** Summary covariance of a set of log-parameter draws. */
function sampleCovariance(xs: number[][]): { mean: number[]; cov: number[][] } {
  const n = xs.length, d = xs[0].length;
  const mean = Array(d).fill(0);
  for (const x of xs) for (let i = 0; i < d; i++) mean[i] += x[i] / n;
  const cov = Array.from({ length: d }, () => Array(d).fill(0));
  for (const x of xs) for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) cov[i][j] += ((x[i] - mean[i]) * (x[j] - mean[j])) / (n - 1);
  return { mean, cov };
}

/**
 * Sampling-importance-resampling from the exact (unnormalised) posterior
 * exp(−objective), using a widened Laplace normal as the proposal.
 */
function posteriorBySir(
  negLogPost: (x: number[]) => number,
  x0: number[],
  laplaceCov: number[][],
): ParameterUncertaintyResult {
  const d = x0.length;
  const propCov = laplaceCov.map((row) => row.map((v) => v * PROPOSAL_SCALE * PROPOSAL_SCALE));
  const Lp = cholesky(propCov);
  if (!Lp) return { method: "unavailable", reason: "The parameter covariance is not positive definite." };
  let logDetL = 0;
  for (let i = 0; i < d; i++) logDetL += Math.log(Lp[i][i]);

  const z = latinHypercubeNormals(N_PROPOSAL_DRAWS, d, PARAMETER_DRAW_SEED);
  const xs: number[][] = [];
  const logW: number[] = [];
  for (let s = 0; s < N_PROPOSAL_DRAWS; s++) {
    const zs = z.slice(s * d, (s + 1) * d);
    const x = x0.slice();
    for (let i = 0; i < d; i++) {
      let acc = 0;
      for (let k = 0; k <= i; k++) acc += Lp[i][k] * zs[k];
      x[i] += acc;
    }
    // log q(x) up to the shared constant: −½‖z‖² − log|L|
    const logQ = -0.5 * zs.reduce((a, v) => a + v * v, 0) - logDetL;
    const lp = -negLogPost(x);
    xs.push(x);
    logW.push(Number.isFinite(lp) ? lp - logQ : -Infinity);
  }
  const maxLogW = Math.max(...logW);
  if (!Number.isFinite(maxLogW)) {
    return { method: "unavailable", reason: "The posterior could not be evaluated around the fitted parameters." };
  }
  const w = logW.map((lw) => Math.exp(lw - maxLogW));
  const sumW = w.reduce((a, b) => a + b, 0);
  const ess = (sumW * sumW) / w.reduce((a, b) => a + b * b, 0);
  if (ess < MIN_EFFECTIVE_SAMPLE_SIZE) {
    return {
      method: "unavailable",
      reason: `The posterior is too irregular for a reliable band (effective sample size ${Math.round(ess)}).`,
    };
  }

  // Systematic resampling to N_PARAMETER_DRAWS equally weighted draws (deterministic offset).
  const resampled: number[][] = [];
  const step = sumW / N_PARAMETER_DRAWS;
  let u = step * 0.5;
  let cum = 0;
  let j = 0;
  for (let s = 0; s < N_PARAMETER_DRAWS; s++) {
    while (cum + w[j] < u && j < w.length - 1) { cum += w[j]; j++; }
    resampled.push(xs[j]);
    u += step;
  }

  const { cov } = sampleCovariance(resampled);
  const sd = cov.map((row, i) => Math.sqrt(row[i]));
  return {
    method: "posterior_sir",
    level: CREDIBLE_LEVEL,
    n_draws: N_PARAMETER_DRAWS,
    seed: PARAMETER_DRAW_SEED,
    log_mean: x0,
    log_covariance: cov,
    log_sd: { CL: sd[0], V1: sd[1], Q: sd[2], V2: sd[3] },
    corr_CL_V1: cov[0][1] / (sd[0] * sd[1]),
    effective_sample_size: ess,
    draws: resampled.map((x) => ({ CL: Math.exp(x[0]), V1: Math.exp(x[1]), Q: Math.exp(x[2]), V2: Math.exp(x[3]) })),
  };
}
