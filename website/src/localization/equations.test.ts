import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { translateEquationAnnotations } from './equationAnnotations';
import { COLIN_2019 } from '../lib/pk/modelRegistry';

test('equation annotations preserve numerical tokens, symbols and unannotated formula lines', () => {
  const source = readFileSync(new URL('../app/(site)/transparent-dosing/equations/page.tsx', import.meta.url), 'utf8');
  const sf = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const examples: string[] = [...Object.values(COLIN_2019.equations)];
  function visit(node: ts.Node) {
    if (ts.isNoSubstitutionTemplateLiteral(node)) examples.push(node.text);
    ts.forEachChild(node, visit);
  }
  visit(sf);
  for (const example of examples) {
    assert.equal(translateEquationAnnotations(example, 'en'), example);
    for (const locale of ['es', 'fr'] as const) {
      const rendered = translateEquationAnnotations(example, locale);
      assert.deepEqual(rendered.match(/\d+(?:\.\d+)?/g), example.match(/\d+(?:\.\d+)?/g));
      for (const line of example.split('\n').filter(line => /^[\sαβA-Z_0-9(t)]*\s*=/.test(line) && !/[a-z]{3}/.test(line))) {
        assert.ok(rendered.includes(line), `Formula changed: ${line}`);
      }
    }
  }
  assert.ok(translateEquationAnnotations('During infusion (0 ≤ t ≤ T_inf):', 'fr').includes('Pendant la perfusion'));
  assert.equal(translateEquationAnnotations('C(t) = R0 × [ A/α × (1 − e^(−α·t))', 'es'), 'C(t) = R0 × [ A/α × (1 − e^(−α·t))');
});
