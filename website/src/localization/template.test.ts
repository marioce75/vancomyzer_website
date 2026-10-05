import assert from 'node:assert/strict';
import test from 'node:test';
import templates from './templates.json';
import { translate } from './catalog';

test('numeric templates preserve every captured byte and numeric token across switches', () => {
  for (const [source, translations] of Object.entries(templates as Record<string, { es: string; fr: string }>)) {
    const names = source.match(/\{n\d+\}/g) ?? [];
    assert.equal(new Set(names).size, names.length, `Duplicate placeholder: ${source}`);
    const sample = (value: string) => value.replace(/\{n(\d+)\}/g, (_, n) => `${n}234.056`);
    for (const locale of ['es', 'fr'] as const) {
      assert.deepEqual(translations[locale].match(/\{n\d+\}/g), names, source);
      assert.equal(translate(sample(source), locale), sample(translations[locale]), source);
      assert.deepEqual(sample(translations[locale]).match(/\d+(?:[.,]\d+)*/g), sample(source).match(/\d+(?:[.,]\d+)*/g), source);
    }
    assert.equal(translate(sample(source), 'en'), sample(source));
    assert.equal(translate(`UNRECOGNIZED ${sample(source)}`, 'fr'), `UNRECOGNIZED ${sample(source)}`);
  }
});
