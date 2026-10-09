import test from "node:test";
import assert from "node:assert/strict";
import { computeInitialRegimen } from "../lib/initialRegimen";
import { translate } from "./catalog";
test("current synthetic initial-regimen key inputs translate without numerical changes", () => {
  const result = computeInitialRegimen({age:55, weight_kg:70, serum_creatinine_mg_dl:1, height_cm:170, sex:"male"});
  const inputs = result.calculation_details?.key_inputs ?? [];
  assert.equal(inputs.length, 4);
  for (const source of inputs) for (const locale of ["es", "fr", "pt-BR"] as const) {
    const translated = translate(source, locale);
    assert.notEqual(translated, source, source);
    assert.deepEqual(translated.match(/\d+(?:[.,]\d+)*/g), source.match(/\d+(?:[.,]\d+)*/g));
  }
});

test("invitation display preserves inserted identity text and unknown messages", () => {
  const identity = "synthetic+42@example.invalid";
  const source = `Invited ${identity}. Sign-in link sent to their inbox.`;
  for (const locale of ["es", "fr", "pt-BR"] as const) {
    assert.ok(translate(source, locale).includes(identity));
    assert.notEqual(translate(source, locale), source);
    assert.equal(translate("Unknown private text 42", locale), "Unknown private text 42");
  }
});
