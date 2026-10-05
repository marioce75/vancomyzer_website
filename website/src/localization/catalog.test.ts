import assert from 'node:assert/strict';
import { test } from 'node:test';
import messages from './messages.json';
import { locales, parseLocale, translate, translateMetadataText } from './catalog';

test('locale input is restricted to the supported languages', () => {
  for (const value of [undefined, null, '', 'de', 'ES', '<script>', {}, 42]) assert.equal(parseLocale(value), 'en');
  for (const locale of locales) assert.equal(parseLocale(locale), locale);
});
test('each catalog entry has nonempty Spanish and French, preserving numerical tokens', () => {
  for (const [source, pair] of Object.entries(messages)) {
    assert.deepEqual(Object.keys(pair).sort(), ['es','fr']);
    for (const locale of ['es','fr'] as const) {
      assert.ok(pair[locale].trim(), `${source}: ${locale}`);
      assert.deepEqual(pair[locale].match(/\d+(?:\.\d+)?/g), source.match(/\d+(?:\.\d+)?/g), `${source}: ${locale} numbers`);
    }
  }
});
test('English and uncatalogued text are preserved exactly; switching is reversible', () => {
  for (const source of Object.keys(messages)) {
    assert.equal(translate(source,'en'),source);
    for (const locale of ['es','fr','en','fr','es','en'] as const) {
      const expected=locale==='en'?source:(messages as Record<string,{es:string;fr:string}>)[source][locale];
      assert.equal(translate(source,locale),expected);
    }
  }
  for (const source of ['123.45 mg/L', 'fictional-test-patient', '  preserve spacing  ', '0', 'NaN']) {
    for (const locale of locales) assert.equal(translate(source,locale),source);
  }
});

test('compound metadata titles translate as whole catalog entries and reverse to English', () => {
  for (const [source, pair] of Object.entries(messages).filter(([key]) => key.includes(" | "))) {
    assert.equal(translateMetadataText(source, "es"), pair.es);
    assert.equal(translateMetadataText(pair.es, "fr"), pair.fr);
    assert.equal(translateMetadataText(pair.fr, "en"), source);
  }
});
