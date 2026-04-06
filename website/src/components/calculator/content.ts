import type { CalculationDetails, CalculatorMode } from "@/types/calculator";

export function getModeScopedFieldErrors(
  mode: CalculatorMode,
  fieldErrors?: Record<string, string>
): Record<string, string> {
  if (!fieldErrors) return {};
  if (mode === "initial_regimen") {
    return Object.fromEntries(
      Object.entries(fieldErrors).filter(([key]) => key.startsWith("patient."))
    );
  }
  return fieldErrors;
}

export function getPreCalculationGuidanceItems(mode: CalculatorMode): string[] {
  const shared = [
    "Adult intermittent-infusion vancomycin workflow only.",
    "Not for pediatric, dialysis-specific, or continuous-infusion use.",
  ];

  const modeSpecific =
    mode === "initial_regimen"
      ? [
          "This workflow provides first-pass maintenance support from patient characteristics, not a high-certainty individualized regimen.",
          "Any loading-dose language should be treated as optional empiric support for clinician review, not as a severity-aware directive.",
        ]
      : [
          "Use levels from the current dosing interval and avoid levels drawn during infusion or immediately after infusion completion.",
          "Existing-regimen interpretation assumes routine, interpretable dose history; held, delayed, or cross-interval dosing may require recovery guidance instead of steady-state fitting.",
          "Single-level estimates may be more uncertain than coherent multi-level fits.",
        ];

  return [
    ...shared,
    ...modeSpecific,
    "Unstable renal function, poor chronology, or sparse/mistimed levels increase uncertainty and should not be overinterpreted.",
  ];
}

export function getResultScopeItems(
  recommendationType?: "initial_regimen" | "existing_regimen" | null
): string[] {
  const shared = [
    "Adult intermittent-infusion vancomycin workflow only; not for pediatric, dialysis-specific, or continuous-infusion use.",
    "Uses an explicit adult population prior with bounded first-pass level-based refinement when applicable; this is not presented as a validated commercial Bayesian platform.",
    "Review the assumptions, limitations, and clinical context before applying any dose change.",
  ];

  const modeSpecific =
    recommendationType === "initial_regimen"
      ? "This result is a maintenance-regimen suggestion from prior information only. Any loading-dose note is generic empiric support, not a patient-specific severity decision."
      : "Existing-regimen interpretation assumes intermittent steady-state timing. Levels drawn during infusion, too soon after infusion, or across unclear dosing history should not be overinterpreted.";

  return [shared[0], shared[1], modeSpecific, shared[2]];
}

export function evidenceTone(level: CalculationDetails["review_status"]["level"]): string {
  if (level === "caution") {
    return "bg-amber-100 text-amber-900 border border-amber-200";
  }
  if (level === "supported") {
    return "bg-emerald-100 text-emerald-900 border border-emerald-200";
  }
  return "bg-blue-100 text-blue-900 border border-blue-200";
}

export function reviewabilityStatusLabel(details: CalculationDetails): string {
  switch (details.review_status.level) {
    case "supported":
      return "Reviewability: stronger fit for review";
    case "caution":
      return "Reviewability: caution — limited interpretability";
    default:
      return "Reviewability: prior-only estimate";
  }
}

export function reviewabilityFaqHref(details: CalculationDetails): string {
  if (details.review_status.level === "caution") {
    return "/faq#one-level-reliability";
  }
  if (details.review_status.level === "prior_only") {
    return "/faq#replace-judgment";
  }
  return "/faq#verify-before-change";
}

export function reviewabilityTrustHref(details: CalculationDetails): string {
  if (details.review_status.level === "caution") {
    return "/references";
  }
  if (details.review_status.level === "prior_only") {
    return "/references";
  }
  return "/references";
}

export function fallbackLabel(
  fallbackWorkflow?: "initial_regimen" | "repeat_existing_regimen_sampling"
): string | null {
  if (fallbackWorkflow === "initial_regimen") {
    return "Fallback option: use the initial-regimen maintenance workflow if the current dose history is too irregular for steady-state interpretation.";
  }
  if (fallbackWorkflow === "repeat_existing_regimen_sampling") {
    return "Fallback option: repeat existing-regimen sampling later in a clearly interpretable dosing interval.";
  }
  return null;
}

export function repeatSamplingChecklist(
  fallbackWorkflow?: "initial_regimen" | "repeat_existing_regimen_sampling"
): string[] {
  if (fallbackWorkflow !== "repeat_existing_regimen_sampling") return [];
  return [
    "Confirm the actual dose administration time and infusion completion time.",
    "Collect the replacement level later in the same dosing interval, not during infusion or immediately after infusion.",
    "Re-enter the updated level timing before recalculating.",
  ];
}
