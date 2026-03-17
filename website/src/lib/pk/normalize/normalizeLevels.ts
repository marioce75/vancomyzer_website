import type { NormalizedLevel } from "../types";

export interface RawLevel {
  value_mcg_ml?: unknown;
  collection_time?: unknown;
  time_since_last_dose_hours?: unknown;
}

export function normalizeLevels(rawLevels: RawLevel[]): NormalizedLevel[] {
  return rawLevels.map((l) => {
    const value_mcg_ml = typeof l.value_mcg_ml === "number" && !Number.isNaN(l.value_mcg_ml) ? l.value_mcg_ml : 0;
    const collection_time = typeof l.collection_time === "string" ? l.collection_time : "";
    const time_since_last_dose_hours = typeof l.time_since_last_dose_hours === "number" && !Number.isNaN(l.time_since_last_dose_hours) ? l.time_since_last_dose_hours : 0;
    return {
      value_mcg_ml: Math.max(0, value_mcg_ml),
      collection_time,
      time_since_last_dose_hours: Math.max(0, time_since_last_dose_hours),
    };
  });
}
