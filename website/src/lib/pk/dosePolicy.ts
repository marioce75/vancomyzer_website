/**
 * Institutional dose ceilings, as a plain object the engine can take.
 *
 * A pharmacy department configures these at /settings; the API validated them,
 * persisted them to data/institutional_settings.json and reported "Settings
 * saved successfully" — and then the engine never read them. With
 * max_single_dose_mg 500 / max_daily_dose_mg 1000 actually configured, every
 * recommendation still came out of the hard-coded 2000 / 4500 literals.
 *
 * This type is deliberately a plain value object rather than a call into
 * institutionalSettings.ts: that module imports node `fs` at module scope, so
 * importing it from the engine would break client-side bundling of
 * initialRegimen.ts. The route resolves the settings and passes this in.
 *
 * SETTINGS MAY ONLY TIGHTEN. Every field is clamped to the guideline-derived
 * maximum in dosePolicyFromSettings, so a configuration file cannot raise a
 * safety ceiling — only lower it. The ceilings themselves are sourced in
 * initialRegimen.ts and buildAdjustmentRecommendation.ts.
 */
export interface DosePolicy {
  /** Largest single maintenance dose (mg). Guideline ceiling 2000. */
  maxSingleDoseMg: number;
  /** Largest total daily dose (mg/day). Guideline ceiling 4500. */
  maxDailyDoseMg: number;
  /** Empiric loading dose per kg of actual body weight. Guideline 25 mg/kg. */
  loadingDoseMgPerKg: number;
  /** Absolute cap on the empiric loading dose (mg). Guideline ceiling 3000. */
  loadingDoseMaxMg: number;
}

/** Guideline-derived ceilings — the values the engine used as literals. */
export const DEFAULT_DOSE_POLICY: DosePolicy = {
  maxSingleDoseMg: 2000,
  maxDailyDoseMg: 4500,
  loadingDoseMgPerKg: 25,
  loadingDoseMaxMg: 3000,
};

/** Fields read off InstitutionalSettings. Loosely typed to avoid importing the fs-backed module. */
export interface DosePolicySettingsInput {
  max_single_dose_mg?: unknown;
  max_daily_dose_mg?: unknown;
  loading_dose_mg_per_kg?: unknown;
  loading_dose_max_mg?: unknown;
}

/** Positive finite number, or undefined. */
function positive(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Map persisted institutional settings onto the engine's policy, clamped so a
 * configured value can only ever be more conservative than the guideline
 * ceiling. An institution that sets 6000 mg/day gets 4500.
 */
export function dosePolicyFromSettings(settings: DosePolicySettingsInput | null | undefined): DosePolicy {
  if (!settings) return { ...DEFAULT_DOSE_POLICY };
  const tighten = (configured: unknown, ceiling: number) =>
    Math.min(ceiling, positive(configured) ?? ceiling);
  return {
    maxSingleDoseMg: tighten(settings.max_single_dose_mg, DEFAULT_DOSE_POLICY.maxSingleDoseMg),
    maxDailyDoseMg: tighten(settings.max_daily_dose_mg, DEFAULT_DOSE_POLICY.maxDailyDoseMg),
    loadingDoseMgPerKg: tighten(settings.loading_dose_mg_per_kg, DEFAULT_DOSE_POLICY.loadingDoseMgPerKg),
    loadingDoseMaxMg: tighten(settings.loading_dose_max_mg, DEFAULT_DOSE_POLICY.loadingDoseMaxMg),
  };
}
