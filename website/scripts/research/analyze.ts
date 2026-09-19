import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { ForecastResult } from "../../src/lib/researchValidation/forecast";
const hash = (x: string | Buffer) =>
  createHash("sha256").update(x).digest("hex");
function wilson(k: number, n: number) {
  if (!n) return null;
  const z = 1.959963984540054,
    p = k / n,
    d = 1 + (z * z) / n,
    mid = (p + (z * z) / (2 * n)) / d,
    h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [mid - h, mid + h];
}
function main() {
  const [runDir, outcomePath, reportPath] = process.argv.slice(2);
  if (!runDir || !outcomePath || !reportPath)
    throw Error("Usage: analyze.ts LOCKED_RUN OUTCOMES.json NEW_REPORT.json");
  const manifest = JSON.parse(
    readFileSync(join(runDir, "manifest.json"), "utf8"),
  );
  const bytes = readFileSync(join(runDir, "predictions.json"));
  if (hash(bytes) !== manifest.predictions_sha256)
    throw Error("Predictions no longer match the locked manifest.");
  const predictions: ForecastResult[] = JSON.parse(bytes.toString());
  const outcomeBytes = readFileSync(outcomePath),
    outcomes = JSON.parse(outcomeBytes.toString());
  if (!Array.isArray(outcomes))
    throw Error("Outcomes must be a separate array.");
  const byKey = new Map<
    string,
    {
      observed_mg_l: number | null;
      collected_hour: number;
      below_quantification: boolean;
    }
  >();
  const key = (x: { site_id: string; case_id: string }) =>
    JSON.stringify([x.site_id, x.case_id]);
  const predictionKeys = new Set(predictions.map(key));
  for (const o of outcomes) {
    if (
      !o ||
      Object.keys(o).some(
        (k) =>
          ![
            "site_id",
            "case_id",
            "observed_mg_l",
            "collected_hour",
            "below_quantification",
          ].includes(k),
      ) ||
      !predictionKeys.has(key(o)) ||
      byKey.has(key(o)) ||
      !Number.isFinite(o.collected_hour) ||
      typeof o.below_quantification !== "boolean" ||
      (o.observed_mg_l !== null &&
        (!Number.isFinite(o.observed_mg_l) || o.observed_mg_l <= 0))
    )
      throw Error("Invalid, unmatched or duplicate outcome.");
    byKey.set(key(o), o);
  }
  const rows = predictions.flatMap((p) => {
    const o = byKey.get(key(p));
    if (
      p.status !== "forecast" ||
      !o ||
      o.below_quantification ||
      o.observed_mg_l === null
    )
      return [];
    if (Math.abs(o.collected_hour - p.forecast_hour!) > 1e-8)
      throw Error(
        "Outcome time differs from the locked forecast time; do not silently realign predictions.",
      );
    return [
      {
        site: p.site_id,
        e: p.forecast_mg_l! - o.observed_mg_l,
        rel: (p.forecast_mg_l! - o.observed_mg_l) / o.observed_mg_l,
        log: Math.log(p.forecast_mg_l! / o.observed_mg_l),
      },
    ];
  });
  function summary(data: typeof rows) {
    const n = data.length,
      k = data.filter((x) => Math.abs(x.rel) <= 0.3).length;
    return {
      n,
      F30: n ? k / n : null,
      F30_wilson_95: wilson(k, n),
      MAE: n ? data.reduce((a, x) => a + Math.abs(x.e), 0) / n : null,
      RMSE: n ? Math.sqrt(data.reduce((a, x) => a + x.e * x.e, 0) / n) : null,
      geometric_ratio: n
        ? Math.exp(data.reduce((a, x) => a + x.log, 0) / n)
        : null,
    };
  }
  // Patient-level, site-stratified bootstrap; fixed seed retained in report.
  let seed = 20260919;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const sites = [...new Set(rows.map((x) => x.site))].sort();
  const strata = sites.map((site) => rows.filter((x) => x.site === site));
  const boot: number[] = [];
  if (rows.length)
    for (let b = 0; b < 10000; b++) {
      let sum = 0;
      for (const stratum of strata)
        for (let i = 0; i < stratum.length; i++)
          sum += stratum[Math.floor(random() * stratum.length)].log;
      boot.push(Math.exp(sum / rows.length));
    }
  boot.sort((a, b) => a - b);
  const successes = rows.filter((x) => Math.abs(x.rel) <= 0.3).length;
  const eligible = predictions.filter(
    (p) => p.status === "forecast" || p.status === "fit_abstention",
  );
  const quantifiable = eligible.filter((p) => {
    const o = byKey.get(key(p));
    return o && !o.below_quantification && o.observed_mg_l !== null;
  });
  const report = {
    status: "descriptive_research_analysis_not_clinical_validation_signoff",
    manifest_sha256: hash(JSON.stringify(manifest)),
    outcomes_sha256: hash(outcomeBytes),
    attempted: predictions.length,
    eligible_attempted: eligible.length,
    quantifiable_eligible: quantifiable.length,
    exclusions: predictions.filter((p) => !eligible.includes(p)).length,
    forecasts: predictions.filter((p) => p.status === "forecast").length,
    evaluable: rows.length,
    missing_outcomes: predictions.filter(
      (p) => !byKey.has(key(p)) || byKey.get(key(p))!.observed_mg_l === null,
    ).length,
    censored: outcomes.filter(
      (o: { below_quantification: boolean }) => o.below_quantification,
    ).length,
    composite_F30: eligible.length ? successes / eligible.length : null,
    numerical_coverage: quantifiable.length
      ? rows.length / quantifiable.length
      : null,
    aggregate: summary(rows),
    geometric_ratio_bootstrap_95: boot.length ? [boot[249], boot[9749]] : null,
    bootstrap: {
      seed: 20260919,
      resamples: 10000,
      unit: "one patient/case",
      stratified_by: "site",
    },
    by_site: Object.fromEntries(sites.map((s, i) => [s, summary(strata[i])])),
    limitations: [
      "Confirm one case per unique patient at the institution; coded identifiers do not prove uniqueness.",
      "Review all screening exclusions and population/subgroup coverage.",
      "No pass/fail clinical or regulatory decision is automated.",
      "This script implements primary descriptive summaries, not every protocol secondary/sensitivity analysis.",
    ],
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    JSON.stringify({ status: "analysis_written", evaluable: rows.length }),
  );
}
try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : "Analysis failed.");
  process.exitCode = 1;
}
