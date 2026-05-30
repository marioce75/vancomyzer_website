/**
 * Predictive-performance harness — CLI runner.
 *
 *   npx tsx scripts/verify-predictive-performance.ts
 *
 * Also wired into `npm test` via the `test:predictive` script. Unlike
 * `test:cases` (which fails the build on drift), this script reports
 * rBias/rRMSE for inspection only — it does NOT block the build,
 * because the numbers depend on synthetic Monte Carlo sampling and a
 * single bad seed shouldn't break CI.
 *
 * The numbers printed here are what gets quoted on
 * /transparent-dosing/predictive-performance. If you change the seed
 * or the cohort size, update the page copy in the same commit.
 */

import { runPredictiveValidation } from "../src/lib/validation/predictive/runValidation";
import { computeMetrics, BAI_2025_REFERENCE } from "../src/lib/validation/predictive/metrics";

function main(): void {
  const SEED = 42;
  const N = 200;

  const run = runPredictiveValidation({ seed: SEED, n: N });
  const metrics = computeMetrics(run.pairs);

  console.log("Predictive performance — Vancomyzer (Colin 2019 prior)");
  console.log("vs. synthetic ICU cohort drawn from Goti 2018 truth");
  console.log("-------------------------------------------------------");
  console.log(`Seed:                ${run.seed}`);
  console.log(`Cohort size:         ${run.n_attempted}`);
  console.log(`Posterior fits OK:   ${run.n_fit_succeeded}`);
  console.log(`Held-out timepoint:  trough 0.5 h before the next dose`);
  console.log("");
  console.log(`Bias    (mg/L)       ${metrics.bias_mg_l.toFixed(2)}`);
  console.log(`rBias   (%)          ${metrics.rbias_pct.toFixed(2)}    ${metrics.rbias_acceptable ? "✓ within ±20% (Sheiner–Beal)" : "✗ outside ±20%"}`);
  console.log(`RMSE    (mg/L)       ${metrics.rmse_mg_l.toFixed(2)}`);
  console.log(`rRMSE   (%)          ${metrics.rrmse_pct.toFixed(2)}`);
  console.log("");
  console.log("Bai 2025 a posteriori reference range (3 published programs):");
  console.log(`  rBias  range:      ${BAI_2025_REFERENCE.rbias_pct_range[0].toFixed(2)}% to ${BAI_2025_REFERENCE.rbias_pct_range[1].toFixed(2)}%`);
  console.log(`  rRMSE  range:      ${BAI_2025_REFERENCE.rrmse_pct_range[0].toFixed(2)}% to ${BAI_2025_REFERENCE.rrmse_pct_range[1].toFixed(2)}%`);
  console.log(`  source:            ${BAI_2025_REFERENCE.source}`);
  console.log("");
}

main();
