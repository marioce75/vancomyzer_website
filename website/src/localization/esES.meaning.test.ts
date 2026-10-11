import assert from 'node:assert/strict';
import { test } from 'node:test';
import { translate } from './catalog';
import { readFileSync } from 'node:fs';
const es = (text: string) => translate(text, 'es');
test('Spanish distinguishes sample collection, perfusion start, and modeled concentrations', () => {
  assert.match(es('Level drawn'), /extracción/i);
  assert.match(es('Last dose administered'), /inicio.*perfusión/i);
  assert.match(es('Time drawn (hours after dose start)'), /inicio.*perfusión.*extracción.*horas/i);
  for (const label of ['Predicted peak (mg/L)', 'Predicted trough (mg/L)']) assert.match(es(label), /estimada.*mg\/L/);
  assert.match(es('Distribution clearance'), /intercompartimental/);
  assert.match(es('Drug handling'), /Farmacocinética/);
});
test('Spanish homepage data-driven lists do not silently fall back to English', () => {
  const page = readFileSync('src/app/(site)/page.tsx', 'utf8');
  const evidence = page.slice(page.indexOf('const EVIDENCE_STATUS'), page.indexOf('const INK'));
  const text = Array.from(evidence.matchAll(/covers: "([^"]+)"/g)).map(match => match[1]);
  const lists = evidence.slice(evidence.indexOf('const AUDIENCE'));
  text.push(...Array.from(lists.matchAll(/"([^"]+)"/g)).map(match => match[1]));
  text.push('Colin 2019 two-compartment model; population equations and references, with the assumptions used to adjust estimates to measured levels');
  for (const source of text) assert.notEqual(es(source), source, source);
  assert.match(es('Nurse practitioners'), /nurse practitioners/);
  assert.match(es('Physician assistants'), /physician assistants/);
});
