/**
 * Predictive-performance harness: CLI runner.
 *
 *   npx tsx scripts/verify-predictive-performance.ts
 *
 * Wired into `npm test` via the `test:predictive` script. It prints the
 * metrics for inspection and does not fail the test suite: the analysis is
 * a developer-run synthetic analysis (not real patients) with no
 * prespecified acceptance threshold.
 *
 * /transparent-dosing/predictive-performance runs the same harness with the
 * same seed and cohort size (PREDICTIVE_DEFAULT_SEED / PREDICTIVE_DEFAULT_N)
 * when the site is built, so the page shows the numbers printed here.
 */

import {
  PREDICTIVE_DEFAULT_N,
  PREDICTIVE_DEFAULT_SEED,
  PREDICTIVE_DESIGN,
  runPredictiveValidation,
} from "../src/lib/validation/predictive/runValidation";
import { computeMetrics, BAI_2025_REFERENCE, type PerformanceMetrics } from "../src/lib/validation/predictive/metrics";
import { MODEL_MANIFEST_VERSION, COLIN_2019 } from "../src/lib/pk/modelRegistry";

function printMetrics(title: string, m: PerformanceMetrics): void {
  const sign = (v: number) => (v >= 0 ? "+" : "");
  console.log(title);
  console.log(`  n                  ${m.n}`);
  console.log(`  Bias  (mg/L)       ${sign(m.bias_mg_l)}${m.bias_mg_l.toFixed(2)}   signed mean error`);
  console.log(`  rBias (%)          ${sign(m.rbias_pct)}${m.rbias_pct.toFixed(2)}`);
  console.log(`  RMSE  (mg/L)       ${m.rmse_mg_l.toFixed(2)}`);
  console.log(`  rRMSE (%)          ${m.rrmse_pct.toFixed(2)}`);
}

function main(): void {
  const run = runPredictiveValidation({ seed: PREDICTIVE_DEFAULT_SEED, n: PREDICTIVE_DEFAULT_N });
  const vsObservation = computeMetrics(run.pairs_vs_observation);
  const vsTruth = computeMetrics(run.pairs_vs_truth);
  const d = PREDICTIVE_DESIGN;
  const c = run.cohort;

  console.log("Predictive performance: developer-run synthetic analysis (not real patients)");
  console.log("-----------------------------------------------------------------------------");
  console.log(`Engine:              Vancomyzer posterior engine, ${COLIN_2019.shortName} prior, model manifest ${MODEL_MANIFEST_VERSION}`);
  console.log("Truth model:         Goti 2018-based (weight scaling, variability and residual error are developer choices)");
  console.log(`Synthetic cohort:    ${run.n_attempted} ICU-like adults, seed ${run.seed}; CrCl > 130 mL/min: ${c.n_crcl_above_130}, at the ${c.crcl_cap_ml_min} mL/min cap: ${c.n_crcl_at_cap}; BMI >= 40: ${c.n_bmi_40_or_more}`);
  console.log(`Regimen:             ${d.dose_mg_per_kg} mg/kg q${d.interval_hours}h (${d.dose_rounding}), ${d.infusion_hours} h infusion`);
  console.log(`Fitted levels:       ${d.fitted_sample_times_hours.map((t) => t.toFixed(1)).join(" h and ")} h after the start of dose ${d.sampled_dose_number} (steady-state equations)`);
  console.log(`Held-out endpoint:   ${d.heldout_sample_time_hours.toFixed(1)} h after the start of the same dose (${d.heldout_hours_after_infusion_end.toFixed(1)} h after the end of the infusion); not used in the fit`);
  console.log(`Posterior fits OK:   ${run.n_fit_succeeded} of ${run.n_attempted}`);
  console.log("");
  printMetrics("Prediction vs synthetic observation at the held-out time (truth + residual error):", vsObservation);
  console.log("");
  printMetrics("Prediction vs noise-free truth at the held-out time:", vsTruth);
  console.log("");
  console.log("No acceptance threshold was prespecified. A ±20% rBias threshold is a later convention, not a Sheiner–Beal criterion.");
  console.log("");
  console.log("Context only, NOT comparable (real ICU patients, different cohort, sampling and truth definition):");
  console.log(`  Bai 2025 a posteriori rBias ${BAI_2025_REFERENCE.rbias_pct_range[0].toFixed(2)}% to ${BAI_2025_REFERENCE.rbias_pct_range[1].toFixed(2)}%, rRMSE ${BAI_2025_REFERENCE.rrmse_pct_range[0].toFixed(2)}% to ${BAI_2025_REFERENCE.rrmse_pct_range[1].toFixed(2)}%`);
  console.log(`  ${BAI_2025_REFERENCE.source}`);
  console.log("");
}

main();
