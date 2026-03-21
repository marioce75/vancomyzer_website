import type { ExplanationInput } from "../types";

export function buildAssumptions(input: ExplanationInput): string[] {
  const usedRefinement = input.engineOutput.used_posterior_refinement === true;
  const posteriorFit = input.engineOutput.posterior_fit;
  const fitText = posteriorFit
    ? `Posterior fit quality was ${posteriorFit.fit_quality} (${posteriorFit.fit_quality_reason}); uncertainty remains ${posteriorFit.uncertainty_label === "moderate" ? "meaningful" : posteriorFit.uncertainty_label === "high" ? "high" : "population-based"}.`
    : "Posterior fit quality was not assessed.";

  return [
    "Creatinine clearance estimated using Cockcroft-Gault with explicit adult weight selection (underweight: actual body weight; non-obese: ideal body weight; obese: adjusted body weight), using age, sex, height, weight, and serum creatinine.",
    "Two-compartment adult prior model explicit in code: Colin 2019 population prior.",
    "Steady-state assumed for AUC/peak/trough estimates.",
    "Level collection time assumed within the current dosing interval (time_since_last_dose ≤ interval).",
    usedRefinement
      ? "Measured level(s) can produce a bounded MAP-style first-pass posterior refinement around that adult prior; this is not a full Bayesian commercial engine."
      : "First-pass evaluation only; outputs remain on the explicit adult population prior model.",
    fitText,
  ];
}
