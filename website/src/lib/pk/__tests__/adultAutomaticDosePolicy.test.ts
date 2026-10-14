import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DoseRecommendationCard from '../../../components/calculator/DoseRecommendationCard';
import RegimenComparisonTable, { RegimenComparisonResult } from '../../../components/calculator/RegimenComparisonTable';
/** Synthetic product-policy regressions; no patient/screenshot inputs. */
import assert from 'node:assert/strict';
import { buildDocumentationPreview } from '../explain/buildDocumentationPreview';
import { buildAdjustmentRecommendation } from '../recommend/buildAdjustmentRecommendation';
import { runExistingRegimenEngine } from '../existing/existingRegimenEngine';
import { runExistingRegimenPipeline } from '../runExistingRegimenPipeline';
import { computeInitialRegimen } from '../../initialRegimen';
import { computeExposure, loadingDoseCurvePoints } from '../steadyStateTwoCompartment';
import { DEFAULT_DOSE_POLICY } from '../dosePolicy';
import { generateReportHTML } from '../../generateReport';
import type { FrequencyOption } from '../../../types/calculator';
import type { ExistingRegimenEngineOutput } from '../types';

const patient = { age: 70, weight_kg: 50, height_cm: 160, sex: 'male' as const, serum_creatinine_mg_dl: 1.5 };
const regimen = { dose_mg: 1000, interval_hours: 24, infusion_duration_hours: 1, doses_given: 1, target_auc24: 450 };
const seed = runExistingRegimenEngine({ patient, regimen, levels: [] });
function output(CL: number, pulse = true): ExistingRegimenEngineOutput {
  return { ...seed, CL, V1: 35, Q: 3, V2: 35, doses_given: pulse ? 1 : 5,
    level_count: pulse ? 0 : 2,
    posterior_fit: { ...seed.posterior_fit, fit_quality: 'good', uncertainty_label: 'low' },
    current_regimen_dose_mg: 250, current_regimen_interval_hours: 24,
    auc24: 250 / CL, peak: 20, trough: 10 };
}
let checked = 0;
for (const CL of [0.1, 0.2, 0.5, 0.93, 1, 2, 4, 8, 15]) {
  for (const pulse of [true, false]) {
    for (const maxSingleDoseMg of [250, 500, 600, 2000]) {
      const r = buildAdjustmentRecommendation(output(CL, pulse), { ...DEFAULT_DOSE_POLICY, maxSingleDoseMg });
      if (r.adjustment_dosing_blocked) {
        assert.equal(r.recommended_interval_hours, 0);
        assert.deepEqual(r.frequency_options, []);
      } else {
        const dose = parseFloat(r.recommended_dose);
        assert.ok(dose >= 500 && dose % 250 === 0 && dose <= maxSingleDoseMg);
        assert.ok(r.predicted_auc24! >= 400 && r.predicted_auc24! <= 600);
        assert.ok(r.predicted_peak! <= 80 && r.predicted_trough! <= 20);
        const exact = computeExposure({ CL, V1: 35, Q: 3, V2: 35, dose_mg: dose, tau: r.recommended_interval_hours, T_inf: r.recommended_infusion_duration_hours! });
        assert.ok(Math.abs(exact.auc24 - r.predicted_auc24!) <= 0.051);
        for (const o of r.frequency_options ?? []) {
          assert.ok(o.dose_mg >= 500 && o.dose_mg % 250 === 0 && o.dose_mg <= maxSingleDoseMg);
          assert.ok(o.auc24 >= 400 && o.auc24 <= 600);
        }
      }
      checked++;
    }
  }
}
const low = buildAdjustmentRecommendation(output(0.5));
assert.equal(low.recommended_dose, '500 mg');
assert.equal(low.recommended_interval_hours, 48, 'recompute supported interval instead of clamping at q24');
assert.equal(low.predicted_auc24, 500);
assert.ok(buildAdjustmentRecommendation(output(0.2)).adjustment_dosing_blocked?.review_required);
const tight = buildAdjustmentRecommendation(output(1), { ...DEFAULT_DOSE_POLICY, maxDailyDoseMg: 100 });
assert.ok(tight.adjustment_dosing_blocked?.review_required);
const sparse = { ...output(0.5, false), level_count: 1 };
assert.ok(buildAdjustmentRecommendation(sparse).adjustment_dosing_blocked, 'sparse same-interval250 must not be clamped or rescued by unrestricted grid');
const increments = buildAdjustmentRecommendation(output(3));
assert.ok(increments.frequency_options?.some((o: FrequencyOption) => o.dose_mg === 750));
assert.ok(increments.frequency_options?.some((o: FrequencyOption) => o.dose_mg === 1250));

const pulse: any = runExistingRegimenPipeline({ patient, regimen, levels: [] });
assert.ok(!pulse.error_type && !pulse.adjustment_dosing_blocked);
assert.ok(parseFloat(pulse.recommended_dose) >= 500);
const expected = loadingDoseCurvePoints(pulse.pk_parameters, 1000, 1, parseFloat(pulse.recommended_dose), pulse.recommended_interval_hours, pulse.recommended_infusion_duration_hours);
assert.equal(pulse.curve_engine_recommended.length, expected.length);
pulse.curve_engine_recommended.forEach((p: any, i: number) => assert.equal(p.concentration, expected[i].concentration));
const history: any = runExistingRegimenPipeline({ patient, regimen: { ...regimen, dose_mg: 250, doses_given: 3, steady_state_confirmed: false }, levels: [{ value_mcg_ml: 8, time_since_last_dose_hours: 20 }] });
assert.ok(!history.error_type, '250mg history and measured levels remain valid');
assert.equal(history.measured_levels[0].concentration, 8);
assert.match(history.interpretation_summary, /Current regimen: 250 mg/);
assert.ok(history.curve.length > 0);
for (const weight_kg of [30, 50, 70, 150, 300]) for (const scr of [0.2, 1, 3, 8]) {
  const r = computeInitialRegimen({ age: 55, weight_kg, height_cm: 170, sex: 'male' as const, serum_creatinine_mg_dl: scr });
  if (!r.empiric_dosing_blocked) { assert.ok(parseFloat(r.recommended_dose) >= 500); assert.ok(r.auc24 >= 400 && r.auc24 <= 600); }
  checked++;
}
const blocked: any = runExistingRegimenPipeline({ patient, regimen, levels: [], policy: { ...DEFAULT_DOSE_POLICY, maxSingleDoseMg: 250 } });
assert.ok(blocked.adjustment_dosing_blocked.review_required);
assert.equal(blocked.curve_engine_recommended, undefined);
assert.deepEqual(blocked.curve, blocked.loading_dose_curve, 'blocked pulse graph must not imply repeated maintenance doses');
assert.ok(blocked.curve.length > 0, 'recorded single-dose exposure remains inspectable');
const afterInfusion = blocked.curve.filter((p: any) => p.time_hours >= regimen.infusion_duration_hours);
assert.ok(afterInfusion.every((p: any, i: number) => i === 0 || p.concentration <= afterInfusion[i - 1].concentration), 'no maintenance-dose peaks after the recorded infusion');
assert.deepEqual(blocked.frequency_options, []);
assert.match(blocked.interpretation_summary, /Recorded single dose: 1000 mg/);
assert.doesNotMatch(blocked.interpretation_summary, /Current regimen:.*every/);
assert.match(pulse.documentation_preview.clinical_note, /no prior maintenance interval is implied/);
assert.doesNotMatch(pulse.documentation_preview.clinical_note, /interval (extension|shortening) from/);
const blockedHistory: any = runExistingRegimenPipeline({ patient, regimen: { ...regimen, dose_mg: 250, doses_given: 3, steady_state_confirmed: false }, levels: [{ value_mcg_ml: 8, time_since_last_dose_hours: 20 }], policy: { ...DEFAULT_DOSE_POLICY, maxSingleDoseMg: 250 } });
assert.ok(blockedHistory.adjustment_dosing_blocked);
assert.deepEqual(blockedHistory.curve, history.curve, 'blocked non-pulse history prediction remains unchanged');
assert.doesNotMatch(blocked.documentation_preview.clinical_note, /Maintenance dosing held|every 0 h/);
const html = generateReportHTML({ age: 70, weight_kg: 50, serum_creatinine_mg_dl: 1.5, mode: 'existing_regimen',
 recommended_dose: blocked.recommended_dose, recommended_interval_hours: 0, auc24: blocked.auc24, peak: blocked.peak, trough: blocked.trough,
 recommendation_blocked: blocked.adjustment_dosing_blocked.safety_message });
assert.match(html, /No automatic maintenance regimen/);
assert.doesNotMatch(html, /mg every 0 h/);
const manual = generateReportHTML({ age: 70, weight_kg: 50, serum_creatinine_mg_dl: 1.5, mode: 'existing_regimen',
 recommended_dose: '250', recommended_interval_hours: 24, auc24: 500, peak: 30, trough: 10, regimen_is_current: true });
assert.match(manual, /Current regimen \(as entered\)/);
assert.match(manual, /250 mg every 24 h/);
console.log(`Adult automatic policy: ${checked} grid/body-size cases plus interval, sparse, rounding, history, curve and export assertions passed.`);

// Render the actual shared desktop/mobile dose card and candidate table.
(globalThis as any).React = React;
const card = renderToStaticMarkup(React.createElement(DoseRecommendationCard, { ...blocked, adjustmentDosingBlocked: blocked.adjustment_dosing_blocked }));
assert.match(card, /Pharmacy review required/);
assert.doesNotMatch(card, /Hold &amp; recheck|every.*0.*h/);
const table = renderToStaticMarkup(React.createElement(RegimenComparisonTable, {
 options: [{ dose_mg: 250, interval_hours: 12, infusion_duration_hours: 1, auc24: 500, peak: 25, trough: 15, is_recommended: true }],
 activeOption: null, onSelect: () => {},
 current: { dose_mg: 250, interval_hours: 24, auc24: 500, peak: 25, trough: 15, label: 'current' },
}));
assert.doesNotMatch(table, /250 mg q12h/);
assert.match(table, /250 mg q24h/);
const noInitial = computeInitialRegimen({ ...patient, age: 35, weight_kg: 300, serum_creatinine_mg_dl: 0.1 });
assert.ok(noInitial.empiric_dosing_blocked?.review_required);
assert.doesNotMatch(noInitial.documentation_preview.clinical_note, /pulse dose|severe renal|hold/i);
const initialHtml = generateReportHTML({ ...patient, mode: 'initial_regimen', ...noInitial, recommendation_blocked: noInitial.empiric_dosing_blocked!.safety_message });
assert.match(initialHtml, /Not available/);
assert.doesNotMatch(initialHtml, /mg every 0 h/);
console.log('Shared UI card/table and high-clearance initial review/export assertions passed.');

const weakPulse: any = { ...seed, doses_given: 1, level_count: 1, auc24: 700, peak: 50, current_regimen_interval_hours: 12, posterior_fit: { ...seed.posterior_fit, fit_quality: 'weak', uncertainty_label: 'high' } };
const weakPulseNote = buildDocumentationPreview({ engineOutput: weakPulse, recommendation: { ...buildAdjustmentRecommendation(seed), recommended_interval_hours: 24 } });
assert.doesNotMatch(weakPulseNote.clinical_note, /interval extension|interval shortening|same-interval dose reduction/);

// Exercise the workspace's rendering boundary, not only the inner table.
const historyProps = {
  options: [{ dose_mg: 750, interval_hours: 24, infusion_duration_hours: 1.25, auc24: 500, peak: 25, trough: 15, is_recommended: true }],
  activeOption: null, onSelect: () => {}, onApply: () => {},
  current: { dose_mg: 250, interval_hours: 24, auc24: 500, peak: 25, trough: 15, label: 'current' },
};
const renderBoundary = (result: any, current: any = historyProps.current) => renderToStaticMarkup(
  React.createElement(RegimenComparisonResult, { ...historyProps, activeOption: historyProps.options[0], current, result }));
const reviewMarkup = renderBoundary(blockedHistory);
assert.match(reviewMarkup, /250 mg q24h/);
assert.match(reviewMarkup, /No candidate regimens/);
assert.doesNotMatch(reviewMarkup, /750 mg|Recommended|Use as draft/);
const pulseMarkup = renderBoundary(blocked, { ...historyProps.current, single_dose: true, label: 'loading dose' });
assert.match(pulseMarkup, /250 mg × 1/);
assert.match(pulseMarkup, /First 24 h/);
assert.doesNotMatch(pulseMarkup, /750 mg|Use as draft/);
for (const refused of [
  { adjustment_dosing_blocked: { ...blockedHistory.adjustment_dosing_blocked, review_required: false } },
  { empiric_dosing_blocked: { review_required: true } },
]) {
  const markup = renderBoundary(refused);
  assert.match(markup, /No candidate regimens/);
  assert.doesNotMatch(markup, /role="radio"|250 mg|750 mg|Use as draft/);
}
assert.match(renderBoundary(blockedHistory, null), /No candidate regimens/);
const normalMarkup = renderBoundary({});
assert.match(normalMarkup, /250 mg q24h/);
assert.match(normalMarkup, /750 mg q24h/);
console.log('Workspace comparison boundary: review/history/pulse/refusal/normal cases passed.');

// A rejected 250 mg recommendation must not discard other eligible alternatives.
const mixedOptions = [250, 500, 750, 1250].map(dose_mg => ({
  ...historyProps.options[0], dose_mg, is_recommended: dose_mg === 750,
}));
const mixedMarkup = renderToStaticMarkup(React.createElement(RegimenComparisonResult, {
  ...historyProps, options: mixedOptions, result: {},
}));
assert.match(mixedMarkup, /500 mg q24h/);
assert.match(mixedMarkup, /750 mg q24h/);
assert.match(mixedMarkup, /1250 mg q24h/);
assert.equal((mixedMarkup.match(/>250 mg q24h</g) ?? []).length, 1, '250 mg appears only as entered history');
assert.equal((mixedMarkup.match(/role="radio"/g) ?? []).length, 4, 'one historical row and three allowed recommendations');
assert.ok(pulse.frequency_options?.some((o: FrequencyOption) => o.dose_mg === 500));
assert.ok(pulse.frequency_options?.some((o: FrequencyOption) => o.dose_mg === 750));
assert.ok(pulse.frequency_options?.some((o: FrequencyOption) => o.dose_mg === 1250));
assert.ok(pulse.frequency_options?.every((o: FrequencyOption) => o.dose_mg !== 250));
for (const option of pulse.frequency_options ?? []) {
  if (![500, 750, 1250].includes(option.dose_mg)) continue;
  assert.ok(option.curve?.length, 'eligible alternative retains its own graph');
  const html = generateReportHTML({ ...patient, mode: 'existing_regimen',
    recommended_dose: String(option.dose_mg), recommended_interval_hours: option.interval_hours,
    recommended_infusion_duration_hours: option.infusion_duration_hours,
    auc24: option.auc24, peak: option.peak, trough: option.trough,
    frequency_options: pulse.frequency_options,
  });
  assert.ok(html.includes(`${option.dose_mg} mg every ${option.interval_hours} h`));
  assert.doesNotMatch(html, />250 mg</);
}
console.log('Mixed 250/500/750/1250 alternatives: allowed rows, API pipeline, graphs and reports passed.');
