import type { NormalizedRegimen } from "../types";

export interface RawRegimen {
  dose_mg?: unknown;
  interval_hours?: unknown;
  infusion_duration_hours?: unknown;
  doses_given?: unknown;
  target_auc24?: unknown;
}

export function normalizeRegimen(raw: RawRegimen): NormalizedRegimen {
  const dose_mg = typeof raw.dose_mg === "number" && !Number.isNaN(raw.dose_mg) ? raw.dose_mg : 0;
  const interval_hours = typeof raw.interval_hours === "number" && !Number.isNaN(raw.interval_hours) ? raw.interval_hours : 0;
  const infusion_duration_hours = typeof raw.infusion_duration_hours === "number" && !Number.isNaN(raw.infusion_duration_hours) ? raw.infusion_duration_hours : 0;
  const doses_given = typeof raw.doses_given === "number" && raw.doses_given > 0 ? Math.round(raw.doses_given) : undefined;
  const target_auc24 = typeof raw.target_auc24 === "number" && raw.target_auc24 > 0 ? raw.target_auc24 : undefined;
  return {
    dose_mg: Math.max(0, dose_mg),
    interval_hours: Math.max(0, interval_hours),
    infusion_duration_hours: Math.max(0, infusion_duration_hours),
    doses_given,
    target_auc24,
  };
}
