/**
 * Typed loader for the engine cross-check result (Vancomyzer vs Tucuxi).
 *
 * The numbers rendered on /transparent-dosing/engine-crosscheck come
 * directly from engine-crosscheck-report.json, the saved output of the
 * n=200 run. Nothing is retyped; do not edit the recorded values.
 *
 * This was a developer-run synthetic analysis (not real patients), run once
 * on 30 May 2026 with the Vancomyzer engine as it was on that date. It
 * cannot run at build time (it needs a locally built Tucuxi binary), so the
 * page is a fixed snapshot. Provenance that is not in the raw report is
 * declared in CROSSCHECK_META. See engine-crosscheck.md for the method.
 */

import report from "./engine-crosscheck-report.json";
import { makeRng } from "./predictive/rng";
import { sampleCohort } from "./predictive/syntheticIcuPopulation";
import { HIGH_BMI_THRESHOLD_KG_M2 } from "@/lib/pk/modelRegistry";

export interface ParamAgreement {
  median_abs: number;
  mean_signed: number;
  p90_abs: number;
  p95_abs: number;
  max_abs: number;
}

export interface AccuracyVsTruth {
  prior: number;
  vz: number;
  tucuxi: number;
}

export interface Outlier {
  id: string;
  crcl: number;
  delta_pct: number;
  vz: number;
  tucuxi: number;
  d_CL: number;
}

export interface CrosscheckReport {
  n: number;
  summary: Record<"CL" | "V1" | "Q" | "V2", ParamAgreement>;
  accuracy_vs_truth: Record<"CL" | "V1" | "Q" | "V2", AccuracyVsTruth>;
  outliers: Record<"CL" | "V1" | "Q" | "V2", Outlier[]>;
}

export const CROSSCHECK: CrosscheckReport = report as CrosscheckReport;

export const PARAM_ORDER: Array<keyof CrosscheckReport["summary"]> = ["CL", "V1", "Q", "V2"];

export const PARAM_LABEL: Record<string, string> = {
  CL: "Clearance (CL)",
  V1: "Central volume (V₁)",
  Q: "Inter-comp. clearance (Q)",
  V2: "Peripheral volume (V₂)",
};

/** Run provenance, kept in sync with how the snapshot was produced. */
export const CROSSCHECK_META = {
  seed: 42,
  date: "2026-05-30",
  displayDate: "30 May 2026",
  comparator: "Tucuxi",
  comparatorRepo: "github.com/sotalya/tucuxi-core",
  comparatorCommit: "d36cc10 (2026-05-28)",
  structuralModel: "two-compartment, IV infusion",
  engineVersion:
    "Vancomyzer engine as of 30 May 2026, before the 15 Sep 2026 model change (retirement of the custom obesity model for BMI of 40 or more)",
  /** Settings documented in engine-crosscheck.md for the Tucuxi model files. */
  documentedTucuxiPriorLogSd: { CL: 0.35, V1: 0.25, Q: 0.5, V2: 0.5 },
  documentedTucuxiResidualError: "mixed: 1.0 mg/L additive and 15% proportional",
} as const;

export interface CohortAudit {
  /**
   * True when the seed-42 cohort regenerated from the committed generator
   * reproduces the CrCl recorded for every outlier id in the report (ids are
   * zero-based indices). Only then can the audit below describe the run.
   */
  cohort_matches_report: boolean;
  /**
   * Synthetic patients with BMI ≥ 40 (the generator always records height and
   * sex). On the run date the engine used the since-retired custom obesity
   * model for these patients.
   */
  high_bmi: { id: string; bmi: number; crcl: number }[];
}

/** Regenerates the run's synthetic cohort to identify patients with BMI ≥ 40. */
export function auditCrosscheckCohort(): CohortAudit {
  const cohort = sampleCohort(makeRng(CROSSCHECK_META.seed), CROSSCHECK.n);
  const outliers = PARAM_ORDER.flatMap((k) => CROSSCHECK.outliers[k]);
  const cohort_matches_report = outliers.every((o) => {
    const p = cohort[Number(o.id.slice(1))];
    return p != null && Math.abs(p.crcl_ml_min - o.crcl) < 0.051;
  });
  const high_bmi = cohort
    .map((p, i) => {
      // Same rounding the harness applies before calling the engine.
      const weight = Math.round(p.weight_kg * 10) / 10;
      const height = Math.round(p.height_cm);
      return { id: `p${i}`, bmi: weight / (height / 100) ** 2, crcl: p.crcl_ml_min };
    })
    .filter((x) => x.bmi >= HIGH_BMI_THRESHOLD_KG_M2);
  return { cohort_matches_report, high_bmi };
}
