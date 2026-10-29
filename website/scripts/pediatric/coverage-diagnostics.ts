/**
 * Diagnostic for the synthetic under-coverage of the pediatric posterior
 * intervals (83.8 % one level, 82.9 % two levels vs nominal 90 %).
 *
 * Same virtual-patient design as synthetic-performance.ts (seeded, 480
 * patients). For every patient and both sampling designs it computes the
 * 90 % interval of steady-state AUC24 three ways and checks whether the
 * TRUE AUC24 falls inside:
 *   laplace600  — engine method at commit 296c7e2 (Laplace at the MAP, 600 draws)
 *   laplace4000 — same, 4000 draws (Monte-Carlo error check)
 *   exact       — importance sampling of the exact posterior with the prior as
 *                 proposal (weights = likelihood), 40 000 draws, ESS reported
 * plus the prior interval, at nominal levels 50/80/90/95 %, with the side of
 * each miss, the count of non-positive-definite Hessians, and Wilson 95 %
 * limits for every coverage. Synthetic only; not clinical validation.
 *
 * Run from website/: node --import tsx scripts/pediatric/coverage-diagnostics.ts
 * Writes docs/pediatric/coverage-diagnostics.json
 */
import { writeFileSync } from "node:fs";
import { concentrationFromHistory } from "../../src/lib/pk/doseHistory";
import { individualParameters, typicalParameters, type Eta } from "../../src/lib/pediatric/colin2019/prior";
import { drawEta, fitEta, makeRng, objectiveAt, quantile, residualVariance, standardNormal, OMEGA_SD, type FitInput } from "../../src/lib/pediatric/colin2019/fit";
import type { DoseEvent } from "../../src/lib/pk/steadyStateTwoCompartment";

const N_PER_STRATUM = 120;
const SEED = 20261029;
const N_IS = 40000;
const LEVELS = [0.5, 0.8, 0.9, 0.95];
const strata = [
  { name: "preterm neonates (PMA 25-36 wk)", pmaWk: [25, 36], weightForPma: (w: number) => 0.5 + (w - 25) * 0.18, scr: [0.4, 1.3], dosePerKg: 15, tau: 18 },
  { name: "term neonates / young infants (PMA 37-52 wk)", pmaWk: [37, 52], weightForPma: (w: number) => 2.8 + (w - 37) * 0.25, scr: [0.2, 0.8], dosePerKg: 15, tau: 8 },
  { name: "children 2-11 y", pmaWk: [2.77 * 52, 11.77 * 52], weightForPma: (w: number) => 10 + (w / 52 - 2.77) * 3.2, scr: [0.25, 0.9], dosePerKg: 15, tau: 6 },
  { name: "adolescents 12-17 y", pmaWk: [12.77 * 52, 17.99 * 52], weightForPma: (w: number) => 40 + (w / 52 - 12.77) * 5, scr: [0.4, 1.4], dosePerKg: 15, tau: 8 },
];

type Method = "prior" | "laplace600" | "laplace4000" | "exact";
interface Rec { stratum: string; design: "one" | "two"; truth: number; cov: { pmaYears: number; weightKg: number; scrMgDl: number }; hessianSpd: boolean; ess: number; intervals: Record<Method, Record<string, [number, number]>>; mapAuc: number; exactMedian: number }
const recs: Rec[] = [];
const rng = makeRng(SEED);
const uniform = (a: number, b: number) => a + (b - a) * rng();

function weightedQuantiles(values: number[], weights: number[], qs: number[]): number[] {
  const idx = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const total = weights.reduce((s, w) => s + w, 0);
  const out: number[] = [];
  let acc = 0, k = 0;
  for (const i of idx) {
    acc += weights[i] / total;
    while (k < qs.length && acc >= qs[k]) { out.push(values[i]); k++; }
    if (k >= qs.length) break;
  }
  while (out.length < qs.length) out.push(values[idx[idx.length - 1]]);
  return out;
}
function intervalsFromDraws(aucs: number[], weights?: number[]): Record<string, [number, number]> {
  const r: Record<string, [number, number]> = {};
  for (const L of LEVELS) {
    const q = (1 - L) / 2;
    if (weights) { const [lo, hi] = weightedQuantiles(aucs, weights, [q, 1 - q]); r[String(L)] = [lo, hi]; }
    else { const s = aucs.slice().sort((a, b) => a - b); r[String(L)] = [quantile(s, q), quantile(s, 1 - q)]; }
  }
  return r;
}

let done = 0;
for (const s of strata) {
  for (let i = 0; i < N_PER_STRATUM; i++) {
    const pmaWk = uniform(s.pmaWk[0], s.pmaWk[1]);
    const weight = Math.max(0.42, s.weightForPma(pmaWk) * Math.exp(0.15 * standardNormal(rng)));
    const cov = { pmaYears: pmaWk / 52, weightKg: weight, scrMgDl: uniform(s.scr[0], s.scr[1]) };
    const eta: Eta = { CL: OMEGA_SD.CL * standardNormal(rng), V1: OMEGA_SD.V1 * standardNormal(rng), V2: OMEGA_SD.V2 * standardNormal(rng) };
    const truth = individualParameters(cov, eta);
    const dose = Math.max(1, Math.round(s.dosePerKg * weight));
    const T_inf = 1, nDoses = 6;
    const schedule: DoseEvent[] = Array.from({ length: nDoses }, (_, k) => ({ time: k * s.tau, dose_mg: dose, T_inf }));
    const last = schedule[nDoses - 1].time;
    const tPeak = last + T_inf + 1, tTrough = last + s.tau - 0.5;
    const observe = (t: number) => { const f = concentrationFromHistory(truth, schedule, t); return Math.max(0.1, f + Math.sqrt(residualVariance(f)) * standardNormal(rng)); };
    const yPeak = observe(tPeak), yTrough = observe(tTrough);
    const daily = (dose * 24) / s.tau;
    const trueAuc = daily / truth.CL;
    const aucOf = (e: Eta) => daily / individualParameters(cov, e).CL;
    const priorDraws = drawEta({ CL: 0, V1: 0, V2: 0 }, null, 4000, SEED + i).map(aucOf);
    for (const design of ["one", "two"] as const) {
      const observations = design === "one" ? [{ timeHours: tTrough, concentration: yTrough }] : [{ timeHours: tPeak, concentration: yPeak }, { timeHours: tTrough, concentration: yTrough }];
      const input: FitInput = { covariates: cov, formulation: "fitted_nonmem", schedule, observations };
      const fit = fitEta(input);
      const spd = !!fit.etaCovariance;
      const lap600 = spd ? drawEta(fit.eta, fit.etaCovariance, 600, SEED + i).map(aucOf) : [];
      const lap4000 = spd ? drawEta(fit.eta, fit.etaCovariance, 4000, SEED + i).map(aucOf) : [];
      // Exact posterior by importance sampling: proposal = prior N(0, Ω); weight = likelihood only.
      const isDraws = drawEta({ CL: 0, V1: 0, V2: 0 }, null, N_IS, SEED + 1000 + i);
      const logw = isDraws.map((e) => -objectiveAt([e.CL, e.V1, e.V2], input).nll);
      const m = Math.max(...logw);
      const w = logw.map((x) => Math.exp(x - m));
      const sw = w.reduce((a, b) => a + b, 0), sw2 = w.reduce((a, b) => a + b * b, 0);
      const ess = (sw * sw) / sw2;
      const isAuc = isDraws.map(aucOf);
      const exact = intervalsFromDraws(isAuc, w);
      recs.push({
        stratum: s.name, design, truth: trueAuc, cov, hessianSpd: spd, ess,
        mapAuc: fit.success ? daily / fit.parameters.CL : Number.NaN,
        exactMedian: weightedQuantiles(isAuc, w, [0.5])[0],
        intervals: { prior: intervalsFromDraws(priorDraws), laplace600: spd ? intervalsFromDraws(lap600) : {}, laplace4000: spd ? intervalsFromDraws(lap4000) : {}, exact },
      });
    }
    if (++done % 60 === 0) console.error(`${done}/480 patients`);
  }
}

function wilson(k: number, n: number): [number, number] {
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [c - h, c + h];
}
function coverage(sel: Rec[], method: Method, level: number) {
  const withIv = sel.filter((r) => r.intervals[method][String(level)]);
  let inside = 0, below = 0, above = 0;
  for (const r of withIv) { const [lo, hi] = r.intervals[method][String(level)]; if (r.truth < lo) below++; else if (r.truth > hi) above++; else inside++; }
  const n = sel.length; // a missing interval (non-SPD Hessian) counts as a miss, as in synthetic-performance.ts
  return { n, n_with_interval: withIv.length, coverage: inside / n, wilson95: wilson(inside, n), miss_below_lower: below / n, miss_above_upper: above / n };
}
const methods: Method[] = ["prior", "laplace600", "laplace4000", "exact"];
const summarise = (sel: Rec[]) => Object.fromEntries(methods.map((m) => [m, Object.fromEntries(LEVELS.map((L) => [String(L), coverage(sel, m, L)]))]));
const one = recs.filter((r) => r.design === "one"), two = recs.filter((r) => r.design === "two");
const essStats = (sel: Rec[]) => { const e = sel.map((r) => r.ess).sort((a, b) => a - b); return { min: e[0], p10: e[Math.floor(0.1 * e.length)], median: e[Math.floor(0.5 * e.length)] }; };
const widthRatio = (sel: Rec[]) => { const r = sel.filter((x) => x.intervals.laplace4000["0.9"]).map((x) => (x.intervals.laplace4000["0.9"][1] - x.intervals.laplace4000["0.9"][0]) / (x.intervals.exact["0.9"][1] - x.intervals.exact["0.9"][0])).sort((a, b) => a - b); return { median: r[Math.floor(r.length / 2)], p10: r[Math.floor(0.1 * r.length)], p90: r[Math.floor(0.9 * r.length)] }; };
const centreShift = (sel: Rec[]) => { const r = sel.filter((x) => Number.isFinite(x.mapAuc)).map((x) => x.mapAuc / x.exactMedian).sort((a, b) => a - b); return { median: r[Math.floor(r.length / 2)], p10: r[Math.floor(0.1 * r.length)], p90: r[Math.floor(0.9 * r.length)] }; };
const report = {
  purpose: "Diagnose synthetic under-coverage of posterior AUC24 intervals; virtual patients simulated from Colin 2019 itself. Not clinical validation.",
  design: { per_stratum: N_PER_STRATUM, seed: SEED, importance_sampling_draws: N_IS, nominal_levels: LEVELS, note: "a non-positive-definite Hessian counts as a miss for the Laplace methods" },
  non_spd_hessians: { one_level: one.filter((r) => !r.hessianSpd).length, two_level: two.filter((r) => !r.hessianSpd).length },
  importance_sampling_ess: { one_level: essStats(one), two_level: essStats(two) },
  laplace_vs_exact_width_ratio_90: { one_level: widthRatio(one), two_level: widthRatio(two) },
  map_auc_over_exact_posterior_median: { one_level: centreShift(one), two_level: centreShift(two) },
  overall: { one_level: summarise(one), two_level: summarise(two) },
  by_stratum: strata.map((s) => ({ stratum: s.name, one_level: summarise(one.filter((r) => r.stratum === s.name)), two_level: summarise(two.filter((r) => r.stratum === s.name)) })),
};
writeFileSync("docs/pediatric/coverage-diagnostics.json", JSON.stringify(report, null, 1) + "\n");
const pc = (x: number) => (100 * x).toFixed(1);
for (const [name, sel] of [["one level", one], ["two levels", two]] as const) {
  console.log(`\n${name}:`);
  for (const m of methods) for (const L of LEVELS) { const c = coverage(sel, m, L); console.log(`  ${m.padEnd(12)} nominal ${pc(L)}%  coverage ${pc(c.coverage)}% (95% CI ${pc(c.wilson95[0])}-${pc(c.wilson95[1])})  below ${pc(c.miss_below_lower)}  above ${pc(c.miss_above_upper)}`); }
}
console.log("non-SPD Hessians", JSON.stringify(report.non_spd_hessians), "ESS", JSON.stringify(report.importance_sampling_ess));
console.log("Laplace/exact 90% width ratio", JSON.stringify(report.laplace_vs_exact_width_ratio_90));
console.log("MAP AUC / exact posterior median", JSON.stringify(report.map_auc_over_exact_posterior_median));
