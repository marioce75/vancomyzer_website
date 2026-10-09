import assert from 'node:assert/strict';
import { test } from 'node:test';
import messages from './messages.json';
const rows = Object.entries(messages);
function pt(prefix: string) {
  const row = rows.find(([key]) => key.startsWith(prefix));
  assert.ok(row, prefix);
  return row[1]['pt-BR'];
}
test('Portuguese critical copy preserves withholding, central intervals and model limitations', () => {
  assert.match(pt('This is decision-support output only. Holding maintenance dosing'), /Suspender a administração/);
  assert.match(pt('(assuming MIC = 1 mg/L) follows'), /não recomenda mais a monitorização baseada apenas/);
  assert.match(pt('(assuming MIC = 1 mg/L) follows'), /recomenda a dosagem orientada pela AUC/);
  assert.match(pt('The shaded area on the concentration'), /90% centrais/);
  assert.match(pt('The shaded area on the concentration'), /confiabilidade da faixa em pacientes ainda não foi estabelecida/);
  assert.match(pt('Levels drawn during infusion'), /nova coleta/);
  assert.match(pt('Empiric loading-dose note, when shown'), /limite máximo/);
  assert.match(pt('The calculator always receives two levels'), /apenas no vale/);
  assert.match(pt('The Vancomyzer BAA template'), /contact@dosys\.health/);
});
