/**
 * Run a single PublishedCase through the Vancomyzer engine and compute the
 * difference from the published values. Deterministic: the same case and
 * the same engine code always give the same result, so the same-model
 * reproductions can run as a regression test in `npm test`.
 *
 * Engine invocation by workflow_type:
 *   - "empiric"          → computeInitialRegimen (no levels, no regimen input)
 *   - "prior_at_regimen" → buildPriorParameters + computeExposure
 *   - "existing"         → runExistingRegimenEngine (regimen + levels)
 *   - "reference_band"   → no engine call
 *
 * Status by comparison_kind:
 *   - "same_model_reproduction" → "pass" only if at least one published
 *     metric is present and every published metric is within tolerance;
 *     otherwise "fail". A reproduction with nothing to compare never passes.
 *   - "cross_model_reference" and "reference_band" → "not_tested". They are
 *     excluded from pass/fail counts and from the summary statistics.
 */

import { computeInitialRegimen } from "../initialRegimen";
import { runExistingRegimenEngine } from "../pk/existing/existingRegimenEngine";
import { buildPriorParameters } from "../pk/posterior/buildPriorParameters";
import { computeExposure } from "../pk/steadyStateTwoCompartment";
import { normalizePatient } from "../pk/normalize/normalizePatient";
import { normalizeRegimen } from "../pk/normalize/normalizeRegimen";
import { normalizeLevels } from "../pk/normalize/normalizeLevels";
import type { CaseResult, PublishedCase } from "./types";

/** Maximum infusion rate (mg/min) accepted for a case regimen. */
export const MAX_CASE_INFUSION_RATE_MG_PER_MIN = 10;

function pctDelta(predicted: number | null, published: number | null): number | null {
  if (predicted == null || published == null || published === 0) return null;
  return ((predicted - published) / published) * 100;
}

function assertCaseIsConsistent(c: PublishedCase): void {
  const isBandWorkflow = c.workflow_type === "reference_band";
  const isBandKind = c.comparison_kind === "reference_band";
  if (isBandWorkflow !== isBandKind) {
    throw new Error(`Case ${c.id}: workflow_type "reference_band" and comparison_kind "reference_band" must be used together`);
  }
  if (c.comparison_kind === "same_model_reproduction" && c.tolerance == null) {
    throw new Error(`Case ${c.id}: a same-model reproduction must declare a tolerance`);
  }
  if (c.comparison_kind !== "same_model_reproduction" && c.tolerance != null) {
    throw new Error(`Case ${c.id}: only same-model reproductions may declare a tolerance`);
  }
  if (c.regimen) {
    const rate = c.regimen.dose_mg / (c.regimen.infusion_duration_hours * 60);
    if (rate > MAX_CASE_INFUSION_RATE_MG_PER_MIN + 1e-9) {
      throw new Error(`Case ${c.id}: infusion rate ${rate.toFixed(1)} mg/min exceeds ${MAX_CASE_INFUSION_RATE_MG_PER_MIN} mg/min`);
    }
  }
}

function runEngine(c: PublishedCase): CaseResult["predicted"] {
  if (c.workflow_type === "empiric") {
    const result = computeInitialRegimen({
      age: c.patient.age_years,
      weight_kg: c.patient.weight_kg,
      serum_creatinine_mg_dl: c.patient.serum_creatinine_mg_dl,
      sex: c.patient.sex === "M" ? "male" : "female",
      height_cm: c.patient.height_cm ?? 0,
    });
    return {
      auc24: result.auc24,
      peak: result.peak,
      trough: result.trough,
      clearance_l_h: result.pk_parameters.CL,
      v1_l: result.pk_parameters.V1,
    };
  }

  if (c.workflow_type === "prior_at_regimen") {
    if (!c.regimen) {
      throw new Error(`Case ${c.id}: prior_at_regimen workflow requires a regimen`);
    }
    const patient: { age: number; weight_kg: number; height_cm: number; sex: "male" | "female" | ""; serum_creatinine_mg_dl: number } = {
      age: c.patient.age_years,
      weight_kg: c.patient.weight_kg,
      serum_creatinine_mg_dl: c.patient.serum_creatinine_mg_dl,
      sex: c.patient.sex === "M" ? "male" : "female",
      height_cm: c.patient.height_cm ?? 0,
    };
    const regimen = {
      dose_mg: c.regimen.dose_mg,
      interval_hours: c.regimen.interval_hours,
      infusion_duration_hours: c.regimen.infusion_duration_hours,
    };
    const prior = buildPriorParameters(patient, regimen);
    const exposure = computeExposure({
      CL: prior.CL,
      V1: prior.V1,
      Q: prior.Q,
      V2: prior.V2,
      dose_mg: c.regimen.dose_mg,
      tau: c.regimen.interval_hours,
      T_inf: Math.min(c.regimen.infusion_duration_hours, c.regimen.interval_hours),
    });
    return {
      auc24: exposure.auc24,
      peak: exposure.peak,
      trough: exposure.trough,
      clearance_l_h: prior.CL,
      v1_l: prior.V1,
    };
  }

  if (!c.regimen) {
    throw new Error(`Case ${c.id}: existing workflow requires a regimen`);
  }
  // Call the engine directly rather than runExistingRegimenPipeline. The
  // pipeline's validator protects the user-facing API from inconsistent
  // inputs (e.g. it rejects 2-level wall-clock deltas > interval/2 as
  // "cross-cycle"), which does not apply to curated fixtures where every
  // input is controlled. Height and sex are passed as the calculator passes
  // them; since 15 Sep 2026 they do not change the model (Colin 2019 is used
  // at every BMI).
  const patient = normalizePatient({
    age: c.patient.age_years,
    weight_kg: c.patient.weight_kg,
    serum_creatinine_mg_dl: c.patient.serum_creatinine_mg_dl,
    height_cm: c.patient.height_cm ?? 0,
    sex: c.patient.sex === "M" ? "male" : c.patient.sex === "F" ? "female" : "",
  });
  const regimen = normalizeRegimen({
    dose_mg: c.regimen.dose_mg,
    interval_hours: c.regimen.interval_hours,
    infusion_duration_hours: c.regimen.infusion_duration_hours,
    doses_given: c.regimen.doses_given,
  });
  const levels = normalizeLevels(
    c.levels.map((l) => ({
      value_mcg_ml: l.value_mcg_ml,
      collection_time: "",
      time_since_last_dose_hours: l.time_since_last_dose_hours,
    })),
  );
  const r = runExistingRegimenEngine({ patient, regimen, levels });
  return {
    auc24: r.auc24,
    peak: r.peak,
    trough: r.trough,
    clearance_l_h: r.CL,
    v1_l: r.V1,
  };
}

export function runCase(c: PublishedCase): CaseResult {
  assertCaseIsConsistent(c);

  if (c.comparison_kind === "reference_band") {
    return {
      case_id: c.id,
      comparison_kind: c.comparison_kind,
      predicted: { auc24: null, peak: null, trough: null, clearance_l_h: null, v1_l: null },
      deltas: { auc24_pct: null, peak_pct: null, trough_pct: null, clearance_pct: null, v1_pct: null },
      status: "not_tested",
      failures: [],
    };
  }

  const predicted = runEngine(c);
  const deltas = {
    auc24_pct: pctDelta(predicted.auc24, c.published.auc24_mg_h_l),
    peak_pct: pctDelta(predicted.peak, c.published.peak_mcg_ml),
    trough_pct: pctDelta(predicted.trough, c.published.trough_mcg_ml),
    clearance_pct: pctDelta(predicted.clearance_l_h, c.published.clearance_l_h),
    v1_pct: pctDelta(predicted.v1_l, c.published.v1_l),
  };

  if (c.comparison_kind === "cross_model_reference") {
    return { case_id: c.id, comparison_kind: c.comparison_kind, predicted, deltas, status: "not_tested", failures: [] };
  }

  // Same-model reproduction.
  const tol = c.tolerance!;
  const checks: { label: string; published: number | null; delta: number | null; tolerance: number }[] = [
    { label: "AUC24", published: c.published.auc24_mg_h_l, delta: deltas.auc24_pct, tolerance: tol.auc24_pct },
    { label: "Peak", published: c.published.peak_mcg_ml, delta: deltas.peak_pct, tolerance: tol.peak_pct },
    { label: "Trough", published: c.published.trough_mcg_ml, delta: deltas.trough_pct, tolerance: tol.trough_pct },
    { label: "CL", published: c.published.clearance_l_h, delta: deltas.clearance_pct, tolerance: tol.clearance_pct },
    { label: "V1", published: c.published.v1_l, delta: deltas.v1_pct, tolerance: tol.v1_pct },
  ];
  const compared = checks.filter((k) => k.published != null);
  const failures: string[] = [];
  if (compared.length === 0) {
    failures.push("No published value to compare; a reproduction case cannot pass without one");
  }
  for (const k of compared) {
    if (k.delta == null || !Number.isFinite(k.delta)) {
      failures.push(`${k.label}: engine produced no finite value to compare`);
    } else if (Math.abs(k.delta) > k.tolerance) {
      failures.push(`${k.label} ${k.delta.toFixed(2)}% outside ±${k.tolerance}%`);
    }
  }

  return {
    case_id: c.id,
    comparison_kind: c.comparison_kind,
    predicted,
    deltas,
    status: failures.length === 0 ? "pass" : "fail",
    failures,
  };
}

/** Map over the registry; pure, no I/O. */
export function runAllCases(cases: PublishedCase[]): CaseResult[] {
  return cases.map(runCase);
}

/** Aggregate stats for the page summary and the CLI. */
export interface CaseSummary {
  /** All cards on the page. */
  total: number;
  /** Same-model reproductions (the only pass/fail tests). */
  reproduction_count: number;
  passing: number;
  failing: number;
  /** Cross-model references: engine value shown for context, not pass/fail. */
  cross_model_reference_count: number;
  /** Reference bands: no engine call. */
  reference_band_count: number;
  /** Over same-model reproductions only. */
  median_abs_auc_pct: number | null;
  max_abs_auc_pct: number | null;
  max_abs_clearance_pct: number | null;
}

function medianOf(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

export function summarize(results: CaseResult[]): CaseSummary {
  const reproductions = results.filter((r) => r.comparison_kind === "same_model_reproduction");
  const absValues = (pick: (r: CaseResult) => number | null) =>
    reproductions
      .map(pick)
      .filter((d): d is number => d != null)
      .map((d) => Math.abs(d))
      .sort((a, b) => a - b);
  const aucAbs = absValues((r) => r.deltas.auc24_pct);
  const clAbs = absValues((r) => r.deltas.clearance_pct);

  return {
    total: results.length,
    reproduction_count: reproductions.length,
    passing: reproductions.filter((r) => r.status === "pass").length,
    failing: reproductions.filter((r) => r.status === "fail").length,
    cross_model_reference_count: results.filter((r) => r.comparison_kind === "cross_model_reference").length,
    reference_band_count: results.filter((r) => r.comparison_kind === "reference_band").length,
    median_abs_auc_pct: medianOf(aucAbs),
    max_abs_auc_pct: aucAbs.length === 0 ? null : aucAbs[aucAbs.length - 1],
    max_abs_clearance_pct: clAbs.length === 0 ? null : clAbs[clAbs.length - 1],
  };
}
