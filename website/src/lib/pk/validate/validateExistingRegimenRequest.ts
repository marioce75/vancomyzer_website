import type { NormalizedPatient, NormalizedRegimen, NormalizedLevel } from "../types";

const TIMING_TOLERANCE_HOURS = 0.25;
const MIN_POST_INFUSION_LEVEL_HOURS = 0.5;
const MIN_POST_INFUSION_PULSE_DOSE_HOURS = 2.0; // ASHP 2020: post-distributive phase for single-dose Bayesian
const MAX_INFUSION_FRACTION_OF_INTERVAL = 0.8;

export type ValidationResult =
  | { ok: true; warnings?: string[] }
  | {
      ok: false;
      error_type: "validation_error";
      message: string;
      field_errors?: Record<string, string>;
      recovery_guidance?: string[];
      fallback_workflow?: "initial_regimen" | "repeat_existing_regimen_sampling";
    };

/**
 * Late-draw tolerance for steady-state regimens. Real-world lab draws drift
 * by handoff variability; rejecting a 12-min overshoot on a 12h interval is
 * clinically wrong. Tolerance = min(1h, 25% × interval). Beyond this, the
 * validator falls back to its existing rejection so genuine data-entry
 * mistakes (e.g., 24h on a q12h regimen) still produce a recovery prompt.
 */
function lateDrawToleranceHours(interval: number): number {
  return Math.min(1.0, 0.25 * interval);
}

function parseCollectionTimeHours(value: string): number | null {
  if (!value.trim()) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return Number.NaN;
  return ms / 3600000;
}

function buildRecoveryGuidance(fieldErrors: Record<string, string>): {
  recovery_guidance: string[];
  fallback_workflow?: "initial_regimen" | "repeat_existing_regimen_sampling";
} {
  const values = Object.values(fieldErrors);
  const guidance = new Set<string>();
  let fallback: "initial_regimen" | "repeat_existing_regimen_sampling" | undefined;

  if (values.some((msg) => msg.includes("during infusion") || msg.includes("timing-sensitive"))) {
    guidance.add("Use a level drawn after infusion completion and later in the current dosing interval.");
    guidance.add("Do not treat during-infusion or immediately post-infusion samples as routine steady-state evidence.");
    fallback = "repeat_existing_regimen_sampling";
  }

  if (
    values.some(
      (msg) =>
        msg.includes("more than one dosing interval") ||
        // Match both legacy ("...time_since_last_dose_hours") and current
        // ("...time post-dose") wordings of the chronology error so this
        // branch keeps firing even if the user-facing copy gets reworded.
        msg.includes("inconsistent with reported time")
    )
  ) {
    guidance.add("This looks more like irregular, delayed, held, or cross-interval dosing history than routine steady state.");
    guidance.add("Use a non-steady-state recovery path: do not force a steady-state interpretation when the actual dose history was irregular.");
    guidance.add("Either document the actual dose times or use a first-pass maintenance workflow until cleaner data are available.");
    fallback = "initial_regimen";
  }

  if (
    values.some((msg) =>
      msg.includes("too close to the dosing interval for this intermittent steady-state model")
    )
  ) {
    guidance.add("Near-continuous infusion patterns need a different workflow than this intermittent steady-state calculator.");
  }

  if (
    values.some((msg) =>
      msg.includes("Collection time is required when more than one level is entered")
    )
  ) {
    guidance.add("When entering more than one level, provide explicit collection times for every row so chronology can be checked.");
    fallback = fallback ?? "repeat_existing_regimen_sampling";
  }

  if (guidance.size === 0) {
    guidance.add("Correct the highlighted fields and confirm the regimen represents a routine adult intermittent steady-state workflow before recalculating.");
  }

  return {
    recovery_guidance: Array.from(guidance),
    fallback_workflow: fallback,
  };
}

export function validateExistingRegimenRequest(
  patient: NormalizedPatient,
  regimen: NormalizedRegimen,
  levels: NormalizedLevel[]
): ValidationResult {
  const field_errors: Record<string, string> = {};

  if (patient.age < 18 || patient.age > 120 || Number.isNaN(patient.age)) field_errors["patient.age"] = "Adult calculator requires age 18-120.";
  if (patient.weight_kg < 30 || patient.weight_kg > 400 || Number.isNaN(patient.weight_kg)) field_errors["patient.weight_kg"] = "Weight must be 30-400 kg.";
  if (patient.serum_creatinine_mg_dl < 0.1 || patient.serum_creatinine_mg_dl > 10 || Number.isNaN(patient.serum_creatinine_mg_dl)) field_errors["patient.serum_creatinine_mg_dl"] = "SCr must be 0.1-10 mg/dL.";

  if (regimen.dose_mg <= 0) field_errors["regimen.dose_mg"] = "Must be a positive number.";
  if (regimen.interval_hours <= 0) field_errors["regimen.interval_hours"] = "Must be a positive number.";
  if (regimen.infusion_duration_hours <= 0) field_errors["regimen.infusion_duration_hours"] = "Must be a positive number greater than 0.";
  if (
    regimen.interval_hours > 0 &&
    regimen.infusion_duration_hours >= regimen.interval_hours * MAX_INFUSION_FRACTION_OF_INTERVAL
  ) {
    field_errors["regimen.infusion_duration_hours"] =
      "Infusion duration is too close to the dosing interval for this intermittent steady-state model; use a shorter infusion or a different workflow for near-continuous infusion.";
  }

  const interval_hours = regimen.interval_hours;
  const isPulseDose = regimen.doses_given === 1;
  // Non-SS path matches the engine's threshold (existingRegimenEngine: doses_given < 5).
  // For non-SS, the multi-dose accumulation math does not require time ≤ interval —
  // a level drawn after the interval is just an extended trough.
  const isNonSteadyState = regimen.doses_given !== undefined && regimen.doses_given < 5;
  const tolerance = lateDrawToleranceHours(interval_hours);
  const infusion_hours = Math.min(
    Math.max(0, regimen.infusion_duration_hours),
    interval_hours || 1
  );
  const parsedCollectionTimes: Array<number | null> = [];
  const warnings: string[] = [];

  // Loading dose simulation (doses_given=1) may have no measured levels — prior-only prediction
  if (levels.length === 0 && !isPulseDose) {
    field_errors["levels"] = "At least one level is required for existing regimen evaluation.";
  } else if (levels.length > 0) {
    levels.forEach((l, i) => {
      if (l.value_mcg_ml <= 0 || Number.isNaN(l.value_mcg_ml)) {
        field_errors[`levels[${i}].value_mcg_ml`] = "Must be a positive measured concentration.";
      }
      if (l.time_since_last_dose_hours < 0) {
        field_errors[`levels[${i}].time_since_last_dose_hours`] = "Must be non-negative.";
      }
      // Late-draw handling. Differs by SS vs non-SS path:
      //   • Pulse dose (doses_given=1): no constraint (existing behavior).
      //   • Non-SS (doses_given 2–4): never reject. Always interpret as extended
      //     trough; emit a soft or strong advisory based on overshoot magnitude.
      //   • SS (doses_given ≥ 5): tolerate up to min(1h, 25%×τ) — accept with
      //     advisory. Beyond tolerance: reject (existing behavior + recovery).
      if (!isPulseDose && interval_hours > 0 && l.time_since_last_dose_hours > interval_hours) {
        const overshoot = l.time_since_last_dose_hours - interval_hours;
        const overshootStr = overshoot.toFixed(2).replace(/\.?0+$/, "");
        if (isNonSteadyState) {
          if (overshoot <= tolerance) {
            warnings.push(
              `Level for dose ${i + 1} drawn ${overshootStr} h after the dosing interval — interpreted as a late trough. Common nursing-handoff variability.`,
            );
          } else {
            warnings.push(
              `Level for dose ${i + 1} drawn ${overshootStr} h past the dosing interval. Treated as an extended trough; the posterior fit will rely heavily on the population prior. Verify the dose times if this is unexpected.`,
            );
          }
        } else if (overshoot <= tolerance) {
          // Steady-state, within tolerance — accept with advisory.
          warnings.push(
            `Level for dose ${i + 1} drawn ${overshootStr} h after the dosing interval — interpreted as a late trough. Common nursing-handoff variability.`,
          );
        } else {
          // Steady-state, beyond tolerance — keep the existing reject + recovery path.
          field_errors[`levels[${i}].time_since_last_dose_hours`] =
            `Must be within the dosing interval for a repeating steady-state regimen (time_since_last_dose_hours ≤ interval_hours + ${tolerance.toFixed(2)} h tolerance for late draws).`;
        }
      }
      if (l.time_since_last_dose_hours < infusion_hours) {
        field_errors[`levels[${i}].time_since_last_dose_hours`] =
          "Levels drawn during infusion are not interpreted safely by this steady-state model; collect after infusion completion.";
      } else if (isPulseDose && l.time_since_last_dose_hours < infusion_hours + MIN_POST_INFUSION_PULSE_DOSE_HOURS) {
        field_errors[`levels[${i}].time_since_last_dose_hours`] =
          `For single-dose Bayesian estimation, collect the level at least ${MIN_POST_INFUSION_PULSE_DOSE_HOURS} h after infusion completion to ensure the sample is in the post-distributive elimination phase (ASHP/IDSA/SIDP 2020).`;
      } else if (
        !isPulseDose &&
        l.time_since_last_dose_hours < infusion_hours + MIN_POST_INFUSION_LEVEL_HOURS
      ) {
        field_errors[`levels[${i}].time_since_last_dose_hours`] =
          `Levels drawn within ${MIN_POST_INFUSION_LEVEL_HOURS} h of infusion completion are too timing-sensitive for this simple steady-state model; collect later in the interval.`;
      }

      const parsedHours = parseCollectionTimeHours(l.collection_time);
      parsedCollectionTimes.push(parsedHours);
      if (levels.length > 1 && !l.collection_time.trim()) {
        field_errors[`levels[${i}].collection_time`] =
          "Collection time is required when more than one level is entered so timing semantics can be checked across the same dosing interval.";
      } else if (Number.isNaN(parsedHours)) {
        field_errors[`levels[${i}].collection_time`] = "Must be a valid datetime when provided.";
      }
    });

    for (let i = 0; i < levels.length - 1; i++) {
      for (let j = i + 1; j < levels.length; j++) {
        const t1 = parsedCollectionTimes[i];
        const t2 = parsedCollectionTimes[j];
        if (t1 == null || t2 == null || Number.isNaN(t1) || Number.isNaN(t2)) continue;

        const observedDelta = t2 - t1; // hours between collection times

        // Levels may be from different dose cycles (e.g. peak from dose N, trough from dose N+1).
        // Normalize the observed delta to be within ±interval to find the within-cycle offset.
        const normalizedDelta = observedDelta % interval_hours;
        const reportedDelta =
          levels[j].time_since_last_dose_hours - levels[i].time_since_last_dose_hours;

        // Allow levels spanning up to 3 dosing intervals (common in clinical practice)
        if (observedDelta > 3 * interval_hours + TIMING_TOLERANCE_HOURS) {
          field_errors[`levels[${j}].collection_time`] =
            "Collection times span more than 3 dosing intervals — please verify dates are correct.";
          continue;
        }

        // Check that reported time_since_last_dose_hours is consistent with collection timestamps
        // accounting for the fact that levels may come from different dose cycles
        const cycleOffset = Math.round(observedDelta / interval_hours) * interval_hours;
        const expectedReportedDelta = observedDelta - cycleOffset;
        if (Math.abs(expectedReportedDelta - reportedDelta) > TIMING_TOLERANCE_HOURS + 0.5) {
          field_errors[`levels[${j}].collection_time`] =
            "Collection time is inconsistent with reported time post-dose. Check that each level's dose time is the most recent dose before that level was drawn.";
        }
      }
    }
  }

  if (Object.keys(field_errors).length > 0) {
    const recovery = buildRecoveryGuidance(field_errors);
    return {
      ok: false,
      error_type: "validation_error",
      message:
        "This regimen cannot be interpreted safely as a routine intermittent steady-state workflow yet.",
      field_errors,
      recovery_guidance: recovery.recovery_guidance,
      fallback_workflow: recovery.fallback_workflow,
    };
  }

  return warnings.length > 0 ? { ok: true, warnings } : { ok: true };
}
