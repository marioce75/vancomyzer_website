import type { CalculateRequestPatient, CalculateResponse } from "../types/calculator";

export const EMPIRIC_PROFILE_HOLD = "older_low_scr_severe_obesity" as const;
export const EMPIRIC_PROFILE_TITLE = "Renal estimate uncertain: review required";
export const EMPIRIC_PROFILE_MESSAGE = "Older age, very low measured serum creatinine and severe obesity are combined here. The creatinine-based estimate may overstate clearance.";
export const EMPIRIC_PROFILE_OPTIONS = "No scheduled, loading or pulse dose is suggested.";
export const EMPIRIC_PROFILE_ACTION = "Verify the measured creatinine and renal trend with pharmacy before selecting a regimen. Follow your institutional protocol and consider early therapeutic monitoring when appropriate.";
export const EMPIRIC_PROFILE_LIMIT = "This is a conservative product safeguard, not a validated clinical cutoff.";
export const EMPIRIC_PROFILE_NO_EXPOSURE = "No regimen exposure or concentration curve is provided for this review-only case.";
export const EMPIRIC_PROFILE_CL = "Colin 2019 clearance (review only)";
export const EMPIRIC_PROFILE_SCR = "Measured serum creatinine (as entered)";

/** Product review criterion, not a validated treatment threshold or change to Colin. */
export function shouldHoldEmpiricProfile(patient: Partial<CalculateRequestPatient>) {
  const { age, height_cm, weight_kg, serum_creatinine_mg_dl: scr } = patient;
  return typeof age === "number" && Number.isFinite(age) && age >= 65
    && typeof scr === "number" && Number.isFinite(scr) && scr > 0 && scr < 0.4
    && typeof height_cm === "number" && Number.isFinite(height_cm) && height_cm >= 100 && height_cm <= 250
    && typeof weight_kg === "number" && Number.isFinite(weight_kg)
    && weight_kg * 10_000 / (height_cm * height_cm) >= 40;
}

export function isEmpiricProfileHold(result?: Pick<CalculateResponse, "empiric_dosing_blocked"> | null) {
  return result?.empiric_dosing_blocked?.reason_code === EMPIRIC_PROFILE_HOLD;
}
