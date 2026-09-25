import type { NormalizedRegimen } from "../types";

export interface RawRegimen {
  dose_mg?: unknown;
  interval_hours?: unknown;
  infusion_duration_hours?: unknown;
  doses_given?: unknown;
  steady_state_confirmed?: unknown;
  target_auc24?: unknown;
  loading_dose_mg?: unknown;
  loading_infusion_duration_hours?: unknown;
  loading_to_maintenance_hours?: unknown;
}

export function normalizeRegimen(raw: RawRegimen): NormalizedRegimen {
  const dose_mg = typeof raw.dose_mg === "number" && !Number.isNaN(raw.dose_mg) ? raw.dose_mg : 0;
  const interval_hours = typeof raw.interval_hours === "number" && !Number.isNaN(raw.interval_hours) ? raw.interval_hours : 0;
  const infusion_duration_hours = typeof raw.infusion_duration_hours === "number" && !Number.isNaN(raw.infusion_duration_hours) ? raw.infusion_duration_hours : 0;
  const doses_given = typeof raw.doses_given === "number" && raw.doses_given > 0 ? Math.round(raw.doses_given) : undefined;
  const target_auc24 = typeof raw.target_auc24 === "number" && raw.target_auc24 > 0 ? raw.target_auc24 : undefined;
  const steady_state_confirmed = typeof raw.steady_state_confirmed === "boolean" ? raw.steady_state_confirmed : undefined;
  const pos = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined);
  const loading_dose_mg = pos(raw.loading_dose_mg);
  return {
    steady_state_confirmed,
    dose_mg: Math.max(0, dose_mg),
    interval_hours: Math.max(0, interval_hours),
    infusion_duration_hours: Math.max(0, infusion_duration_hours),
    doses_given,
    target_auc24,
    ...(loading_dose_mg !== undefined
      ? {
          loading_dose_mg,
          loading_infusion_duration_hours: pos(raw.loading_infusion_duration_hours),
          loading_to_maintenance_hours: pos(raw.loading_to_maintenance_hours),
        }
      : {}),
  };
}
