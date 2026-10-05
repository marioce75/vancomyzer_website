import assert from "node:assert/strict";
import { test } from "node:test";
import { translateGeneratedText } from "./generatedText";

test("generated clinical prose preserves every numeric token, line and unknown sentence across switches", () => {
  const source = "Current regimen: 1000 mg every 12 h. Initial population estimate: AUC24 472.25 mg·h/L; peak 29.5 mg/L; trough 11.04 mg/L.\nUnknown clinical statement at 8.25 h must remain verbatim.\n  Intended to support review, not replace clinician judgment.  ";
  for (const locale of ["es", "fr", "en", "fr", "en"] as const) {
    const rendered = translateGeneratedText(source, locale);
    assert.deepEqual(rendered.match(/\d+(?:\.\d+)?/g), source.match(/\d+(?:\.\d+)?/g));
    assert.equal(rendered.split("\n").length, 3);
    assert.ok(rendered.includes("Unknown clinical statement at 8.25 h must remain verbatim."));
    assert.ok(rendered.endsWith("  "));
    if (locale === "en") assert.equal(rendered, source);
    else {
      assert.ok(!rendered.includes("Current regimen:"));
      assert.ok(!rendered.includes("Intended to support review"));
      assert.ok(rendered.includes("mg·h/L"));
    }
  }
});

test("unknown generated text and free-text numerical expressions fall back without rewriting", () => {
  for (const source of ["A custom policy 400–600 v1.2\n", "not a registered template", "0.000001", "", " \n  "]) {
    for (const locale of ["en", "es", "fr"] as const) assert.equal(translateGeneratedText(source, locale), source);
  }
});
