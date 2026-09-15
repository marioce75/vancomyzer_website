import type { ExplanationInput } from "../types";

export function buildAssumptions(input: ExplanationInput): string[] {
  const usedRefinement = input.engineOutput.used_posterior_refinement === true;
  const posteriorFit = input.engineOutput.posterior_fit;
  const fitText = posteriorFit
    ? `Posterior fit quality was ${posteriorFit.fit_quality} (${posteriorFit.fit_quality_reason}); uncertainty remains ${posteriorFit.uncertainty_label === "moderate" ? "meaningful" : posteriorFit.uncertainty_label === "high" ? "high" : "population-based"}.`
    : "Posterior fit quality was not assessed.";

  const isPulseDose = input.engineOutput.doses_given === 1;
  const dosesGiven = input.engineOutput.doses_given;
  const isNonSteadyState = dosesGiven !== undefined && dosesGiven < 5;
  // Which prior actually ran. Stating the wrong one here is a factual error in
  // text the clinician may paste into the record, so both branches are explicit.
  const isObesityModel = input.engineOutput.model_name === "vancomyzer_obesity";

  const renalCovariateAssumption = isObesityModel
    ? "Vancomycin clearance is estimated from Cockcroft-Gault creatinine clearance (calculated on total body weight) plus a total-body-weight term, then multiplied by an age-decline factor: CL = (0.0571 × CrCl + 0.0158 × TBW) × FDecline(age)."
    : "Serum creatinine (SCr) is used directly as the renal covariate in the Colin 2019 model — Cockcroft-Gault CrCl estimation is NOT used. The SCr effect on clearance is FSCR = exp(−0.649 × (SCr − SCRstd)), where SCRstd is the age-standardised reference creatinine.";

  const priorModelAssumption = isObesityModel
    ? "Two-compartment adult prior model explicit in code: Vancomyzer Obesity Model (volumes scale to fat-free mass), used because BMI ≥ 40 with height and sex provided."
    : "Two-compartment adult prior model explicit in code: Colin 2019 population prior.";

  return [
    renalCovariateAssumption,
    priorModelAssumption,
    isPulseDose
      ? "Single-dose (pulse dose) Bayesian estimation: AUC24 and maintenance recommendations are projected from individual PK parameters estimated from one pre-steady-state level. Steady-state is NOT assumed."
      : isNonSteadyState
        ? `Non-steady-state analysis based on ${dosesGiven} doses: peak and trough are taken from the modelled ${dosesGiven}th dosing interval, while AUC24 is reported on a steady-state basis and therefore overstates exposure accumulated so far.`
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
