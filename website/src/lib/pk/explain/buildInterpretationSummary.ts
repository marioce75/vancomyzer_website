import type { ExplanationInput } from "../types";
import { infusionChangeText } from "../regimenIdentity";

function buildRegimenChangeExplanation(input: ExplanationInput): string {
  const { engineOutput, recommendation } = input;
  const currentDose = engineOutput.current_regimen_dose_mg;
  const currentInterval = engineOutput.current_regimen_interval_hours;
  const recommendedDose = parseInt(recommendation.recommended_dose.replace(/\D/g, ""), 10) || currentDose;
  const recommendedInterval = recommendation.recommended_interval_hours;

  const changeParts: string[] = [];
  if (recommendedDose > currentDose) changeParts.push("higher dose");
  if (recommendedDose < currentDose) changeParts.push("lower dose");
  if (recommendedInterval > currentInterval) changeParts.push("longer interval");
  if (recommendedInterval < currentInterval) changeParts.push("shorter interval");

  if (changeParts.length === 0) {
    // Same dose and interval is the same regimen only when the infusion
    // duration is also unchanged (regimenIdentity.ts). Wording only.
    const infusionChange = infusionChangeText(
      { dose_mg: currentDose, interval_hours: currentInterval, infusion_duration_hours: engineOutput.current_regimen_infusion_hours },
      { dose_mg: recommendedDose, interval_hours: recommendedInterval, infusion_duration_hours: recommendation.recommended_infusion_duration_hours ?? engineOutput.current_regimen_infusion_hours },
    );
    if (infusionChange) {
      return `Change rationale: dose and interval are unchanged; ${infusionChange}.`;
    }
    return "Recommendation remains on the same practical regimen step after bounded review of exposure and timing semantics.";
  }

  return `Change rationale: recommends a ${changeParts.join(" and ")} relative to the current regimen to move estimated exposure toward the target range while keeping interpretation bounded.`;
}

function buildSparseHighExposureNote(input: ExplanationInput): string {
  const { engineOutput, recommendation } = input;
  const currentInterval = engineOutput.current_regimen_interval_hours;
  const recommendedInterval = recommendation.recommended_interval_hours;

  if (
    engineOutput.level_count <= 1 &&
    (engineOutput.posterior_fit?.fit_quality === "weak" || engineOutput.posterior_fit?.uncertainty_label === "high") &&
    recommendedInterval > currentInterval &&
    (engineOutput.auc24 >= 650 || engineOutput.trough >= 20 || engineOutput.peak >= 45)
  ) {
    return " Because exposure appears clearly high despite sparse evidence, the bounded recommendation permits interval extension instead of only a same-interval dose reduction.";
  }

  return "";
}

export function buildInterpretationSummary(input: ExplanationInput): string {
  const { engineOutput, recommendation } = input;
  const { auc24, peak, trough, scr, current_regimen_dose_mg, current_regimen_interval_hours, data_quality_note, used_posterior_refinement, posterior_fit, doses_given } = engineOutput;

  const isPulseDose = doses_given === 1;

  const estimateType = used_posterior_refinement
    ? posterior_fit?.uncertainty_label === "high"
      ? "Posterior-updated but high-uncertainty estimate"
      : "Posterior-updated estimate"
    : "Initial population estimate";

  // A refusal must not also state a recommendation. When the safety layer blocks
  // maintenance dosing, recommended_dose is the sentinel "—" and the interval is
  // 0, so this used to read "Recommended adjustment: — every 0 h infused over 0 h"
  // followed by a rationale claiming a SHORTER interval was being recommended —
  // pointing the opposite way from the hold the safety card states, for a patient
  // in severe AKI. Report the estimates, then the refusal, and stop.
  const blocked = recommendation.adjustment_dosing_blocked;
  if (blocked) {
    return (
      (isPulseDose ? `Recorded single dose: ${current_regimen_dose_mg} mg. ` : `Current regimen: ${current_regimen_dose_mg} mg every ${current_regimen_interval_hours} h. `) +
      `${estimateType}: AUC24 ${auc24} mg·h/L; peak ${peak} mg/L; trough ${trough} mg/L. ` +
      `Two-compartment model (SCr ${scr} mg/dL). ` +
      `${blocked.safety_message} ${blocked.recommended_action} ` +
      `Fit quality ${posterior_fit?.fit_quality ?? "not_applicable"}; uncertainty ${posterior_fit?.uncertainty_label ?? "population_only"}. ` +
      `${data_quality_note} Intended to support review, not replace clinician judgment.`
    );
  }

  // Recommendation withheld for review (discordant same-time levels). The
  // adjustment was computed before the hold and is withdrawn from the response,
  // so this text must not state it either: report what was entered and
  // estimated, then the hold and its reason, and stop.
  const hold = input.review_hold;
  if (hold) {
    return (
      (isPulseDose
        ? `Single-dose analysis: ${current_regimen_dose_mg} mg, one dose only. ${estimateType}: first-dose AUC24 ${auc24} mg·h/L; peak ${peak} mg/L; trough ${trough} mg/L (SCr ${scr} mg/dL). `
        : `Current regimen: ${current_regimen_dose_mg} mg every ${current_regimen_interval_hours} h. ${estimateType}: AUC24 ${auc24} mg·h/L; peak ${peak} mg/L; trough ${trough} mg/L. Two-compartment model (SCr ${scr} mg/dL). `) +
      `Recommendation withheld. ${hold.message} ` +
      `Fit quality ${posterior_fit?.fit_quality ?? "not_applicable"}; uncertainty ${posterior_fit?.uncertainty_label ?? "population_only"}. ` +
      `${data_quality_note} Intended to support review, not replace clinician judgment.`
    );
  }

  const infusionDuration = recommendation.recommended_infusion_duration_hours ?? engineOutput.current_regimen_infusion_hours ?? 1;
  const infusionSafetyNote = recommendation.infusion_duration_adjusted_for_safety && recommendation.infusion_safety_note
    ? ` ${recommendation.infusion_safety_note}`
    : "";

  // Single dose (a loading dose, or one maintenance dose) — different interpretation format.
  // The engine cannot tell a loading dose from a single maintenance dose here
  // (the loading-dose fields travel only with multi-dose histories), so the
  // wording names neither; and it must not ask for a "first level" when the
  // estimate already rests on one.
  if (isPulseDose) {
    const levelCount = engineOutput.level_count;
    const levelNote =
      levelCount >= 1
        ? `Estimate based on ${levelCount === 1 ? "one measured level" : `${levelCount} measured levels`} after this single dose; confirm with a follow-up level after further doses.`
        : "No level entered yet: draw the first level 1.5–6 h after the end of this dose's infusion for early Bayesian estimation.";
    return (
      `Single-dose analysis: ${current_regimen_dose_mg} mg, one dose only. ` +
      `${estimateType}: first-dose AUC24 ${auc24} mg·h/L; peak ${peak} mg/L; trough ${trough} mg/L (SCr ${scr} mg/dL). ` +
      `Suggested maintenance regimen: ${recommendation.recommended_dose} every ${recommendation.recommended_interval_hours} h infused over ${Number((infusionDuration * 60).toFixed(6))} minutes. ` +
      `Maintenance dose targets steady-state AUC24 400–600 mg·h/L.` +
      `${infusionSafetyNote} ` +
      `${data_quality_note} ${levelNote} Intended to support review, not replace clinician judgment.`
    );
  }

  const conservativeRecommendationNote =
    posterior_fit?.fit_quality === "weak" || posterior_fit?.uncertainty_label === "high"
      ? " Recommendation kept conservative because posterior evidence is weak/high-uncertainty."
      : "";
  const changeExplanation = buildRegimenChangeExplanation(input);
  const sparseHighExposureNote = buildSparseHighExposureNote(input);

  return (
    `Current regimen: ${current_regimen_dose_mg} mg every ${current_regimen_interval_hours} h. ` +
    `${estimateType}: AUC24 ${auc24} mg·h/L; peak ${peak} mg/L; trough ${trough} mg/L. ` +
    `Two-compartment model (SCr ${scr} mg/dL). ` +
    `Recommended adjustment: ${recommendation.recommended_dose} every ${recommendation.recommended_interval_hours} h infused over ${Number((infusionDuration * 60).toFixed(6))} minutes. ` +
    `${changeExplanation} ` +
    `Fit quality ${posterior_fit?.fit_quality ?? "not_applicable"}; uncertainty ${posterior_fit?.uncertainty_label ?? "population_only"}.` +
    `${infusionSafetyNote}${conservativeRecommendationNote}${sparseHighExposureNote} ${data_quality_note} Intended to support review, not replace clinician judgment.`
  );
}
