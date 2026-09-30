export const VANCOMYCIN_MAX_INFUSION_RATE_MG_PER_MIN = 10;
export const VANCOMYCIN_MAX_INFUSION_RATE_MG_PER_HOUR = VANCOMYCIN_MAX_INFUSION_RATE_MG_PER_MIN * 60;
export const VANCOMYCIN_MIN_INFUSION_DURATION_HOURS = 1;

export interface SafeInfusionDurationResult {
  infusion_duration_hours: number;
  adjusted_for_safety: boolean;
  safety_note?: string;
}

/** FDA labeling: no more than 10 mg/min, with a minimum of 60 minutes.
 * Keep the exact duration; rounding to quarter hours makes displayed minutes
 * and the duration used for exposure calculations disagree.
 */
export function computeSafeInfusionDurationMinutes(dose_mg: number): number {
  return Math.max(60, dose_mg / VANCOMYCIN_MAX_INFUSION_RATE_MG_PER_MIN);
}

export function computeSafeInfusionDurationHours(dose_mg: number, requested_hours?: number | null): SafeInfusionDurationResult {
  const safeHours = computeSafeInfusionDurationMinutes(dose_mg) / 60;
  const requested = requested_hours ?? 0;
  const adjusted = requested > 0 ? requested < safeHours : true;

  return {
    infusion_duration_hours: safeHours,
    adjusted_for_safety: adjusted,
    safety_note: adjusted
      ? "Infusion duration adjusted for safety (FDA labeling / guideline-aligned max rate 10 mg/min, minimum 60 minutes)."
      : undefined,
  };
}
