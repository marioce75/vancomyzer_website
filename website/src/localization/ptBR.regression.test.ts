import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeInitialRegimen } from '../lib/initialRegimen';
import { runExistingRegimenPipeline } from '../lib/pk/runExistingRegimenPipeline';
import { parseClinicalNumber } from '../lib/parseClinicalNumber';
import { locales } from './catalog';
import { translateGeneratedText } from './generatedText';

const patient = { age: 55, weight_kg: 70, serum_creatinine_mg_dl: 1, height_cm: 170, sex: 'male' as const };
const inputs = [
  () => computeInitialRegimen(patient),
  () => runExistingRegimenPipeline({ patient, regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 }, levels: [{ value_mcg_ml: 12, collection_time: '', time_since_last_dose_hours: 3 }] }),
  () => runExistingRegimenPipeline({ patient, regimen: { dose_mg: 1500, interval_hours: 12, infusion_duration_hours: 1.5, doses_given: 5 }, levels: [{ value_mcg_ml: 30, collection_time: '2026-03-15T08:00:00Z', time_since_last_dose_hours: 2 }, { value_mcg_ml: 12, collection_time: '2026-03-15T17:30:00Z', time_since_last_dose_hours: 11.5 }] }),
];
const prose = new Set(['interpretation_summary', 'quick_summary', 'clinical_note', 'safety_message', 'recommended_action', 'data_quality_summary', 'banner_body', 'banner_title']);
test('developer synthetic checks: locale presentation preserves initial, one-level and two-level engine results', () => {
  for (const calculate of inputs) {
    const baseline = calculate();
    assert.ok(!('ok' in baseline) || baseline.ok !== false);
    const before = JSON.stringify(baseline);
    for (const locale of locales) {
      const current = calculate();
      assert.deepEqual(current, baseline);
      const visit = (value: unknown) => {
        if (!value || typeof value !== 'object') return;
        for (const [key, item] of Object.entries(value)) {
          if (typeof item === 'string' && prose.has(key)) {
            const translated = translateGeneratedText(item, locale);
            assert.deepEqual(translated.match(/\d+(?:[.,]\d+)*/g), item.match(/\d+(?:[.,]\d+)*/g), `${locale}: ${key}`);
          } else visit(item);
        }
      }
      visit(current);
      assert.equal(JSON.stringify(current), before);
    }
  }
});
test('approved strict decimal parser rejects ambiguity consistently in every locale', () => {
  for (const locale of locales) {
    for (const [raw, expected] of [['1.2', 1.2], ['1,2', 1.2], ['0,83', .83], ['1,000', null], ['1.000', null], ['1000', 1000], ['1,234.5', null], ['1.234,5', null], ['1 000', null], ['1e3', null], ['75kg', null]] as const) {
      assert.equal(parseClinicalNumber(raw), expected, `${locale}: ${raw}`);
    }
  }
});

test('Portuguese clinical glossary and equation symbols remain explicit', async () => {
  const { translate } = await import('./catalog');
  const { default: messages } = await import('./messages.json');
  assert.equal(translate('Loading dose','pt-BR'),'Dose de ataque');
  assert.equal(translate('90% credible band','pt-BR'),'Faixa de credibilidade de 90%');
  for (const source of Object.keys(messages).filter(k => k.startsWith('CL  =  θCL') || k.startsWith('CL (L/h) = 5.31'))) {
    const rendered = translate(source, 'pt-BR');
    assert.deepEqual(rendered.match(/θCL|F·[a-z-]+|[×÷≈^=]|\d+(?:[.,]\d+)*/g), source.match(/θCL|F·[a-z-]+|[×÷≈^=]|\d+(?:[.,]\d+)*/g));
  }
});

test('Portuguese fills current homepage gaps without changing existing locale fallbacks', async () => {
  const { translate } = await import('./catalog');
  const { default: additional } = await import('./ptBRAdditionalMessages.json');
  for (const [source, target] of Object.entries(additional)) {
    assert.equal(translate(source, 'pt-BR'), target);
    assert.deepEqual(target.match(/\d+(?:[.,]\d+)*/g), source.match(/\d+(?:[.,]\d+)*/g));
  }
});
