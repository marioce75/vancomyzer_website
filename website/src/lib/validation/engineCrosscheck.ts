/**
 * Typed loader for the Part A engine cross-check result.
 *
 * The numbers rendered on /transparent-dosing/engine-crosscheck come
 * DIRECTLY from engine-crosscheck-report.json — the verbatim output of
 * the n=200 cross-check run. Nothing is retyped. This is deliberate:
 * an earlier draft transcribed figures from memory and got them wrong,
 * so the page now imports the artifact and computes its display from it.
 *
 * Provenance (seed, cohort size, date, comparator commit) is NOT in the
 * raw report, so it's declared here as constants and must be kept in
 * sync with how the run was actually produced. See
 * engine-crosscheck.md for the full methodology.
 *
 * Part A CANNOT run at build time (it depends on a locally-built Tucuxi
 * C++ binary that isn't in the repo or on the deploy host), so unlike
 * the Part B predictive-performance page this is a fixed snapshot, not
 * a live computation. The page says so explicitly.
 */

import report from "./engine-crosscheck-report.json";

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

/** Run provenance — kept in sync with how the snapshot was produced. */
export const CROSSCHECK_META = {
  seed: 42,
  date: "2026-05-30",
  comparator: "Tucuxi",
  comparatorRepo: "github.com/sotalya/tucuxi-core",
  comparatorCommit: "d36cc10 (2026-05-28)",
  structuralModel: "two-compartment, IV infusion",
} as const;
