import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CASES } from '../lib/validation/registry';
import { COLIN_2019, COLIN_2021_OBESE_EVALUATION } from '../lib/pk/modelRegistry';
import { translate } from './catalog';

test('current literature case explanations and model scope have both translations', () => {
  const prose = CASES.flatMap(c => [c.source.specific_reference,c.what_it_tests,c.notes_for_page,c.patient.notes,c.published.extraction_method,c.published.tolerance_rationale,c.source.verification_note,c.reference_band?.cohort_description,c.reference_band?.our_position,...(c.reference_band?.platforms.map(p=>p.notes) ?? [])]).filter((x): x is string => !!x);
  prose.push(COLIN_2019.structure,COLIN_2019.sourcePopulation,COLIN_2019.vancomyzerScope,COLIN_2019.renalCovariate,...COLIN_2019.omittedCovariates,COLIN_2021_OBESE_EVALUATION.summary);
  for (const source of prose) for (const locale of ['es','fr'] as const) {
    assert.notEqual(translate(source, locale), source, `${locale}: ${source}`);
    assert.deepEqual(translate(source, locale).match(/\d+(?:\.\d+)?/g), source.match(/\d+(?:\.\d+)?/g));
  }
});
