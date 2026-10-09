import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { translate } from './catalog';
import { translateGeneratedText } from './generatedText';
test('observed calculator prose translates preserving numbers', () => {
  const samples = ['Infuse over 125 minutes.', 'Cockcroft-Gault, adjusted body weight 70 kg', '90% population range (model-based; not yet validated)', '90% credible band (model-based; not yet validated)', 'Actual history — dose 4:', 'modeled peak 33.1 / trough 16.8 mg/L; AUC over that interval 279 mg·h/L (not a daily AUC); 67% of steady state (t½ 30.3 h). These history values describe the entered dosing history. The AUC₂₄/peak/trough above describe the selected regimen at steady state.'];
  for (const source of samples) for (const lang of ['es', 'fr', 'pt-BR'] as const) {
    const result = translateGeneratedText(source, lang);
    assert.notEqual(result, source);
    assert.deepEqual(result.match(/\d+(?:\.\d+)?/g), source.match(/\d+(?:\.\d+)?/g));
    for (const fragment of ['modeled peak', 'AUC over that interval', 'of steady state', 'These history values']) assert.ok(!result.includes(fragment), result);
  }
});
test('clinical review-status builder prose has reviewed translations', () => {
  const source = readFileSync(new URL('../lib/pk/response/buildReviewStatus.ts', import.meta.url), 'utf8');
  const prose = Array.from(source.matchAll(/"([^"\n]+)"/g)).map(m => m[1]).filter(s => s.includes(' '));
  assert.ok(prose.length >= 20);
  for (const s of prose) for (const lang of ['es', 'fr', 'pt-BR'] as const) assert.notEqual(translate(s, lang), s, s);
});
