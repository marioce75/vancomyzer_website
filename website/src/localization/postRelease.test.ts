/**
 * Translations for the wording added by the post-release fixes (suggested dose
 * not given, no measured level, safety block together with a review hold).
 * Presentation only: every number is carried over unchanged, and no English
 * sentence added by these fixes is left untranslated in es, fr or pt-BR.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { CalculateRequestRegimen, CalculateResponse } from "../types/calculator";
import { runExistingRegimenPipeline } from "../lib/pk/runExistingRegimenPipeline";
import { generateReportHTML } from "../lib/generateReport";
import { buildReportData } from "../components/calculator/exportReport";
import { buildClinicalNote } from "../components/calculator/clinicalNote";
import { requestRegimen } from "../components/calculator/dosingHistory";
import { translate } from "./catalog";
import { translateGeneratedText } from "./generatedText";
import { localizeReportMarkup } from "./reportMarkup";

const LOCALES = ["es", "fr", "pt-BR"] as const;
const std = { age: 55, weight_kg: 75, height_cm: 175, sex: "male", serum_creatinine_mg_dl: 1.0 };
const frail = { age: 80, weight_kg: 60, height_cm: 160, sex: "female", serum_creatinine_mg_dl: 6 };
const preview: CalculateRequestRegimen = { dose_mg: 2000, interval_hours: 12, infusion_duration_hours: 2, doses_given: 1, target_auc24: 450 };
const run = (patient: typeof std, regimen: CalculateRequestRegimen, levels: { value_mcg_ml: number; collection_time: string; time_since_last_dose_hours: number }[]) => {
  const r = runExistingRegimenPipeline({ patient, regimen, levels }) as unknown as CalculateResponse & { field_errors?: unknown };
  assert.ok(r.recommendation_type, `pipeline error: ${JSON.stringify(r.field_errors)}`);
  return r;
};
const numbersIn = (text: string) => text.match(/\d+(?:[.,]\d+)*/g) ?? [];
const text = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

// English added by these fixes; none of it may survive translation.
// ("simulation" alone is also the French word, so only the English phrases are listed.)
const NEW_ENGLISH = /Suggested dose|suggested dose|suggested single dose|not given|No dose has been|suggestion only|No measured level|no measured level|Simulation only|Simulation of a|this is a simulation|suggested-dose simulation|Dose Simulation|not a record|If this dose is given|Projected exposure|Population estimate only|Suggested infusion|Prior-Based|has been recorded/;

test("suggested dose, no level: engine prose, note and PDF are fully translated with the same numbers", () => {
  const response = run(std, requestRegimen(preview, { suggestedDoseNotGiven: true }), []);
  const { note } = buildClinicalNote({ regimen: preview, response, activeOption: null, activeIsCurrent: true, singleDoseStatus: "suggested", levels: [] });
  const data = buildReportData({ patient: std, regimen: preview, levels: [], response, activeOption: null, activeIsCurrent: true, singleDoseStatus: "suggested" });
  const html = generateReportHTML(data, "pro", "en");
  const sources = [note, response.interpretation_summary ?? "", ...(response.assumptions ?? []), ...(response.limitations ?? []), ...(response.calculation_details?.key_inputs ?? [])];
  for (const locale of LOCALES) {
    for (const source of sources) {
      const out = translateGeneratedText(source, locale);
      assert.doesNotMatch(out, NEW_ENGLISH, `${locale}: ${source.slice(0, 60)}`);
      assert.deepEqual(numbersIn(out), numbersIn(source), `${locale}: numbers unchanged`);
    }
    const pdf = text(localizeReportMarkup(html, locale));
    assert.doesNotMatch(pdf, NEW_ENGLISH, locale);
    assert.doesNotMatch(pdf, /Dose already given|Loading dose given|Existing Regimen|Level drawn/, locale);
  }
  // The headings say "not given" in each language, in the catalogue's own terms.
  assert.equal(translate("Suggested loading dose (not given)", "es"), "Dosis de carga sugerida (no administrada)");
  assert.equal(translate("Suggested loading dose (not given)", "fr"), "Dose de charge suggérée (non administrée)");
  assert.equal(translate("Suggested loading dose (not given)", "pt-BR"), "Dose de ataque sugerida (não administrada)");
  assert.match(translate("Suggested dose (not given) vs. proposed regimen", "es"), /pauta propuesta/, "Spanish regimen is 'pauta'");
});

test("recorded dose, no level: the history line and the report subtitle are translated", () => {
  const recorded: CalculateRequestRegimen = { ...preview, steady_state_confirmed: false, loading_dose_mg: 2000, loading_infusion_duration_hours: 2 };
  const response = run(std, requestRegimen(recorded), []);
  const { note } = buildClinicalNote({ regimen: recorded, response, activeOption: null, activeIsCurrent: true, singleDoseStatus: "given", levels: [] });
  const data = buildReportData({ patient: std, regimen: recorded, levels: [], response, activeOption: null, activeIsCurrent: true, singleDoseStatus: "given" });
  const html = generateReportHTML(data, "pro", "en");
  assert.match(note, /No measured level entered\./);
  for (const locale of LOCALES) {
    const out = translateGeneratedText(note, locale);
    assert.doesNotMatch(out, /No measured level|loading dose only|Level drawn/, locale);
    assert.deepEqual(numbersIn(out), numbersIn(note), locale);
    const pdf = text(localizeReportMarkup(html, locale));
    assert.doesNotMatch(pdf, /No measured level|Prior-Based|Existing Regimen/, locale);
    for (const item of [...(response.assumptions ?? []), ...(response.limitations ?? [])]) {
      assert.notEqual(translateGeneratedText(item, locale), item, `${locale}: ${item.slice(0, 60)}`);
    }
  }
});

test("blocked and on review hold: both reasons are translated in the interpretation and the notes", () => {
  const at = (h: number) => `2026-09-16T${String(h).padStart(2, "0")}:00:00Z`;
  const response = run(frail, { dose_mg: 750, interval_hours: 24, infusion_duration_hours: 1, doses_given: 3, steady_state_confirmed: false },
    [{ value_mcg_ml: 30, collection_time: at(20), time_since_last_dose_hours: 20 }, { value_mcg_ml: 20, collection_time: at(20), time_since_last_dose_hours: 20 }]);
  assert.ok(response.adjustment_dosing_blocked && response.review_hold);
  for (const source of [response.interpretation_summary ?? "", response.documentation_preview?.quick_summary ?? "", response.documentation_preview?.clinical_note ?? ""]) {
    assert.ok(source.includes(response.review_hold.message) && source.includes(response.adjustment_dosing_blocked.safety_message));
    for (const locale of LOCALES) {
      const out = translateGeneratedText(source, locale);
      assert.doesNotMatch(out, /Recommendation withheld|Two levels were entered|Pharmacy review required|No suitable regimen|reconciled/, locale);
      assert.deepEqual(numbersIn(out), numbersIn(source), locale);
    }
  }
});

test("on-screen and report strings added by the fixes are in the catalogue for every language", () => {
  for (const source of [
    "Suggested dose only (not given) — no maintenance regimen suggested.",
    "Suggested dose (not given) vs. proposed regimen",
    "Suggested Dose Simulation (Prior-Based, Dose Not Given)",
    "Existing Regimen (Prior-Based, No Measured Level)",
    "Suggested loading dose (not given)",
    "A suggested dose that has not been given, not a regimen. Projected exposure is that dose over its first 24 h if it is given, not steady state.",
    "Suggested infusion over 120 minutes (not given)",
    "Suggested infusion over 90.5 minutes (not given)",
    "Projected exposure of the suggested dose, not given (first 24 h; no automatic recommendation)",
    "Projected exposure of the suggested dose, not given (first 24 h, not steady state)",
    "Suggested dose, not given: 1500 mg.",
    "Suggested single dose 2000 mg (not given)",
    "Vancomycin suggested-dose simulation.",
  ]) {
    for (const locale of LOCALES) {
      const out = translate(source, locale);
      assert.notEqual(out, source, `${locale}: ${source}`);
      assert.deepEqual(numbersIn(out), numbersIn(source), `${locale}: ${source}`);
    }
  }
});
