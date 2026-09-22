/**
 * Typed loader for the 18 Sep 2026 engine cross-check (Vancomyzer vs Tucuxi).
 *
 * Every number rendered on /transparent-dosing/engine-crosscheck for this run
 * is read from the committed result files of the reproducible harness in
 * src/lib/validation/crosscheck/ — nothing is retyped:
 *   - results/vancomyzer-2026-09-17.1-crosscheck-seed42-n200.json  (this engine)
 *   - results/tucuxi-49f6ebe6bcb3-crosscheck-seed42-n200.json       (tucucli run)
 *   - results/compare-…json        (compare.ts against acceptance-criteria.md)
 *   - results/attribution-…json    (independent refit of every |ΔCL| ≥ 3 % case)
 * Method and provenance: crosscheck/tucuxi/README.md.
 *
 * The comparison is a common-math check (same prior, same data, an
 * independently implemented MAP estimator). It is not clinical validation.
 */

import vancomyzer from "./crosscheck/results/vancomyzer-2026-09-17.1-crosscheck-seed42-n200.json";
import tucuxi from "./crosscheck/results/tucuxi-49f6ebe6bcb3-crosscheck-seed42-n200.json";
import compare from "./crosscheck/results/compare-vancomyzer-2026-09-17.1-crosscheck-seed42-n200-vs-tucuxi-49f6ebe6bcb3-crosscheck-seed42-n200.json";
import attribution from "./crosscheck/results/attribution-vancomyzer-2026-09-17.1-crosscheck-seed42-n200-vs-tucuxi-49f6ebe6bcb3-crosscheck-seed42-n200.json";
import vancomyzerCurrent from "./crosscheck/results/vancomyzer-2026-09-19.1-crosscheck-seed42-n200.json";

export type ParamKey = "CL" | "V1" | "Q" | "V2";
export const PARAM_ORDER_2026: ParamKey[] = ["CL", "V1", "Q", "V2"];

interface Params { CL: number; V1: number; Q: number; V2: number }
interface ResultRow {
  id: string;
  prior: Params;
  posterior: Params | Record<string, never>;
  truth: Params;
  exposure_steady_state: { auc24?: number; peak?: number; trough?: number };
  fit: { success: boolean };
}

const V = vancomyzer.results as unknown as ResultRow[];
const T = tucuxi.results as unknown as ResultRow[];
const tById = new Map(T.map((r) => [r.id, r]));

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

/** Both engines fitted every patient; the compare step recorded no exclusions. */
const paired = V.filter((v) => v.fit.success && tById.get(v.id)?.fit.success).map((v) => [v, tById.get(v.id)!] as const);

/** Agreement statistics as computed by compare.ts (Vancomyzer − Tucuxi, % of Tucuxi). */
export const AGREEMENT_2026 = compare.summary as Record<ParamKey, {
  n: number; median_abs_pct: number; p90_abs_pct: number; p95_abs_pct: number; max_abs_pct: number; mean_signed_pct: number;
}>;

/** Pre-set acceptance criteria (acceptance-criteria.md, fixed 17 Sep 2026) and their evaluation. */
export const CRITERIA_2026 = {
  CL_median_abs_pct_le_2: compare.criteria.CL_median_abs_pct_le_2,
  CL_p95_abs_pct_le_10: compare.criteria.CL_p95_abs_pct_le_10,
  V1_median_abs_pct_le_3: compare.criteria.V1_median_abs_pct_le_3,
  excluded_le_2pct: compare.criteria.excluded_le_2pct,
  excluded: compare.excluded.length,
  outliers_over_10pct: PARAM_ORDER_2026.reduce((n, k) => n + (compare.outliers as Record<string, unknown[]>)[k].length, 0),
} as const;

/** Median absolute % error of each estimate against the synthetic truth. */
export const ACCURACY_VS_TRUTH_2026: Record<ParamKey, { prior: number; vz: number; tucuxi: number }> = Object.fromEntries(
  PARAM_ORDER_2026.map((k) => {
    const err = (a: number, t: number) => Math.abs((100 * (a - t)) / t);
    return [k, {
      prior: median(paired.map(([v]) => err(v.prior[k], v.truth[k]))),
      vz: median(paired.map(([v]) => err((v.posterior as Params)[k], v.truth[k]))),
      tucuxi: median(paired.map(([v, t]) => err((t.posterior as Params)[k], v.truth[k]))),
    }];
  }),
) as Record<ParamKey, { prior: number; vz: number; tucuxi: number }>;

/** Steady-state exposure on each engine's own posterior (Vancomyzer − Tucuxi, % of Tucuxi). */
export const EXPOSURE_AGREEMENT_2026 = Object.fromEntries(
  (["auc24", "peak", "trough"] as const).map((k) => {
    const d = paired.map(([v, t]) => Math.abs((100 * (v.exposure_steady_state[k]! - t.exposure_steady_state[k]!)) / t.exposure_steady_state[k]!));
    return [k, { median_abs_pct: median(d), p95_abs_pct: quantile(d, 0.95), max_abs_pct: Math.max(...d) }];
  }),
) as Record<"auc24" | "peak" | "trough", { median_abs_pct: number; p95_abs_pct: number; max_abs_pct: number }>;

/** The gate that ran before any posterior comparison: Tucuxi's a-priori prediction vs the oracle. */
export const PRIOR_VALIDATION_2026 = tucuxi.prior_validation as { check: string; tucuxi: number; reference: number; ok: boolean }[];

/** Independent refit of every |ΔCL| ≥ threshold case under each error-model form. */
export const ATTRIBUTION_2026 = {
  threshold_pct: attribution.threshold_pct,
  cases: attribution.cases as {
    id: string; dCL_pct_vanco_vs_tucuxi: number; refit_vform_vs_vancomyzer_pct: number;
    refit_tform_vs_tucuxi_pct: number; form_effect_pct: number; vancomyzer_CL: number; tucuxi_CL: number; fit_quality: string;
  }[],
};

/**
 * The Vancomyzer side re-run on the current calculator version against the same
 * fixture. Max relative difference of every posterior parameter and exposure
 * versus the 2026-09-17.1 run; 0 means the later releases changed validation and
 * diagnostics only, and the comparison applies to the current calculator.
 */
const VC = vancomyzerCurrent.results as unknown as ResultRow[];
const vcById = new Map(VC.map((r) => [r.id, r]));
export const RERUN_2026 = {
  version: vancomyzerCurrent.engine_manifest as string,
  maxRelDiffPct: 100 * Math.max(0, ...V.map((v) => {
    const c = vcById.get(v.id);
    if (!c || !c.fit.success) return Number.POSITIVE_INFINITY;
    const ps = PARAM_ORDER_2026.map((k) => Math.abs(((c.posterior as Params)[k] - (v.posterior as Params)[k]) / (v.posterior as Params)[k]));
    const es = (["auc24", "peak", "trough"] as const).map((k) => Math.abs((c.exposure_steady_state[k]! - v.exposure_steady_state[k]!) / v.exposure_steady_state[k]!));
    return Math.max(...ps, ...es);
  })),
  allFitsSucceeded: VC.every((r) => r.fit.success) && VC.length === V.length,
};

export const CROSSCHECK_META_2026 = {
  n: paired.length,
  fixture: vancomyzer.fixture,
  seed: vancomyzer.fixture_seed,
  runDate: "2026-09-18",
  displayDate: "18 Sep 2026",
  engineManifest: vancomyzer.engine_manifest,
  vancomyzerErrorModel: vancomyzer.error_model,
  comparator: "Tucuxi-core (tucucli)",
  comparatorRepo: "github.com/sotalya/tucuxi-core",
  comparatorCommit: tucuxi.engine_manifest.replace("tucuxi-core@", ""),
  modelFile: tucuxi.model_file,
  modelFileSha256: tucuxi.model_file_sha256,
  tucuxiErrorModel: tucuxi.error_model,
  priorLogSd: tucuxi.prior_log_sd as Params,
  design: "15 mg/kg, rounded to the nearest 250 mg, q12h, 1.5 h infusions, steady state; levels at 3.0 h and 11.5 h after the start of the dose",
  recordPath: "src/lib/validation/crosscheck/tucuxi/README.md",
  allFitsSucceeded: V.every((r) => r.fit.success) && T.every((r) => r.fit.success),
} as const;
