import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { translate } from "./catalog";

const localized = ["es", "fr", "pt-BR"] as const;
const numericTokens = (s: string) => s.match(/\d+(?:[.,]\d+)*/g) ?? [];

test("all chart evidence-strength branches have presentation translations", () => {
  const responseSource = readFileSync(new URL("../lib/pk/response/buildCalculateResponse.ts", import.meta.url), "utf8");
  const block = responseSource.split("evidence_strength:")[1].split("data_quality_summary:")[0];
  const labels = Array.from(block.matchAll(/"([^"]+)"/g)).map(m => m[1]).filter(x => !["high", "moderate"].includes(x));
  assert.equal(labels.length, 5);
  for (const source of labels) {
    assert.equal(translate(source, "en"), source);
    for (const locale of localized) assert.notEqual(translate(source, locale), source, `${locale}: ${source}`);
  }
});

test("blood collection and named concentration section use clinical Portuguese", () => {
  assert.equal(translate("Level drawn", "pt-BR"), "Coleta da amostra");
  for (const source of ["Drug Levels", "Drug levels"]) {
    assert.equal(translate(source, "pt-BR"), "Concentrações de vancomicina");
    assert.equal(translate(source, "es"), "Concentraciones de vancomicina");
  }
  for (const [source, expected] of [["CLINICAL SETTINGS", "CONFIGURAÇÕES CLÍNICAS"], ["FONT SIZE", "TAMANHO DA FONTE"], ["[ RESET TO DEFAULTS ]", "[ RESTAURAR PADRÕES ]"]]) assert.equal(translate(source, "pt-BR"), expected);
  const source = "After loading dose: draw first level 1.5–6h post-infusion end for early Bayesian estimation, or peak + trough near dose 3–4 for highest accuracy. Target AUC₂₄ 400–600 mg·h/L within 48h per ASHP/IDSA 2020.";
  const output = translate(source, "pt-BR");
  assert.match(output, /coletar a primeira amostra/);
  assert.deepEqual(numericTokens(output), numericTokens(source));
  assert.ok(output.includes("mg·h/L"));
});

test("all exposure-caption variants translate without changing any numeric token", () => {
  const captions = [
    "Maintenance after loading dose — 500 mg q8h — steady-state PK",
    "Maintenance after loading dose — 1250.5 mg q12h — steady-state PK",
    "Maintenance after loading dose — steady-state PK",
    "Loading dose — 2000 mg × 1 · first 24 h, not steady state",
    "Current regimen — steady-state projection (actual history: 4 doses given)",
    "Current regimen — steady-state projection (actual history: ? doses given)",
    "Current regimen (as entered) — steady-state exposure",
    "Predicted steady-state exposure",
  ];
  for (const source of captions) {
    assert.equal(translate(source, "en"), source);
    for (const locale of localized) {
      const output = translate(source, locale);
      assert.notEqual(output, source, `${locale}: ${source}`);
      assert.deepEqual(numericTokens(output), numericTokens(source));
    }
  }
  assert.equal(translate("Unregistered clinical statement: 500 mg q8h", "pt-BR"), "Unregistered clinical statement: 500 mg q8h");
});
