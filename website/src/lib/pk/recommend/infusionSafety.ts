export const VANCOMYCIN_MAX_INFUSION_RATE_MG_PER_MIN = 10;
export const VANCOMYCIN_MAX_INFUSION_RATE_MG_PER_HOUR = VANCOMYCIN_MAX_INFUSION_RATE_MG_PER_MIN * 60;
export const VANCOMYCIN_MIN_INFUSION_DURATION_HOURS = 1;

export interface SafeInfusionDurationResult {
  infusion_duration_hours: number;
  adjusted_for_safety: boolean;
  safety_note?: string;
}

function roundToQuarterHour(hours: number): number {
  return Math.ceil(hours * 4) / 4;
}

export function computeSafeInfusionDurationHours(dose_mg: number, requested_hours?: number | null): SafeInfusionDurationResult {
  const derivedMinimumHours = Math.max(
    VANCOMYCIN_MIN_INFUSION_DURATION_HOURS,
    dose_mg / VANCOMYCIN_MAX_INFUSION_RATE_MG_PER_HOUR
  );
  const safeHours = roundToQuarterHour(derivedMinimumHours);
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
