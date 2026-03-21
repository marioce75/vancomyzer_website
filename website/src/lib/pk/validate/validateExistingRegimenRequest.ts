import type { NormalizedPatient, NormalizedRegimen, NormalizedLevel } from "../types";

const TIMING_TOLERANCE_HOURS = 0.25;
const MIN_POST_INFUSION_LEVEL_HOURS = 0.5;
const MAX_INFUSION_FRACTION_OF_INTERVAL = 0.8;

export type ValidationResult =
  | { ok: true }
  | {
      ok: false;
      error_type: "validation_error";
      message: string;
      field_errors?: Record<string, string>;
      recovery_guidance?: string[];
      fallback_workflow?: "initial_regimen" | "repeat_existing_regimen_sampling";
    };

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
        msg.includes("inconsistent with reported time_since_last_dose_hours")
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

  if (patient.age < 0 || Number.isNaN(patient.age)) field_errors["patient.age"] = "Must be a non-negative number.";
  if (!patient.sex?.trim()) field_errors["patient.sex"] = "Required.";
  if (patient.height_cm <= 0 || Number.isNaN(patient.height_cm)) field_errors["patient.height_cm"] = "Must be a positive number.";
  if (patient.weight_kg <= 0 || Number.isNaN(patient.weight_kg)) field_errors["patient.weight_kg"] = "Must be a positive number.";
  if (patient.serum_creatinine_mg_dl <= 0 || Number.isNaN(patient.serum_creatinine_mg_dl)) field_errors["patient.serum_creatinine_mg_dl"] = "Must be a positive number greater than 0.";

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
  const infusion_hours = Math.min(
    Math.max(0, regimen.infusion_duration_hours),
    interval_hours || 1
  );
  const parsedCollectionTimes: Array<number | null> = [];

  if (levels.length === 0) {
    field_errors["levels"] = "At least one level is required for existing regimen evaluation.";
  } else {
    levels.forEach((l, i) => {
      if (l.value_mcg_ml <= 0 || Number.isNaN(l.value_mcg_ml)) {
        field_errors[`levels[${i}].value_mcg_ml`] = "Must be a positive measured concentration.";
      }
      if (l.time_since_last_dose_hours < 0) {
        field_errors[`levels[${i}].time_since_last_dose_hours`] = "Must be non-negative.";
      }
      if (interval_hours > 0 && l.time_since_last_dose_hours > interval_hours) {
        field_errors[`levels[${i}].time_since_last_dose_hours`] =
          "Must be within the dosing interval for a repeating steady-state regimen (time_since_last_dose_hours ≤ interval_hours).";
      }
      if (l.time_since_last_dose_hours < infusion_hours) {
        field_errors[`levels[${i}].time_since_last_dose_hours`] =
          "Levels drawn during infusion are not interpreted safely by this steady-state model; collect after infusion completion.";
      } else if (
        l.time_since_last_dose_hours <
        infusion_hours + MIN_POST_INFUSION_LEVEL_HOURS
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

        const observedDelta = t2 - t1;
        const reportedDelta =
          levels[j].time_since_last_dose_hours - levels[i].time_since_last_dose_hours;

        if (Math.abs(observedDelta) > interval_hours + TIMING_TOLERANCE_HOURS) {
          field_errors[`levels[${j}].collection_time`] =
            "Collection times span more than one dosing interval; this simple repeating steady-state model cannot interpret missed/held-dose or cross-interval timing safely.";
          continue;
        }

        if (Math.abs(observedDelta - reportedDelta) > TIMING_TOLERANCE_HOURS) {
          field_errors[`levels[${j}].collection_time`] =
            "Collection time is inconsistent with reported time_since_last_dose_hours for the same steady-state dosing interval.";
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

  return { ok: true };
}
