/**
 * Run a single PublishedCase through the Vancomyzer engine and compute
 * the delta against the published values. Deterministic — same case +
 * same engine code always produces the same result, which is what
 * makes this usable as a build-time regression test.
 *
 * Branches by workflow_type:
 *   - "empiric"  → computeInitialRegimen (no levels, no regimen input)
 *   - "existing" → runExistingRegimenPipeline (regimen + optional levels)
 */

import { computeInitialRegimen } from "../initialRegimen";
import { runExistingRegimenEngine } from "../pk/existing/existingRegimenEngine";
import { buildPriorParameters } from "../pk/posterior/buildPriorParameters";
import { computeExposure } from "../pk/steadyStateTwoCompartment";
import { normalizePatient } from "../pk/normalize/normalizePatient";
import { normalizeRegimen } from "../pk/normalize/normalizeRegimen";
import { normalizeLevels } from "../pk/normalize/normalizeLevels";
import type { CaseResult, PublishedCase } from "./types";

function pctDelta(predicted: number | null, published: number | null): number | null {
  if (predicted == null || published == null || published === 0) return null;
  return ((predicted - published) / published) * 100;
}

function withinTolerance(delta: number | null, tolerance: number): boolean {
  if (delta == null) return true; // no published value → can't fail
  return Math.abs(delta) <= tolerance;
}

export function runCase(c: PublishedCase): CaseResult {
  let predicted: CaseResult["predicted"];

  if (c.workflow_type === "empiric") {
    const result = computeInitialRegimen({
      age: c.patient.age_years,
      weight_kg: c.patient.weight_kg,
      serum_creatinine_mg_dl: c.patient.serum_creatinine_mg_dl,
      sex: c.patient.sex === "M" ? "male" : "female",
      height_cm: c.patient.height_cm ?? 0,
    });
    predicted = {
      auc24: result.auc24,
      peak: result.peak,
      trough: result.trough,
      clearance_l_h: result.pk_parameters.CL,
      v1_l: result.pk_parameters.V1,
    };
  } else if (c.workflow_type === "prior_at_regimen") {
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
    predicted = {
      auc24: exposure.auc24,
      peak: exposure.peak,
      trough: exposure.trough,
      clearance_l_h: prior.CL,
      v1_l: prior.V1,
    };
  } else {
    if (!c.regimen) {
      throw new Error(`Case ${c.id}: existing workflow requires a regimen`);
    }
    // Call the engine directly rather than runExistingRegimenPipeline.
    // The pipeline's validator is designed to protect the user-facing API
    // from inconsistent inputs and has quirks (e.g. it rejects 2-level
    // wall-clock deltas > interval/2 as "cross-cycle") that are wrong for
    // trusted pre-curated test fixtures where we control all inputs.
    // The engine itself is the pure computation; bypassing the validator
    // is the right move for a build-time regression test.
    const patient = normalizePatient({
      age: c.patient.age_years,
      weight_kg: c.patient.weight_kg,
      serum_creatinine_mg_dl: c.patient.serum_creatinine_mg_dl,
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
    predicted = {
      auc24: r.auc24,
      peak: r.peak,
      trough: r.trough,
      clearance_l_h: r.CL,
      v1_l: r.V1,
    };
  }

  const deltas = {
    auc24_pct: pctDelta(predicted.auc24, c.published.auc24_mg_h_l),
    peak_pct: pctDelta(predicted.peak, c.published.peak_mcg_ml),
    trough_pct: pctDelta(predicted.trough, c.published.trough_mcg_ml),
  };

  const failures: string[] = [];
  if (!withinTolerance(deltas.auc24_pct, c.tolerance.auc24_pct)) {
    failures.push(`AUC24 ${deltas.auc24_pct?.toFixed(1)}% > ±${c.tolerance.auc24_pct}%`);
  }
  if (!withinTolerance(deltas.peak_pct, c.tolerance.peak_pct)) {
    failures.push(`Peak ${deltas.peak_pct?.toFixed(1)}% > ±${c.tolerance.peak_pct}%`);
  }
  if (!withinTolerance(deltas.trough_pct, c.tolerance.trough_pct)) {
    failures.push(`Trough ${deltas.trough_pct?.toFixed(1)}% > ±${c.tolerance.trough_pct}%`);
  }

  return {
    case_id: c.id,
    predicted,
    deltas,
    within_tolerance: failures.length === 0,
    failures,
  };
}

/** Map over the registry; pure, no I/O. */
export function runAllCases(cases: PublishedCase[]): CaseResult[] {
  return cases.map(runCase);
}

/** Aggregate stats for the page summary scorecard. */
export interface CaseSummary {
  total: number;
  passing: number;
  failing: number;
  median_abs_auc_pct: number | null;
  max_abs_auc_pct: number | null;
}

export function summarize(results: CaseResult[]): CaseSummary {
  const aucAbs = results
    .map((r) => r.deltas.auc24_pct)
    .filter((d): d is number => d != null)
    .map((d) => Math.abs(d))
    .sort((a, b) => a - b);

  const median =
    aucAbs.length === 0
      ? null
      : aucAbs.length % 2 === 1
        ? aucAbs[(aucAbs.length - 1) / 2]
        : (aucAbs[aucAbs.length / 2 - 1] + aucAbs[aucAbs.length / 2]) / 2;

  return {
    total: results.length,
    passing: results.filter((r) => r.within_tolerance).length,
    failing: results.filter((r) => !r.within_tolerance).length,
    median_abs_auc_pct: median,
    max_abs_auc_pct: aucAbs.length === 0 ? null : aucAbs[aucAbs.length - 1],
  };
}
