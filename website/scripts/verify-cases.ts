/**
 * Literature case check.
 *
 * Run via:
 *   npx tsx scripts/verify-cases.ts
 *
 * Wired into `npm test` via the `test:cases` script. It exits non-zero,
 * which fails `npm test`, if any same-model reproduction case is outside
 * its declared tolerance or has no published value to compare. All
 * failures are collected and printed before exiting.
 *
 * Cross-model reference cases (different published models or cohort
 * statistics) and reference bands are printed for information only. They
 * are never pass/fail and are excluded from the summary statistics.
 */

import { CASES } from "../src/lib/validation/registry";
import { runAllCases, summarize } from "../src/lib/validation/runCase";

function pct(v: number | null): string {
  return v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function main(): void {
  if (CASES.length === 0) {
    console.log("No literature cases registered — nothing to verify.");
    return;
  }

  const results = runAllCases(CASES);
  const summary = summarize(results);

  console.log("Literature case verification");
  console.log("----------------------------");
  console.log(`Cases:                               ${summary.total}`);
  console.log(`Same-model reproductions (pass/fail): ${summary.reproduction_count} (pass ${summary.passing}, fail ${summary.failing})`);
  console.log(`Cross-model references (context):     ${summary.cross_model_reference_count}`);
  console.log(`Reference bands (no engine run):      ${summary.reference_band_count}`);
  console.log(`Reproductions, median |AUC₂₄ Δ|:      ${summary.median_abs_auc_pct?.toFixed(2) ?? "—"}%`);
  console.log(`Reproductions, max |AUC₂₄ Δ|:         ${summary.max_abs_auc_pct?.toFixed(2) ?? "—"}%`);
  console.log(`Reproductions, max |CL Δ|:            ${summary.max_abs_clearance_pct?.toFixed(2) ?? "—"}%`);
  console.log("");

  const failures: string[] = [];
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    const r = results[i];
    const mark = r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "·";
    const kind =
      r.comparison_kind === "same_model_reproduction"
        ? "reproduction"
        : r.comparison_kind === "cross_model_reference"
          ? "cross-model reference, context only"
          : "reference band, no engine run";
    console.log(`  ${mark} ${c.id.padEnd(38)} AUC Δ ${pct(r.deltas.auc24_pct).padStart(8)}  CL Δ ${pct(r.deltas.clearance_pct).padStart(8)}  (${kind})`);
    if (r.status === "fail") {
      failures.push(`${c.id}: ${r.failures.join("; ")}`);
    }
  }

  console.log("");

  if (failures.length > 0) {
    console.error(`✗ ${failures.length} same-model reproduction case(s) failed:`);
    for (const f of failures) console.error(`   - ${f}`);
    console.error("");
    console.error("This fails `npm test`. Investigate the discrepancy; do not widen a tolerance");
    console.error("without documented justification.");
    process.exit(1);
  }

  console.log("✓ All same-model reproduction cases are within tolerance.");
}

main();
