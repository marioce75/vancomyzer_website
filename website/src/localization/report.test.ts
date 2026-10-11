import assert from "node:assert/strict";
import { test } from "node:test";
import { generateReportHTML, type ReportData } from "../lib/generateReport";
import { localizeReportMarkup } from "./reportMarkup";

const fixture: ReportData = {
  pharmacist_name: "Peak", institution: "Hospital",
  age: 65, weight_kg: 75.5, serum_creatinine_mg_dl: 1.2,
  mode: "existing_regimen", recommended_dose: "1000", recommended_interval_hours: 12,
  recommended_infusion_duration_hours: 1.75, auc24: 472.25, peak: 29.5, trough: 11.04,
  pk_parameters: { CL: 4.24, V1: 30.2, Q: 6.5, V2: 43.6, used_posterior_refinement: true },
  interpretation_summary: "Current regimen: 1000 mg every 12 h. Unknown <unsafe> & \"quoted\" text stays escaped.",
  assumptions: ["No measured vancomycin levels; no posterior or Bayesian update."],
  clinical_note: "Vancomycin existing regimen evaluation (Posterior-updated estimate).\nAUC24: 472.25 mg·h/L; peak 29.5 mg/L; trough 11.04 mg/L.",
};
test("localized report keeps all numeric tokens, links, CSS, escaping and source data", () => {
  const before = JSON.stringify(fixture);
  const en = generateReportHTML(fixture, "free");
  for (const locale of ["es", "fr", "pt-BR"] as const) {
    const html = generateReportHTML(fixture, "free", locale);
    assert.deepEqual(html.match(/\d+(?:\.\d+)?/g), en.match(/\d+(?:\.\d+)?/g));
    assert.equal(html.match(/<style>[\s\S]*?<\/style>/)?.[0], en.match(/<style>[\s\S]*?<\/style>/)?.[0]);
    assert.deepEqual(html.match(/href="[^"]*"/g), en.match(/href="[^"]*"/g));
    assert.ok(!html.includes("<unsafe>"));
    assert.ok(html.includes("&lt;unsafe&gt;"));
    assert.ok(!html.includes(">Patient Parameters<"));
    assert.ok(html.includes('<span data-localization="preserve">Peak</span>'));
    assert.ok(html.includes('<span data-localization="preserve">Hospital</span>'));
    assert.ok(html.includes(`lang="${locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es-ES" : "fr-FR"}"`));
  }
  assert.equal(JSON.stringify(fixture), before);
  assert.equal(localizeReportMarkup(en, "en"), en);
});
test('Spanish generated warnings retain values, dose history and uncertainty without English fallback', async () => {
  const { translateGeneratedText } = await import('./generatedText');
  const sources = [
    'Actual-history analysis: the level was fitted after exactly 5 doses; exposure of the current regimen is reported as its steady-state projection, with dose-5 peak/trough shown separately.',
    'Actual-history analysis after 5 doses: the measured level was fitted by superposing exactly 5 doses. AUC24/peak/trough for the current regimen are its steady-state projection (comparable with the candidate regimens); the modeled dose-5 peak/trough (26.6 / 9.3 mg/L, AUC over that interval 191 mg·h/L) are reported separately — the model puts the patient at 87% of steady state.',
    'Posterior fit quality was weak (2 levels informed the bounded posterior MAP fit; RMS error 1.6 mg/L; mean absolute error 1.1 mg/L; mean relative error 6%; CL shift 69%; V1 shift 8%.); uncertainty remains high.',
  ];
  for (const source of sources) {
    const output = translateGeneratedText(source, 'es');
    assert.notEqual(output, source);
    assert.doesNotMatch(output, /Actual-history|fitted|uncertainty remains|informed the/);
    assert.deepEqual(output.match(/\d+(?:\.\d+)?/g), source.match(/\d+(?:\.\d+)?/g));
  }
  assert.match(translateGeneratedText(sources[2], 'es'), /incertidumbre sigue siendo alta/);
});
