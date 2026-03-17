import type { NormalizedPatient, NormalizedRegimen, NormalizedLevel } from "../types";

const TIMING_TOLERANCE_HOURS = 0.25;

export type ValidationResult =
  | { ok: true }
  | {
      ok: false;
      error_type: "validation_error";
      message: string;
      field_errors?: Record<string, string>;
    };

function parseCollectionTimeHours(value: string): number | null {
  if (!value.trim()) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return Number.NaN;
  return ms / 3600000;
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
  if (patient.serum_creatinine_mg_dl < 0 || Number.isNaN(patient.serum_creatinine_mg_dl)) field_errors["patient.serum_creatinine_mg_dl"] = "Must be a non-negative number.";

  if (regimen.dose_mg <= 0) field_errors["regimen.dose_mg"] = "Must be a positive number.";
  if (regimen.interval_hours <= 0) field_errors["regimen.interval_hours"] = "Must be a positive number.";
  if (regimen.infusion_duration_hours < 0) field_errors["regimen.infusion_duration_hours"] = "Must be a non-negative number.";

  const interval_hours = regimen.interval_hours;
  const parsedCollectionTimes: Array<number | null> = [];

  if (levels.length === 0) {
    field_errors["levels"] = "At least one level is required for existing regimen evaluation.";
  } else {
    levels.forEach((l, i) => {
      if (l.time_since_last_dose_hours < 0) {
        field_errors[`levels[${i}].time_since_last_dose_hours`] = "Must be non-negative.";
      }
      if (interval_hours > 0 && l.time_since_last_dose_hours > interval_hours) {
        field_errors[`levels[${i}].time_since_last_dose_hours`] =
          "Must be within the dosing interval for a repeating steady-state regimen (time_since_last_dose_hours ≤ interval_hours).";
      }

      const parsedHours = parseCollectionTimeHours(l.collection_time);
      parsedCollectionTimes.push(parsedHours);
      if (Number.isNaN(parsedHours)) {
        field_errors[`levels[${i}].collection_time`] =
          "Must be a valid datetime when provided.";
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
    return {
      ok: false,
      error_type: "validation_error",
      message: "Validation failed.",
      field_errors,
    };
  }
  return { ok: true };
}
