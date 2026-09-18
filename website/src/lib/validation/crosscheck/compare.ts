/**
 * Compares two result files that follow the crosscheck result schema
 * (results/*.json) and evaluates them against acceptance-criteria.md.
 *
 *   npx tsx src/lib/validation/crosscheck/compare.ts results/vancomyzer-....json results/tucuxi-....json
 *
 * Exits 1 when a comparator file is missing (the run is BLOCKED, not passed).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";

const [aPath, bPath] = process.argv.slice(2);
if (!aPath || !bPath) { console.error("usage: compare.ts <vancomyzer-results.json> <comparator-results.json>"); process.exit(2); }
const A = JSON.parse(readFileSync(join(__dirname, aPath), "utf8"));
if (!existsSync(join(__dirname, bPath))) {
  console.log(`BLOCKED: comparator results not available (${bPath}). No agreement metrics produced; this is not a pass.`);
  process.exit(1);
}
const B = JSON.parse(readFileSync(join(__dirname, bPath), "utf8"));
if (A.fixture !== B.fixture) { console.error(`fixture mismatch: ${A.fixture} vs ${B.fixture}`); process.exit(1); }

const byId = new Map<string, any>(B.results.map((r: any) => [r.id, r] as [string, any]));
const PARAMS = ["CL", "V1", "Q", "V2"] as const;
const pct = (a: number, b: number) => (100 * (a - b)) / b;
const quantile = (xs: number[], q: number) => { const s = [...xs].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

const summary: Record<string, any> = {};
const outliers: Record<string, any[]> = {};
let excluded: string[] = [];
for (const p of PARAMS) {
  const deltas: { id: string; d: number; a: number; b: number }[] = [];
  for (const ra of A.results) {
    const rb = byId.get(ra.id);
    if (!rb || !ra.fit.success || !rb.fit?.success) { if (!excluded.includes(ra.id)) excluded.push(ra.id); continue; }
    deltas.push({ id: ra.id, d: pct(ra.posterior[p], rb.posterior[p]), a: ra.posterior[p], b: rb.posterior[p] });
  }
  const abs = deltas.map((x) => Math.abs(x.d));
  summary[p] = { n: deltas.length, median_abs_pct: quantile(abs, 0.5), p90_abs_pct: quantile(abs, 0.9), p95_abs_pct: quantile(abs, 0.95), max_abs_pct: Math.max(...abs), mean_signed_pct: deltas.reduce((s, x) => s + x.d, 0) / deltas.length };
  outliers[p] = deltas.filter((x) => Math.abs(x.d) > 10).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
}
// Acceptance criteria (acceptance-criteria.md) — evaluated, never tuned after seeing results.
const criteria = {
  CL_median_abs_pct_le_2: summary.CL.median_abs_pct <= 2,
  CL_p95_abs_pct_le_10: summary.CL.p95_abs_pct <= 10,
  V1_median_abs_pct_le_3: summary.V1.median_abs_pct <= 3,
  excluded_le_2pct: excluded.length <= 0.02 * A.results.length,
  every_outlier_explained: "MANUAL — each |Δ|>10% case must be investigated and explained in the report",
};
const report = { compared_at: new Date().toISOString(), a: { product: A.product, manifest: A.engine_manifest }, b: { product: B.product, version: B.engine_manifest ?? B.version }, fixture: A.fixture, summary, outliers, excluded, criteria };
const file = join(__dirname, "results", `compare-${basename(aPath, ".json")}-vs-${basename(bPath, ".json")}.json`);
writeFileSync(file, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ summary, excluded: excluded.length, criteria }, null, 1));
console.log(`wrote ${file}`);
