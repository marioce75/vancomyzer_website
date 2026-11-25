import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EmpiricReviewHeading, EmpiricReviewNote } from "./EmpiricReviewNote";
import { buildClinicalNote } from "./clinicalNote";
import { computeInitialRegimen } from "../../lib/initialRegimen";
import { translate, type Locale } from "../../localization/catalog";

const synthetic = { age: 79, weight_kg: 118, height_cm: 160, serum_creatinine_mg_dl: 0.31, sex: "" as const };
const result = computeInitialRegimen(synthetic);

const source = buildClinicalNote({
  response: result,
  regimen: { dose_mg: 0, interval_hours: 0, infusion_duration_hours: 0 },
  activeOption: null, activeIsCurrent: false, singleDoseStatus: "single", levels: [],
}).note;
const headings: Record<Locale, string> = {
  en: "Review required", es: "Se requiere revisión", fr: "Réévaluation nécessaire", "pt-BR": "Revisão necessária",
};
const escape = (text: string) => text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;");

test("rendered review-only heading and full assembled engine Note localize in all four languages", () => {
  assert.equal(result.empiric_dosing_blocked?.review_required, true);
  const sourceLines = source.split("\n");
  assert.equal(sourceLines.length, 5);
  assert.match(sourceLines[1], /combined here\. The creatinine-based/);
  assert.match(sourceLines[3], /selecting a regimen\. Follow/);
  for (const locale of Object.keys(headings) as Locale[]) {
    const heading = renderToStaticMarkup(<EmpiricReviewHeading locale={locale}/>);
    assert.equal(heading, '<h2 id="vz-band-title" class="vz-panel-title m-0">' + headings[locale] + '</h2>');
    const note = renderToStaticMarkup(<EmpiricReviewNote note={source} locale={locale}/>);
    const expected = (locale === "en" ? sourceLines : sourceLines.map(line => translate(line, locale))).map(escape).join("\n");
    assert.equal(note, '<pre class="m-0 whitespace-pre-wrap text-xs">' + expected + '</pre>');
    if (locale !== "en") for (const line of sourceLines) assert.ok(!note.includes(escape(line)), locale + ": " + line);
  }
});
