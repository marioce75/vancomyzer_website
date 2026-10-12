import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tutorialMedia, tutorialDuration } from "./tutorialMedia";
const approved = {"en": "cf1cb9b29780711ae8a4e3ed55768ba745c2abc1a6a070eac0d7c4971cb3317e", "es": "cef5a793bbd4e4c194a449d3db235e1fafcc4ce3bd4dbe6af9faf069e9e2a127", "fr": "8cad7893dd22166d9ffe9dfa2099f9275586716c0da2d87961f4d62b29e0b362", "pt-BR": "3cc2aa5caf07dbd664bdb81b9dc766f4857e34d9a79ee186de96faf3fa174c09"};
const durations = { en: "2:17", es: "2:33", fr: "2:53", "pt-BR": "2:41" };
test("all locales serve exact approved navigation masters and matching captions", () => {
 for (const locale of ["en", "es", "fr", "pt-BR"] as const) {
  const m = tutorialMedia[locale]!;
  assert.equal(m.locale, locale);
  assert.equal(createHash("sha256").update(readFileSync(join(process.cwd(), "public", m.src))).digest("hex"), approved[locale]);
  assert.ok(existsSync(join(process.cwd(), "public", m.poster)));
  assert.equal(m.captions?.language, { en: "en", es: "es-ES", fr: "fr-FR", "pt-BR": "pt-BR" }[locale]);
  assert.equal(tutorialDuration(m), durations[locale]);
  const captions = readFileSync(join(process.cwd(), "public", m.captions!.src), "utf8");
  assert.ok(captions.startsWith("WEBVTT"));
  if(locale === "es") { assert.ok(captions.includes("suspendidas u omitidas")); assert.ok(!captions.includes("suspendidas o omitidas")); }
 }
 assert.equal(new Set(Object.values(tutorialMedia).map(m => m!.src)).size, 4);
});
