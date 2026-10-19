const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { renderState, messages, root } = require('./security-copy-fixture.cjs');
const disclosure = 'This page does not provide a SOC 2 report. Contact us with questions about security and compliance documentation.';
const subtitle = 'Security policy library and compliance controls.';

for (const locale of ['en', 'es', 'fr', 'pt-BR']) {
  test(`Hospital security information discloses report unavailability in ${locale}`, () => {
    const { html, redirects } = renderState({ locale });
    assert.ok(html.includes(locale === 'en' ? disclosure : messages[disclosure][locale]));
    assert.ok(html.includes(locale === 'en' ? 'Not available for download' : messages['Not available for download'][locale]));
    assert.doesNotMatch(html, /Q4|Type I|Tipo I|type I|tipo I|in progress|en curso|en cours|em curso/);
    assert.deepEqual(redirects, []);
  });
  test(`Admin subtitle makes no audit-status claim in ${locale}`, () => {
    const { html } = renderState({ locale, admin: true });
    assert.ok(html.includes(locale === 'en' ? subtitle : messages[subtitle][locale]));
    assert.doesNotMatch(html, /SOC 2|Q4/);
  });
}

test('anonymous and non-Hospital sessions cannot render the restricted content', () => {
  for (const state of [{ user: null, status: 'unauthenticated' }, { tier: 'free' }, { tier: 'pro' }, { tier: undefined }, { user: null, tier: 'hospital' }]) {
    const result = renderState(state);
    assert.equal(result.html, '');
    assert.deepEqual(result.redirects, ['/pricing']);
  }
});
test('loading auth or session never leaks restricted content or redirects early', () => {
  for (const state of [{ status: 'loading' }, { authLoading: true }]) {
    const result = renderState(state);
    assert.match(result.html, /Loading/);
    assert.doesNotMatch(result.html, /SOC 2|Information Security Policy/);
    assert.deepEqual(result.redirects, []);
  }
});
test('active catalog and metadata cannot reintroduce unsubstantiated audit status', () => {
  const catalog = JSON.stringify(messages);
  assert.doesNotMatch(catalog, /SOC 2 Type I audit is in progress|SOC 2 Type I in progress|Q4 2026|SOC 2 Type I Target|SOC 2 compliance documentation for Hospital/);
  const metadata = fs.readFileSync(path.join(root, 'src/app/(site)/compliance/layout.tsx'), 'utf8');
  assert.match(metadata, /Security and compliance information for Vancomyzer\./);
  for (const locale of ['es', 'fr', 'pt-BR']) assert.ok(messages['Security and compliance information for Vancomyzer.'][locale]);
  assert.doesNotMatch(metadata, /SOC 2/);
});
