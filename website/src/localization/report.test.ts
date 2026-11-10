import assert from "node:assert/strict";
import { test } from "node:test";
import { generateReportHTML, type ReportData } from "../lib/generateReport";
import { localizeReportMarkup } from "./reportMarkup";
import { runExistingRegimenPipeline } from "../lib/pk/runExistingRegimenPipeline";
import { translateGeneratedText } from "./generatedText";
import type { CalculateResponse } from "../types/calculator";
import { buildReportData } from "../components/calculator/exportReport";
import { translate } from "./catalog";

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
test("selected-regimen reports translate real generated prose without changing values", () => {
  const result = runExistingRegimenPipeline({
    patient: { age: 55, weight_kg: 70, serum_creatinine_mg_dl: 1 },
    regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 100 / 60, doses_given: 5, steady_state_confirmed: false },
    levels: [
      { value_mcg_ml: 20, time_since_last_dose_hours: 3, collection_time: "2026-10-11T11:00:00Z" },
      { value_mcg_ml: 10, time_since_last_dose_hours: 11, collection_time: "2026-10-11T19:00:00Z" },
    ],
  });
  assert.ok(!("error_type" in result));
  const option = (result as unknown as CalculateResponse).frequency_options?.find(candidate => candidate.is_recommended);
  assert.ok(option);
  for (const source of [option.interpretation_summary, option.clinical_note]) {
    assert.ok(source);
    for (const locale of ["es", "fr", "pt-BR"] as const) {
      const output = translateGeneratedText(source, locale);
      assert.doesNotMatch(output, /Recommended adjustment|Selected regimen steady-state projection|every \d|infused over|dose increase from/);
      assert.deepEqual(output.match(/\d+(?:\.\d+)?/g), source.match(/\d+(?:\.\d+)?/g));
    }
  }
});
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

test('current-regimen report uses the exact localized heading', () => {
  for (const locale of ['es', 'fr', 'pt-BR'] as const) {
    const html = generateReportHTML({ ...fixture, regimen_is_current: true }, "free", locale);
    assert.doesNotMatch(html, /Current regimen \(as entered\)/);
    const expected = { es: 'Pauta actual (tal como se introdujo)', fr: 'Schéma actuel (tel que saisi)', 'pt-BR': 'Esquema atual (conforme inserido)' }[locale];
    assert.ok(html.includes(expected));
    assert.match(html, /1000 mg every 12 h|1000 mg cada 12 h|1000 mg toutes les 12 h|1000 mg a cada 12 h/);
  }
});

test('no-level pulse reports translate explanatory prose while preserving every value', () => {
  const patient = { age: 120, weight_kg: 30, height_cm: 140, serum_creatinine_mg_dl: 5 };
  const result = runExistingRegimenPipeline({ patient,
    regimen: { dose_mg: 250, interval_hours: 12, infusion_duration_hours: 1, doses_given: 1 }, levels: [] });
  assert.ok(!('error_type' in result));
  const r = result as unknown as CalculateResponse;
  const data: ReportData = { ...patient, mode: 'existing_regimen', recommended_dose: '250',
    recommended_interval_hours: 12, regimen_is_current: true,
    auc24: r.auc24, peak: r.peak, trough: r.trough,
    pk_parameters: r.pk_parameters, interpretation_summary: r.interpretation_summary,
    assumptions: r.assumptions, limitations: r.limitations,
    clinical_note: r.documentation_preview?.clinical_note,
    recommendation_blocked: r.adjustment_dosing_blocked?.safety_message };
  const en = generateReportHTML(data);
  for (const locale of ['es', 'fr', 'pt-BR'] as const) {
    const html = generateReportHTML(data, 'free', locale);
    assert.doesNotMatch(html, /Patient characteristics only|No posterior update|No measured levels were available|Loading dose simulation|is the area under|Posterior fit quality was|uncertainty remains population-based|not_applicable|population_only/);
    assert.deepEqual(html.match(/\d+(?:\.\d+)?/g), en.match(/\d+(?:\.\d+)?/g));
    assert.match(html, /class="report-closing">\s*<div class="disclaimer">[\s\S]*class="footer">/);
    assert.match(html, /\.report-closing \{ break-inside: avoid; \}/);
  }
});

// Third review: the regimen box and the exposure heading said "not yet given"
// for a proposal that is the regimen entered, continued. The translated
// headings must make the same distinction as the English ones, in every view.
test('translated headings say continue for an unchanged regimen, not yet given for a changed or alternative one, and neither under a hold', () => {
  const patient = { age: 55, weight_kg: 75, height_cm: 175, sex: 'male', serum_creatinine_mg_dl: 1.0 };
  const level = (value: number, hours: number) => ({ value_mcg_ml: value, time_since_last_dose_hours: hours, collection_time: '2026-09-16T11:00:00Z' });
  const steady = (infusionHours: number) => ({ dose_mg: 1000, interval_hours: 12, infusion_duration_hours: infusionHours, doses_given: 6, steady_state_confirmed: true, target_auc24: 450 });
  const build = (regimen: ReturnType<typeof steady>, levels: ReturnType<typeof level>[], pick: (r: CalculateResponse) => CalculateResponse['frequency_options'] extends (infer O)[] | undefined ? O | null : never) => {
    const result = runExistingRegimenPipeline({ patient, regimen, levels });
    assert.ok(!('error_type' in result));
    const response = result as unknown as CalculateResponse;
    const activeOption = pick(response);
    return buildReportData({
      patient, regimen, response, activeOption, activeIsCurrent: activeOption === null, singleDoseStatus: 'single',
      levels: levels.map((l) => ({ value_mcg_ml: l.value_mcg_ml, time_since_last_dose_hours: l.time_since_last_dose_hours })),
    });
  };
  const recommended = (r: CalculateResponse) => r.frequency_options?.find((o) => o.is_recommended) ?? null;
  const alternative = (r: CalculateResponse) => r.frequency_options?.find((o) => !o.is_recommended) ?? null;
  const unchanged = build(steady(100 / 60), [level(13, 11)], recommended);
  const changed = build(steady(1), [level(9, 11)], recommended);
  const other = build(steady(1), [level(9, 11)], alternative);
  const hold = build(steady(1), [level(28, 3), level(12.9, 3)], () => null);
  assert.equal(unchanged.exposure_summary?.proposed?.change, 'none');
  assert.equal(changed.exposure_summary?.proposed?.change, 'dose_or_interval');
  assert.equal(other.exposure_summary?.proposed?.origin, 'selected');
  assert.ok(hold.review_hold);

  const words = {
    es: {
      continueBox: 'Pauta propuesta (continuar tal como se introdujo)',
      continueExposure: 'Exposición proyectada en estado estacionario si la pauta continúa tal como se introdujo',
      continueInfusion: 'Perfundir durante 100 minutos (tal como se introdujo)',
      notYetBox: 'Pauta propuesta (aún no administrada)',
      notYetExposure: 'Exposición proyectada en estado estacionario de la pauta propuesta (aún no administrada)',
      current: 'Pauta actual (tal como se introdujo)',
      notYet: /aún no administrad[oa]/i,
      continued: /continuar tal como se introdujo|continúa tal como se introdujo/i,
    },
    fr: {
      continueBox: 'Schéma proposé (poursuivre tel que saisi)',
      continueExposure: 'Exposition projetée à l’état d’équilibre si le schéma est poursuivi tel que saisi',
      continueInfusion: 'Perfuser sur 100 minutes (tel que saisi)',
      notYetBox: 'Schéma proposé (pas encore administré)',
      notYetExposure: 'Exposition projetée à l’état d’équilibre du schéma proposé (pas encore administré)',
      current: 'Schéma actuel (tel que saisi)',
      notYet: /pas encore administré/i,
      continued: /poursuivre tel que saisi|poursuivi tel que saisi/i,
    },
    'pt-BR': {
      continueBox: 'Esquema proposto (continuar conforme inserido)',
      continueExposure: 'Exposição projetada em estado de equilíbrio se o esquema for mantido conforme inserido',
      continueInfusion: 'Infundir em 100 minutos (conforme inserido)',
      notYetBox: 'Esquema proposto (ainda não administrado)',
      notYetExposure: 'Exposição projetada em estado de equilíbrio do esquema proposto (ainda não administrado)',
      current: 'Esquema atual (conforme inserido)',
      notYet: /ainda não administrad[oa]/i,
      continued: /continuar conforme inserido|mantido conforme inserido/i,
    },
  } as const;
  const english = /not yet given|continued? as entered|\(as entered\)|Proposed (regimen|adjustment|maintenance regimen)|Current regimen/;
  const titles = (html: string) => Array.from(html.matchAll(/<div class="section-title">([^<]*)<\/div>/g), (m) => m[1].replace(/&#39;/g, "'"));
  const rows = (html: string) => Array.from((/<table class="exposure-table">[\s\S]*?<\/table>/.exec(html)?.[0] ?? '').matchAll(/<tr><th>([^<]*)<\/th>/g), (m) => m[1]);
  const body = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '');

  for (const locale of ['es', 'fr', 'pt-BR'] as const) {
    const w = words[locale];
    // Unchanged: every heading and caption says continue; none says not yet given.
    const u = generateReportHTML(unchanged, 'pro', locale);
    assert.ok(titles(u).includes(w.continueBox), `${locale} box: ${titles(u).join(' | ')}`);
    assert.ok(titles(u).includes(w.continueExposure), `${locale} exposure: ${titles(u).join(' | ')}`);
    assert.ok(u.includes(`<div class="dose-detail">${w.continueInfusion}</div>`), `${locale} infusion line`);
    assert.equal(rows(u)[1], w.continueBox, `${locale}: the table row carries the same title as the box`);
    assert.doesNotMatch(body(u), w.notYet, `${locale}: an unchanged regimen is never "not yet given"`);
    // Changed (engine) and alternative (clinician): not yet given, never continue.
    for (const [name, data] of [['changed', changed], ['alternative', other]] as const) {
      const c = generateReportHTML(data, 'pro', locale);
      assert.ok(titles(c).includes(w.notYetBox) && titles(c).includes(w.notYetExposure), `${locale} ${name}: ${titles(c).join(' | ')}`);
      assert.match(rows(c)[1], w.notYet, `${locale} ${name} table row`);
      assert.doesNotMatch(body(c), w.continued, `${locale} ${name}: never continue`);
      assert.doesNotMatch(titles(c).concat(rows(c)).join(' | '), english, `${locale} ${name}: headings are translated`);
      assert.deepEqual(c.match(/\d+(?:\.\d+)?/g), generateReportHTML(data, 'pro', 'en').match(/\d+(?:\.\d+)?/g), `${locale} ${name}: numbers unchanged`);
    }
    // Hold: the history as entered, neither continue nor not yet given.
    const h = generateReportHTML(hold, 'pro', locale);
    assert.ok(titles(h).includes(w.current), `${locale} hold: ${titles(h).join(' | ')}`);
    assert.doesNotMatch(body(h), w.notYet, `${locale} hold`);
    assert.doesNotMatch(body(h), w.continued, `${locale} hold`);
    assert.doesNotMatch(h, /Recommendation withheld/, `${locale} hold: the hold is translated`);
    // No English heading is left, and the numbers are the English report's.
    for (const [name, html, data] of [['unchanged', u, unchanged], ['hold', h, hold]] as const) {
      assert.doesNotMatch(titles(html).concat(rows(html)).join(' | '), english, `${locale} ${name}: headings are translated`);
      assert.deepEqual(html.match(/\d+(?:\.\d+)?/g), generateReportHTML(data, 'pro', 'en').match(/\d+(?:\.\d+)?/g), `${locale} ${name}: numbers unchanged`);
    }
  }
  // Spanish follows the terminology guide ("pauta") in every heading and table row of these reports.
  for (const data of [unchanged, changed, other, hold]) {
    const html = generateReportHTML(data, 'pro', 'es');
    assert.doesNotMatch(titles(html).concat(rows(html)).join(' | '), /r[ée]gimen/i);
  }
  // The graph captions for both kinds of projection are in the catalogue.
  for (const source of [
    'The solid curve is a projection of the regimen as entered, continued unchanged. Measured levels were drawn under the entered history and are plotted on its dotted curve at their own times, not on the projection.',
    'The solid curve is a projection of the regimen as entered, continued unchanged. Measured levels were drawn under the entered history and are not plotted on the projection.',
    'The solid curve is a projection of a regimen not yet given. Measured levels were drawn under the entered history and are plotted on its dotted curve at their own times, not on the projection.',
  ]) {
    for (const locale of ['es', 'fr', 'pt-BR'] as const) {
      const out = translate(source, locale);
      assert.notEqual(out, source, `${locale}: ${source.slice(0, 60)}`);
      assert.equal(words[locale].notYet.test(out), source.includes('not yet given'), `${locale}: "not yet given" only where the source says it`);
    }
  }
});

