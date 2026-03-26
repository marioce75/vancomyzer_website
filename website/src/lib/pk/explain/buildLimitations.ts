import type { ExplanationInput } from "../types";

export function buildLimitations(input: ExplanationInput): string[] {
  const { engineOutput } = input;
  const usedRefinement = engineOutput.used_posterior_refinement === true;
  const posteriorFit = engineOutput.posterior_fit;

  const items = usedRefinement
    ? [
        "Simple two-compartment adult prior model with bounded first-pass MAP refinement from level(s), not a full Bayesian engine.",
        "Population prior comes from an adult literature model and may fit poorly outside typical adult populations or when physiology is changing quickly.",
        "Clinical judgment and levels-based reassessment remain essential.",
      ]
    : [
        "Simple two-compartment adult population prior model only; no refinement from levels in this pass.",
        "Population prior comes from an adult literature model and may fit poorly outside typical adult populations or when physiology is changing quickly.",
        "Measured levels are displayed but not used to refine parameters in this pass.",
        "Clinical judgment and levels-based reassessment remain essential.",
      ];

  const isPulseDose = engineOutput.doses_given === 1;

  if (engineOutput.level_count === 1 && !usedRefinement) {
    items.unshift("Single level limits precision; adjustment is a first-pass estimate.");
  }
  if (isPulseDose) {
    items.unshift("Bayesian estimate based on single pre-steady-state level — monitor and confirm with a follow-up level after additional doses.");
    items.unshift("Pulse-dose / single-dose workflow: projected AUC24 and recommended maintenance dose assume steady-state PK will match the individual parameters estimated from this one level.");
  } else {
    items.unshift("Levels drawn during infusion or too close to infusion completion are not interpreted by this simple steady-state model and should be recollected later in the interval.");
  }
  items.unshift("Near-continuous infusion regimens are outside this intermittent steady-state model; infusion duration should remain materially shorter than the dosing interval.");
  if (engineOutput.level_count === 1 && usedRefinement) {
    items.unshift("Single level used for first-pass parameter refinement; posterior fit quality may be weak even when the model returns a bounded estimate.");
  }
  if (posteriorFit?.fit_quality === "weak") {
    items.unshift("Posterior fit quality was weak; sparse or mismatched levels should not be overinterpreted as precise patient-specific PK.");
  }
  if (posteriorFit?.uncertainty_label === "high") {
    items.unshift("Residual uncertainty remains high; exposure outputs should be treated as bounded decision-support estimates rather than precise predictions.");
  }

  return items;
}
