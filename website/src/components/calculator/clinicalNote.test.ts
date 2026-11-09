/**
 * Copied note / PDF content (clinicalNote.ts): the exposure of the dose(s)
 * already given is never mixed with the exposure of a proposed regimen, the
 * one-level caution travels with the note, and nothing is recomputed.
 * Synthetic responses only.
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { CalculateRequestRegimen, CalculateResponse } from "@/types/calculator";
import { buildClinicalNote, buildExposureSummary, composeClinicalNote, ONE_LEVEL_UNCERTAINTY_SUMMARY, oneLevelCautionApplies } from "./clinicalNote";
import { runExistingRegimenPipeline } from "@/lib/pk/runExistingRegimenPipeline";

const engineNote = [
  "Vancomycin existing regimen evaluation (Posterior-updated estimate).",
  "AUC24: 612.4 mg·h/L; peak 48.2 mg/L; trough 9.1 mg/L.",
  "Recommendation: 1000 every 12 h infused over 60 minutes",
  "Maintenance projection after a recorded single dose of 2000 mg; no prior maintenance interval is implied.",
  "SCr: 1 mg/dL (direct Colin 2019 covariate in the population prior; separate fitted-clearance cap uses Cockcroft-Gault). Explicit adult prior model: Colin 2019 two-compartment; bounded initial posterior update from level(s).",
  "Posterior fit quality: weak (single level). Uncertainty: high. Sparse levels do not justify overconfident patient-specific precision.",
].join("\n");

const loadOnlyRegimen: CalculateRequestRegimen = {
  dose_mg: 2000, interval_hours: 12, infusion_duration_hours: 200 / 60, doses_given: 1, steady_state_confirmed: false,
  target_auc24: 450, loading_dose_mg: 2000, loading_infusion_duration_hours: 200 / 60,
};
const caution = { review_status: { level: "caution", workflow_fit: "single_level", banner_title: "t", banner_body: "b", next_actions: [] }, evidence_strength: "", data_quality_summary: "" } as unknown as CalculateResponse["calculation_details"];
const singleDoseResponse = {
  recommendation_type: "existing_regimen" as const,
  auc24: 612.4, peak: 48.2, trough: 9.1,
  recommended_dose: "1000", recommended_interval_hours: 12, recommended_infusion_duration_hours: 1,
  predicted_auc24: 486.3, predicted_peak: 31.2, predicted_trough: 10.4,
  frequency_options: [
    { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1, auc24: 486.3, peak: 31.2, trough: 10.4, is_recommended: true, clinical_note: engineNote.replace("AUC24: 612.4 mg·h/L; peak 48.2 mg/L; trough 9.1 mg/L.", "AUC24: 486.3 mg·h/L; peak 31.2 mg/L; trough 10.4 mg/L.") },
    { dose_mg: 1250, interval_hours: 12, infusion_duration_hours: 1.5, auc24: 607.9, peak: 39, trough: 13, is_recommended: false, clinical_note: engineNote.replace("AUC24: 612.4 mg·h/L; peak 48.2 mg/L; trough 9.1 mg/L.", "AUC24: 607.9 mg·h/L; peak 39 mg/L; trough 13 mg/L.").replace("1000 every 12 h infused over 60 minutes", "1250 every 12 h infused over 90 minutes") },
  ],
  documentation_preview: { quick_summary: "", clinical_note: engineNote },
  calculation_details: caution,
};
const level = [{ value_mcg_ml: 22, time_since_last_dose_hours: 6 }];

test("loading dose only, engine recommendation selected: the dose given and the proposed regimen are separate sentences with their own figures", () => {
  const { summary, note } = buildClinicalNote({
    regimen: loadOnlyRegimen, response: singleDoseResponse, activeOption: singleDoseResponse.frequency_options[0], activeIsCurrent: false,
    singleDoseStatus: "given", levels: level,
  });
  assert.ok(summary);
  assert.equal(summary.given.title, "Dose already given");
  assert.equal(summary.given.regimen, "2000 mg × 1 (loading dose)");
  assert.deepEqual(summary.given.figures, { auc24: 612.4, peak: 48.2, trough: 9.1 });
  assert.equal(summary.proposed?.title, "Proposed maintenance regimen (not yet given)");
  assert.equal(summary.proposed?.regimen, "1000 mg every 12 h infused over 60 minutes");
  assert.deepEqual(summary.proposed?.figures, { auc24: 486.3, peak: 31.2, trough: 10.4 });
  assert.equal(summary.proposed?.origin, "engine");
  const lines = note.split("\n");
  assert.equal(lines[0], "Vancomycin existing regimen evaluation (Posterior-updated estimate).");
  assert.ok(lines.includes("Dosing history entered: 2,000 mg loading dose only, no maintenance dose yet. Level drawn after the loading dose."));
  assert.ok(lines.includes("Measured level 1: 22 mg/L, 6 h after the start of the last dose."));
  assert.ok(lines.includes("Dose already given: 2000 mg × 1 (loading dose). Exposure of this one dose over its first 24 h, not steady state: AUC24 612.4 mg·h/L; peak 48.2 mg/L; trough 9.1 mg/L."));
  assert.ok(lines.includes("Proposed maintenance regimen (not yet given): 1000 mg every 12 h infused over 60 minutes. Projected steady-state exposure if this regimen is given: AUC24 486.3 mg·h/L; peak 31.2 mg/L; trough 10.4 mg/L. Engine recommendation."));
  // The engine's unlabelled lines are gone; its model and fit lines stay.
  assert.ok(!lines.some((l) => l.startsWith("AUC24:")), "unlabelled AUC24 line must not remain");
  assert.ok(!lines.some((l) => l.startsWith("Recommendation:")));
  assert.ok(lines.some((l) => l.startsWith("SCr: 1 mg/dL")));
  assert.ok(lines.some((l) => l.startsWith("Posterior fit quality:")));
  // The two exposures never share a line.
  const givenLine = lines.find((l) => l.startsWith("Dose already given"))!;
  assert.ok(!givenLine.includes("486.3") && !givenLine.includes("1000 mg"));
  const proposedLine = lines.find((l) => l.startsWith("Proposed maintenance regimen"))!;
  assert.ok(!proposedLine.includes("612.4"));
  // One level: the caution is the last line, verbatim.
  assert.equal(lines[lines.length - 1], `One measured level: ${ONE_LEVEL_UNCERTAINTY_SUMMARY}`);
  assert.ok(/does not establish the patient's true renal function or predict how it will change/.test(note));
});

test("an alternative candidate names itself as selected by the clinician and states the engine recommendation", () => {
  const { note, summary } = buildClinicalNote({
    regimen: loadOnlyRegimen, response: singleDoseResponse, activeOption: singleDoseResponse.frequency_options[1], activeIsCurrent: false,
    singleDoseStatus: "given", levels: level,
  });
  assert.equal(summary?.proposed?.origin, "selected");
  assert.equal(summary?.proposed?.engineRecommendation, "1000 mg every 12 h infused over 60 minutes");
  assert.ok(note.includes("Proposed maintenance regimen (not yet given): 1250 mg every 12 h infused over 90 minutes. Projected steady-state exposure if this regimen is given: AUC24 607.9 mg·h/L; peak 39 mg/L; trough 13 mg/L. Candidate selected by the clinician; the engine recommendation is 1000 mg every 12 h infused over 60 minutes."));
  assert.ok(note.includes("Dose already given: 2000 mg × 1 (loading dose). Exposure of this one dose over its first 24 h, not steady state: AUC24 612.4 mg·h/L"));
});

test("the 'as entered' row still reports the engine recommendation as proposed, not given", () => {
  const { note } = buildClinicalNote({
    regimen: loadOnlyRegimen, response: singleDoseResponse, activeOption: { ...singleDoseResponse.frequency_options[0], clinical_note: engineNote }, activeIsCurrent: true,
    singleDoseStatus: "given", levels: level,
  });
  assert.ok(note.includes("Dose already given: 2000 mg × 1 (loading dose)."));
  assert.ok(note.includes("Proposed maintenance regimen (not yet given): 1000 mg every 12 h infused over 60 minutes. Projected steady-state exposure if this regimen is given: AUC24 486.3 mg·h/L; peak 31.2 mg/L; trough 10.4 mg/L. Engine recommendation."));
});

test("a single maintenance dose without a loading dose is called a single dose, and a suggested dose is marked not given", () => {
  const single: CalculateRequestRegimen = { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1, doses_given: 1, steady_state_confirmed: false, target_auc24: 450 };
  const s = buildExposureSummary({ regimen: single, response: singleDoseResponse, selectedOption: null, singleDoseStatus: "single", levels: level });
  assert.equal(s.given.regimen, "1000 mg × 1 (single dose)");
  assert.equal(s.history, "One 1,000 mg dose, no loading dose. Level drawn after that dose.");
  const preview = buildExposureSummary({ regimen: { ...single, dose_mg: 2000 }, response: { ...singleDoseResponse, calculation_details: undefined }, selectedOption: null, singleDoseStatus: "suggested", levels: [] });
  assert.equal(preview.given.title, "Suggested dose (not given)");
  assert.equal(preview.given.regimen, "2000 mg × 1 (suggested loading dose, not given)");
  assert.equal(preview.caution, null);
});

test("blocked recommendation: the note says no regimen is proposed and carries the engine's action", () => {
  const blocked = {
    ...singleDoseResponse,
    recommended_dose: "—", recommended_interval_hours: 0, frequency_options: [],
    adjustment_dosing_blocked: { reason: "r", recommended_action: "Hold maintenance dosing; recheck level when trough < 10 mg/L; redose via the 1 Level tab.", safety_message: "No safe maintenance regimen exists in the search space for this patient.", estimated_cl_l_h: 0.8 },
    documentation_preview: { quick_summary: "", clinical_note: "Vancomycin existing regimen evaluation (Posterior-updated estimate).\nAUC24: 612.4 mg·h/L; peak 48.2 mg/L; trough 9.1 mg/L.\nMaintenance dosing held — No safe maintenance regimen exists in the search space for this patient.\nHold maintenance dosing; recheck level when trough < 10 mg/L; redose via the 1 Level tab.\nSCr: 1 mg/dL.\nPosterior fit quality: weak." },
  };
  const { summary, note } = buildClinicalNote({ regimen: loadOnlyRegimen, response: blocked, activeOption: null, activeIsCurrent: false, singleDoseStatus: "given", levels: level });
  assert.equal(summary?.proposed, null);
  assert.ok(note.includes("Proposed maintenance regimen: none. Hold maintenance dosing; recheck level when trough < 10 mg/L; redose via the 1 Level tab."));
  assert.ok(note.includes("Dose already given: 2000 mg × 1 (loading dose). Exposure of this one dose over its first 24 h, not steady state: AUC24 612.4 mg·h/L"));
  assert.ok(note.includes("Maintenance dosing held — No safe maintenance regimen exists"), "the engine's hold lines are kept");
  assert.ok(!/Proposed maintenance regimen \(not yet given\)/.test(note));
});

test("multi-dose history: current regimen as entered vs. proposed adjustment, with the modelled exposure at the last dose", () => {
  const regimen: CalculateRequestRegimen = { dose_mg: 750, interval_hours: 12, infusion_duration_hours: 1.25, doses_given: 2, steady_state_confirmed: false, loading_dose_mg: 2000, loading_infusion_duration_hours: 200 / 60 };
  const response = {
    ...singleDoseResponse,
    auc24: 410.2, peak: 27.1, trough: 8.3,
    exposure_horizon: "actual_history" as const,
    actual_history_exposure: { doses_given: 2, peak: 31.456, trough: 12.345, auc_interval_n: 388.9, auc_0_24h: 700 },
    frequency_options: [{ dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1.5, auc24: 546.9, peak: 36.1, trough: 11.1, is_recommended: true }],
  };
  const s = buildExposureSummary({ regimen, response, selectedOption: null, singleDoseStatus: "given", levels: level });
  assert.equal(s.given.title, "Current regimen as entered");
  assert.equal(s.given.regimen, "750 mg every 12 h after a 2000 mg loading dose (2 doses given, including the loading dose)");
  assert.equal(s.given.period, "steady-state projection if this regimen is continued unchanged");
  assert.equal(s.given.atLastDose, "Modelled exposure at dose 2: peak 31.5 mg/L; trough 12.3 mg/L; AUC over that interval 389 mg·h/L.");
  assert.equal(s.proposed?.title, "Proposed adjustment (not yet given)");
  assert.equal(s.proposed?.regimen, "1000 mg every 12 h infused over 90 minutes");
  assert.deepEqual(s.proposed?.figures, { auc24: 546.9, peak: 36.1, trough: 11.1 });
  // Same regimen recommended back: not "an adjustment".
  const same = buildExposureSummary({ regimen: { ...regimen, dose_mg: 1000, infusion_duration_hours: 1.5 }, response, selectedOption: null, singleDoseStatus: "given", levels: level });
  assert.equal(same.proposed?.title, "Proposed regimen (continue as entered)");
  assert.equal(same.proposed?.regimen, "1000 mg every 12 h infused over 90 minutes");
  assert.equal(same.proposed?.period, "projected steady-state exposure if this regimen is continued");
  // The same regimen chosen as a candidate reads the same way.
  const sameSelected = buildExposureSummary({ regimen: { ...regimen, dose_mg: 1000, infusion_duration_hours: 1.5 }, response, selectedOption: response.frequency_options[0], singleDoseStatus: "given", levels: level });
  assert.equal(sameSelected.proposed?.title, "Proposed regimen (continue as entered)");
  const note = composeClinicalNote("Vancomycin existing regimen evaluation (Posterior-updated estimate).\nAUC24: 410.2 mg·h/L; peak 27.1 mg/L; trough 8.3 mg/L.\nRecommendation: 1000 every 12 h infused over 90 minutes\nChange summary: dose increase from 750 mg to 1000 mg.\nSCr: 1 mg/dL.", s);
  assert.ok(note.includes("Current regimen as entered: 750 mg every 12 h after a 2000 mg loading dose (2 doses given, including the loading dose). Steady-state projection if this regimen is continued unchanged: AUC24 410.2 mg·h/L; peak 27.1 mg/L; trough 8.3 mg/L. Modelled exposure at dose 2: peak 31.5 mg/L; trough 12.3 mg/L; AUC over that interval 389 mg·h/L."));
  assert.ok(note.includes("Change summary: dose increase from 750 mg to 1000 mg."));
});

test("the caution follows the on-screen rule: existing regimen, review level caution, exactly one level", () => {
  assert.equal(oneLevelCautionApplies(singleDoseResponse, 1), true);
  assert.equal(oneLevelCautionApplies(singleDoseResponse, 2), false);
  assert.equal(oneLevelCautionApplies({ ...singleDoseResponse, recommendation_type: "initial_regimen" }, 1), false);
  assert.equal(oneLevelCautionApplies({ ...singleDoseResponse, calculation_details: undefined }, 1), false);
  // Two levels: no caution line in the note.
  const { note } = buildClinicalNote({ regimen: loadOnlyRegimen, response: singleDoseResponse, activeOption: null, activeIsCurrent: false, singleDoseStatus: "given", levels: [...level, { value_mcg_ml: 11, time_since_last_dose_hours: 11 }] });
  assert.ok(!note.includes("One measured level:"));
  assert.ok(note.includes("Measured level 2: 11 mg/L, 11 h after the start of the last dose."));
});

test("Empiric results keep the engine's note untouched", () => {
  const { summary, note } = buildClinicalNote({
    regimen: loadOnlyRegimen, response: { ...singleDoseResponse, recommendation_type: "initial_regimen" }, activeOption: null, activeIsCurrent: false,
    singleDoseStatus: "single", levels: [],
  });
  assert.equal(summary, null);
  assert.equal(note, engineNote);
});

test("real engine output: every figure in the note is copied from the response", () => {
  const regimen: CalculateRequestRegimen = { dose_mg: 750, interval_hours: 12, infusion_duration_hours: 1.25, doses_given: 2, steady_state_confirmed: false, loading_dose_mg: 2000, loading_infusion_duration_hours: 200 / 60 };
  const pt = { age: 55, weight_kg: 75, height_cm: 175, sex: "male", serum_creatinine_mg_dl: 1.0 };
  const levels = [{ value_mcg_ml: 14.3, collection_time: "", time_since_last_dose_hours: 10 }];
  const r = runExistingRegimenPipeline({ patient: pt, regimen, levels }) as unknown as CalculateResponse;
  assert.ok(r.pk_parameters);
  const rec = r.frequency_options!.find((o) => o.is_recommended)!;
  const { summary, note } = buildClinicalNote({ regimen, response: r, activeOption: rec, activeIsCurrent: false, singleDoseStatus: "given", levels });
  assert.deepEqual(summary!.given.figures, { auc24: r.auc24, peak: r.peak, trough: r.trough });
  assert.deepEqual(summary!.proposed!.figures, { auc24: rec.auc24, peak: rec.peak, trough: rec.trough });
  assert.ok(note.includes(`AUC24 ${r.auc24} mg·h/L; peak ${r.peak} mg/L; trough ${r.trough} mg/L`));
  assert.ok(note.includes(`${rec.dose_mg} mg every ${rec.interval_hours} h`));
  assert.ok(note.includes(`Dosing history entered: 2,000 mg loading dose at 0 h → 750 mg at 12 h.`));
  assert.ok(note.includes("One measured level:"), "one entered level carries the caution");
  const engineLines = rec.clinical_note!.split("\n").filter((l) => !/^(AUC24:|Recommendation:|Vancomycin)/.test(l));
  for (const l of engineLines) assert.ok(note.includes(l), `engine line kept: ${l.slice(0, 40)}`);
});
