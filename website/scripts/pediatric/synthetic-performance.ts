/**
 * Synthetic predictive-performance study for the pediatric research engine.
 *
 * Virtual patients are simulated FROM the Colin 2019 model itself (η ~ N(0, Ω),
 * residual error from the published σ), so this measures only whether the
 * engine's prior and MAP posterior recover what the model generated. It is
 * NOT clinical validation and says nothing about how real children behave.
 *
 * Reported separately for prior-only, one-level and two-level estimates:
 *   bias (median relative error of AUC24 at steady state), precision (median
 *   absolute relative error and RMSE %), 90 % interval coverage for BOTH the
 *   engine's importance-sampling intervals and the superseded Laplace
 *   intervals, and the agreement of the AUC category (<400, 400-600, >600)
 *   with the true one. See coverage-diagnostics.ts for the full diagnosis.
 *
 * Run from website/: node --import tsx scripts/pediatric/synthetic-performance.ts
 * Writes docs/pediatric/synthetic-performance.json.
 */
import { writeFileSync } from "node:fs";
import { concentrationFromHistory } from "../../src/lib/pk/doseHistory";
import { individualParameters, typicalParameters } from "../../src/lib/pediatric/colin2019/prior";
import { drawEta, fitEta, makeRng, posteriorDraws, residualVariance, standardNormal, summariseDraws, summariseWeightedDraws, OMEGA_SD } from "../../src/lib/pediatric/colin2019/fit";
import type { DoseEvent } from "../../src/lib/pk/steadyStateTwoCompartment";

const N_PER_STRATUM = 120;
const SEED = 20261029;
const strata = [
  { name: "preterm neonates (PMA 25-36 wk)", pmaWk: [25, 36], weightForPma: (w: number) => 0.5 + (w - 25) * 0.18, scr: [0.4, 1.3], dosePerKg: 15, tau: 18 },
  { name: "term neonates / young infants (PMA 37-52 wk)", pmaWk: [37, 52], weightForPma: (w: number) => 2.8 + (w - 37) * 0.25, scr: [0.2, 0.8], dosePerKg: 15, tau: 8 },
  { name: "children 2-11 y", pmaWk: [2.77 * 52, 11.77 * 52], weightForPma: (w: number) => 10 + (w / 52 - 2.77) * 3.2, scr: [0.25, 0.9], dosePerKg: 15, tau: 6 },
  { name: "adolescents 12-17 y", pmaWk: [12.77 * 52, 17.99 * 52], weightForPma: (w: number) => 40 + (w / 52 - 12.77) * 5, scr: [0.4, 1.4], dosePerKg: 15, tau: 8 },
];
const category = (auc: number) => (auc < 400 ? "<400" : auc <= 600 ? "400-600" : ">600");

interface Row { stratum: string; truth: number; prior: number; one: number; two: number; oneMedian: number; twoMedian: number; priorCover: boolean; oneCover: boolean; twoCover: boolean; oneLaplaceCover: boolean; twoLaplaceCover: boolean; priorCat: boolean; oneCat: boolean; twoCat: boolean; oneOk: boolean; twoOk: boolean; oneEss: number; twoEss: number }
const rows: Row[] = [];
const rng = makeRng(SEED);
const uniform = (a: number, b: number) => a + (b - a) * rng();

for (const s of strata) {
  for (let i = 0; i < N_PER_STRATUM; i++) {
    const pmaWk = uniform(s.pmaWk[0], s.pmaWk[1]);
    const weight = Math.max(0.42, s.weightForPma(pmaWk) * Math.exp(0.15 * standardNormal(rng)));
    const cov = { pmaYears: pmaWk / 52, weightKg: weight, scrMgDl: uniform(s.scr[0], s.scr[1]) };
    const eta = { CL: OMEGA_SD.CL * standardNormal(rng), V1: OMEGA_SD.V1 * standardNormal(rng), V2: OMEGA_SD.V2 * standardNormal(rng) };
    const truth = individualParameters(cov, eta);
    const dose = Math.max(1, Math.round(s.dosePerKg * weight));
    const T_inf = 1;
    const nDoses = 6;
    const schedule: DoseEvent[] = Array.from({ length: nDoses }, (_, k) => ({ time: k * s.tau, dose_mg: dose, T_inf }));
    const last = schedule[nDoses - 1].time;
    const tPeak = last + T_inf + 1; // 1 h post infusion
    const tTrough = last + s.tau - 0.5;
    const observe = (t: number) => { const f = concentrationFromHistory(truth, schedule, t); return Math.max(0.1, f + Math.sqrt(residualVariance(f)) * standardNormal(rng)); };
    const yPeak = observe(tPeak);
    const yTrough = observe(tTrough);
    const daily = (dose * 24) / s.tau;
    const trueAuc = daily / truth.CL;
    const prior = typicalParameters(cov);
    const priorAuc = daily / prior.CL;
    const priorIv = summariseDraws(drawEta({ CL: 0, V1: 0, V2: 0 }, null, 600, SEED + i).map((e) => daily / individualParameters(cov, e).CL));
    const in1 = { covariates: cov, formulation: "fitted_nonmem" as const, schedule, observations: [{ timeHours: tTrough, concentration: yTrough }] };
    const in2 = { ...in1, observations: [{ timeHours: tPeak, concentration: yPeak }, { timeHours: tTrough, concentration: yTrough }] };
    const fit1 = fitEta(in1);
    const fit2 = fitEta(in2);
    const aucOf = (e: { CL: number; V1: number; V2: number }) => daily / individualParameters(cov, e).CL;
    const laplaceIv = (f: typeof fit1) => (f.success && f.etaCovariance ? summariseDraws(drawEta(f.eta, f.etaCovariance, 600, SEED + i).map(aucOf)) : null);
    const exactIv = (f: typeof fit1, input: typeof in1) => { if (!f.success) return null; const d = posteriorDraws(f, input, 4000, SEED + i); return { iv: summariseWeightedDraws(d.etas.map(aucOf), d.weights), ess: d.effectiveSampleSize }; };
    const lap1 = laplaceIv(fit1), lap2 = laplaceIv(fit2);
    const ex1 = exactIv(fit1, in1), ex2 = exactIv(fit2, in2);
    const one = fit1.success ? daily / fit1.parameters.CL : priorAuc;
    const two = fit2.success ? daily / fit2.parameters.CL : priorAuc;
    const covers = (iv: { lower: number; upper: number } | null | undefined) => !!iv && trueAuc >= iv.lower && trueAuc <= iv.upper;
    rows.push({
      stratum: s.name, truth: trueAuc, prior: priorAuc, one, two, oneMedian: ex1 ? ex1.iv.median : priorAuc, twoMedian: ex2 ? ex2.iv.median : priorAuc,
      priorCover: covers(priorIv), oneCover: covers(ex1?.iv), twoCover: covers(ex2?.iv), oneLaplaceCover: covers(lap1), twoLaplaceCover: covers(lap2),
      priorCat: category(priorAuc) === category(trueAuc), oneCat: category(one) === category(trueAuc), twoCat: category(two) === category(trueAuc),
      oneOk: fit1.success, twoOk: fit2.success, oneEss: ex1 ? ex1.ess : 0, twoEss: ex2 ? ex2.ess : 0,
    });
  }
}

function summarise(sel: Row[], key: "prior" | "one" | "two") {
  const rel = sel.map((r) => (r[key] - r.truth) / r.truth).sort((a, b) => a - b);
  const abs = rel.map(Math.abs).sort((a, b) => a - b);
  const q = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(p * (arr.length - 1)))];
  const rmse = Math.sqrt(rel.reduce((s, x) => s + x * x, 0) / rel.length);
  const cover = sel.filter((r) => (key === "prior" ? r.priorCover : key === "one" ? r.oneCover : r.twoCover)).length / sel.length;
  const laplace = key === "prior" ? null : sel.filter((r) => (key === "one" ? r.oneLaplaceCover : r.twoLaplaceCover)).length / sel.length;
  const cat = sel.filter((r) => (key === "prior" ? r.priorCat : key === "one" ? r.oneCat : r.twoCat)).length / sel.length;
  const medRel = key === "prior" ? null : sel.map((r) => ((key === "one" ? r.oneMedian : r.twoMedian) - r.truth) / r.truth).sort((a, b) => a - b);
  const ess = key === "prior" ? null : sel.map((r) => (key === "one" ? r.oneEss : r.twoEss)).sort((a, b) => a - b);
  const z = 1.96, n = sel.length, w = (p: number) => { const d = 1 + (z * z) / n; const c = (p + (z * z) / (2 * n)) / d; const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d; return [c - h, c + h]; };
  return {
    n,
    median_relative_error_pct: 100 * q(rel, 0.5),
    median_absolute_relative_error_pct: 100 * q(abs, 0.5),
    rmse_pct: 100 * rmse,
    p10_relative_error_pct: 100 * q(rel, 0.1),
    p90_relative_error_pct: 100 * q(rel, 0.9),
    posterior_median_bias_pct: medRel ? 100 * q(medRel, 0.5) : null,
    coverage_90pct_interval: cover,
    coverage_90pct_wilson95: w(cover),
    coverage_90pct_laplace_superseded: laplace,
    importance_sampling_ess: ess ? { min: ess[0], median: q(ess, 0.5) } : null,
    auc_category_agreement: cat,
    auc_category_disagreement: 1 - cat,
  };
}
const report = {
  purpose: "Synthetic self-consistency study: virtual patients simulated from Colin 2019 (fitted_nonmem) with published IIV and residual error; NOT clinical validation.",
  design: { per_stratum: N_PER_STRATUM, seed: SEED, doses_before_sampling: 6, samples: "one-level = trough 0.5 h before dose 7; two-level = adds a level 1 h after the end of the dose-6 infusion", metric: "steady-state AUC24 of the simulated regimen (daily dose / CL); point estimate = MAP", interval: "90% credible interval from importance sampling of the exact posterior (engine method; 4000 draws), with the superseded Laplace interval reported for comparison; 90% population interval for the prior" },
  overall: { prior_only: summarise(rows, "prior"), one_level: summarise(rows, "one"), two_level: summarise(rows, "two") },
  by_stratum: strata.map((s) => ({ stratum: s.name, prior_only: summarise(rows.filter((r) => r.stratum === s.name), "prior"), one_level: summarise(rows.filter((r) => r.stratum === s.name), "one"), two_level: summarise(rows.filter((r) => r.stratum === s.name), "two") })),
  fit_failures: { one_level: rows.filter((r) => !r.oneOk).length, two_level: rows.filter((r) => !r.twoOk).length },
};
writeFileSync("docs/pediatric/synthetic-performance.json", JSON.stringify(report, null, 1) + "\n");
const f = (x: number) => x.toFixed(1);
console.log("Synthetic performance (steady-state AUC24, % of true value) — NOT clinical validation");
for (const [k, v] of Object.entries(report.overall)) console.log(`${k.padEnd(11)} n=${v.n} median bias ${f(v.median_relative_error_pct)}% (posterior median ${v.posterior_median_bias_pct === null ? "n/a" : f(v.posterior_median_bias_pct) + "%"})  MAPE ${f(v.median_absolute_relative_error_pct)}%  RMSE ${f(v.rmse_pct)}%  90% coverage ${f(100 * v.coverage_90pct_interval)}% (Wilson ${f(100 * v.coverage_90pct_wilson95[0])}-${f(100 * v.coverage_90pct_wilson95[1])}; Laplace ${v.coverage_90pct_laplace_superseded === null ? "n/a" : f(100 * v.coverage_90pct_laplace_superseded) + "%"})  category agreement ${f(100 * v.auc_category_agreement)}%`);
for (const s of report.by_stratum) console.log(`  ${s.stratum}: prior MAPE ${f(s.prior_only.median_absolute_relative_error_pct)}% → 1-level ${f(s.one_level.median_absolute_relative_error_pct)}% → 2-level ${f(s.two_level.median_absolute_relative_error_pct)}%; category agreement ${f(100 * s.prior_only.auc_category_agreement)}/${f(100 * s.one_level.auc_category_agreement)}/${f(100 * s.two_level.auc_category_agreement)}%`);
console.log("fit failures", JSON.stringify(report.fit_failures));
