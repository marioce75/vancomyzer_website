import type { ExplanationInput } from "../types";
import { modelShortName, renalCovariateDescription } from "../modelRegistry";

export function buildAssumptions(input: ExplanationInput): string[] {
  const usedRefinement = input.engineOutput.used_posterior_refinement === true;
  const posteriorFit = input.engineOutput.posterior_fit;
  const fitText = posteriorFit
    ? `Posterior fit quality was ${posteriorFit.fit_quality} (${posteriorFit.fit_quality_reason}); uncertainty remains ${posteriorFit.uncertainty_label === "moderate" ? "meaningful" : posteriorFit.uncertainty_label === "high" ? "high" : "population-based"}.`
    : "Posterior fit quality was not assessed.";

  const dosesGiven = input.engineOutput.doses_given;
  // The engine's own horizon, so the prose and the numbers cannot disagree.
  const horizon = input.engineOutput.exposure_horizon;
  const isPulseDose = horizon === "single_dose";
  const isNonSteadyState = horizon === "actual_history";
  const approach = input.engineOutput.steady_state_approach;
  const actual = input.engineOutput.actual_history_exposure;
  // Which prior actually ran. Stating the wrong one here is a factual error in
  // text the clinician may paste into the record, so the wording comes from the
  // model registry for whichever model id the engine reports.
  const renalCovariateAssumption = renalCovariateDescription(input.engineOutput.model_name);

  const priorModelAssumption = `Two-compartment adult prior model explicit in code: ${modelShortName(input.engineOutput.model_name)} population prior.`;

  return [
    renalCovariateAssumption,
    priorModelAssumption,
    isPulseDose
      ? "Single-dose (pulse dose) Bayesian estimation: AUC24 and maintenance recommendations are projected from individual PK parameters estimated from one pre-steady-state level. Steady-state is NOT assumed."
      : isNonSteadyState
        ? `Actual-history analysis after ${dosesGiven} doses: the measured level was fitted by superposing exactly ${dosesGiven} doses. AUC24/peak/trough for the current regimen are its steady-state projection (comparable with the candidate regimens); the modelled dose-${dosesGiven} peak/trough${actual ? ` (${actual.peak.toFixed(1)} / ${actual.trough.toFixed(1)} mcg/mL, AUC over that interval ${actual.auc_interval_n.toFixed(0)} mg·h/L)` : ""} are reported separately${approach ? ` — the model puts the patient at ${(approach.fraction_of_steady_state * 100).toFixed(0)}% of steady state` : ""}.`
        : `Steady state confirmed by the clinician; AUC/peak/trough are steady-state estimates${input.engineOutput.steady_state_warning ? ` (model approach check: ${(approach?.fraction_of_steady_state ?? 0) * 100 | 0}% of plateau after ${dosesGiven} doses — see warning)` : ""}.`,
    isPulseDose
      ? "Level must be drawn in the post-distributive elimination phase (≥2 h after infusion completion) for valid single-dose PK estimation per ASHP/IDSA/SIDP 2020."
      : "Level collection time assumed within the current dosing interval (time_since_last_dose ≤ interval).",
    usedRefinement
      ? "Measured level(s) can produce a bounded MAP-style first-pass posterior refinement around that adult prior; this is not a full Bayesian commercial engine."
      : "First-pass evaluation only; outputs remain on the explicit adult population prior model.",
    fitText,
  ];
}
