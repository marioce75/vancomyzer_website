import type { ExplanationInput } from "../types";

export function buildAssumptions(input: ExplanationInput): string[] {
  const usedRefinement = input.engineOutput.used_posterior_refinement === true;
  const posteriorFit = input.engineOutput.posterior_fit;
  const fitText = posteriorFit
    ? `Posterior fit quality was ${posteriorFit.fit_quality} (${posteriorFit.fit_quality_reason}); uncertainty remains ${posteriorFit.uncertainty_label === "moderate" ? "meaningful" : posteriorFit.uncertainty_label === "high" ? "high" : "population-based"}.`
    : "Posterior fit quality was not assessed.";

  const isPulseDose = input.engineOutput.doses_given === 1;

  return [
    "Serum creatinine (SCr) is used directly as the renal covariate in the Colin 2019 model — Cockcroft-Gault CrCl estimation is NOT used. CL scales with (0.83/SCr)^0.80 per the Colin 2019 published equations.",
    "Two-compartment adult prior model explicit in code: Colin 2019 population prior.",
    isPulseDose
      ? "Single-dose (pulse dose) Bayesian estimation: AUC24 and maintenance recommendations are projected from individual PK parameters estimated from one pre-steady-state level. Steady-state is NOT assumed."
      : "Steady-state assumed for AUC/peak/trough estimates.",
    isPulseDose
      ? "Level must be drawn in the post-distributive elimination phase (≥2 h after infusion completion) for valid single-dose PK estimation per ASHP/IDSA/SIDP 2020."
      : "Level collection time assumed within the current dosing interval (time_since_last_dose ≤ interval).",
    usedRefinement
      ? "Measured level(s) can produce a bounded MAP-style first-pass posterior refinement around that adult prior; this is not a full Bayesian commercial engine."
      : "First-pass evaluation only; outputs remain on the explicit adult population prior model.",
    fitText,
  ];
}
