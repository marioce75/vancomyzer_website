/**
 * Build-time enforcement for Literature Reproducibility cases.
 *
 * Run via:
 *   npx tsx scripts/verify-cases.ts
 *
 * Also wired into `npm test` via the `test:cases` script. CI will fail
 * the build if ANY case drifts beyond its declared tolerance, which
 * prevents silent regressions in the engine from reaching production.
 *
 * Exits non-zero on first failure (after collecting all failures so the
 * developer sees the full picture in one run).
 */

import { CASES } from "../src/lib/validation/registry";
import { runAllCases, summarize } from "../src/lib/validation/runCase";

function main(): void {
  if (CASES.length === 0) {
    console.log("⚠ No literature cases registered yet — nothing to verify.");
    console.log("  This is expected during initial curation; the visible page");
    console.log("  shows an under-construction state.");
    return;
  }

  const results = runAllCases(CASES);
  const summary = summarize(results);

  console.log(`Literature Reproducibility verification`);
  console.log(`---------------------------------------`);
  console.log(`Total cases:      ${summary.total}`);
  console.log(`Within tolerance: ${summary.passing}`);
  console.log(`Drifted:          ${summary.failing}`);
  console.log(`Median |AUC₂₄ Δ|: ${summary.median_abs_auc_pct?.toFixed(2) ?? "—"}%`);
  console.log(`Max    |AUC₂₄ Δ|: ${summary.max_abs_auc_pct?.toFixed(2) ?? "—"}%`);
  console.log("");

  const failures: string[] = [];
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    const r = results[i];
    const status = r.within_tolerance ? "✓" : "✗";
    const aucPct = r.deltas.auc24_pct != null ? `${r.deltas.auc24_pct.toFixed(1)}%` : "—";
    console.log(`  ${status} ${c.id.padEnd(38)} AUC Δ ${aucPct.padStart(7)}`);
    if (!r.within_tolerance) {
      failures.push(`${c.id}: ${r.failures.join("; ")}`);
    }
  }

  console.log("");

  if (failures.length > 0) {
    console.error(`❌ ${failures.length} case(s) drifted beyond tolerance:`);
    for (const f of failures) console.error(`   - ${f}`);
    console.error("");
    console.error("The build is blocked. Either:");
    console.error("  (a) fix the engine drift that caused this, or");
    console.error("  (b) widen the tolerance on the affected case in its case file,");
    console.error("      with a written justification in the PR.");
    process.exit(1);
  }

  console.log("✓ All cases within declared tolerance.");
}

main();
