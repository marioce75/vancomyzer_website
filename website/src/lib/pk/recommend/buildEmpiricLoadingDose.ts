import { computeSafeInfusionDurationHours } from "./infusionSafety";
import { DEFAULT_DOSE_POLICY, type DosePolicy } from "../dosePolicy";

export interface EmpiricLoadingDoseInput {
  actual_body_weight_kg: number;
  /** Institutional ceilings. Defaults to the guideline values when absent. */
  policy?: DosePolicy;
}

export interface EmpiricLoadingDoseRecommendation {
  suggested_dose_mg: number;
  /**
   * Minimum safe infusion duration for THIS dose. The loading dose used to be
   * emitted with no duration at all, while the only duration printed anywhere
   * nearby was the maintenance dose's — so a 3000 mg load sat directly above
   * "infuse over 1.25 hours", which is 40 mg/min, four times the 10 mg/min
   * ceiling the same output cites.
   */
  infusion_duration_hours: number;
  basis: string;
}

// Guideline values live in DEFAULT_DOSE_POLICY; an institution may lower them
// at /settings but never raise them (see dosePolicyFromSettings).

function roundDoseMg(mg: number): number {
  const rounded = Math.round(mg / 250) * 250;
  if (rounded < 250) return 250;
  return rounded;
}

export function buildEmpiricLoadingDose(
  input: EmpiricLoadingDoseInput
): EmpiricLoadingDoseRecommendation {
  const policy = input.policy ?? DEFAULT_DOSE_POLICY;
  const abw = Math.max(0, input.actual_body_weight_kg);
  const dose = Math.min(
    policy.loadingDoseMaxMg,
    roundDoseMg(abw * policy.loadingDoseMgPerKg)
  );

  const infusion_duration_hours = computeSafeInfusionDurationHours(dose).infusion_duration_hours;
  const perLocalProtocol = policy.loadingDoseMgPerKg !== DEFAULT_DOSE_POLICY.loadingDoseMgPerKg
    || policy.loadingDoseMaxMg !== DEFAULT_DOSE_POLICY.loadingDoseMaxMg
    ? " These limits come from your institution's configured settings."
    : "";

  return {
    suggested_dose_mg: dose,
    infusion_duration_hours,
    basis: `Guideline-aligned optional empiric loading-dose estimate using actual body weight at ${policy.loadingDoseMgPerKg} mg/kg, capped at ${policy.loadingDoseMaxMg} mg, infused over at least ${infusion_duration_hours} h to stay within the 10 mg/min maximum rate. This does not encode severity, indication, or local protocol.${perLocalProtocol}`,
  };
}
