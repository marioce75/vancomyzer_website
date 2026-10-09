import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tutorialMedia, tutorialDuration } from "./tutorialMedia";

// Approved review artifacts: reject superseded narration or slide drafts.
const approved = {
  en: "901d79d28089861be7e96412ac4cdc182e74398c6e4207a697968968690a4005",
  es: "f3f0aaa5539364f3733cf320d356f5d4f26d77e3e72d62f2c544d04b5829a735",
  fr: "3abf71a0c49fe756b31259106d5c5042323253697cc80dd89a92f3c4e37e4f6b",
};

test("every locale serves the exact approved tutorial and its own captions", () => {
  for (const locale of ["en", "es", "fr"] as const) {
    const media = tutorialMedia[locale];
    assert.ok(media);
    assert.equal(media.locale, locale);
    const bytes = readFileSync(join(process.cwd(), "public", media.src));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), approved[locale]);
    assert.ok(existsSync(join(process.cwd(), "public", media.poster)));
    if (locale !== "en") {
      assert.ok(media.captions);
      assert.equal(media.captions.language, locale === "es" ? "es-ES" : "fr-FR");
      const captions = readFileSync(join(process.cwd(), "public", media.captions.src), "utf8");
      assert.ok(captions.startsWith("WEBVTT"));
      assert.ok(captions.includes(locale === "es" ? "validación independiente" : "validation indépendante"));
    }
  }
});

test("tutorial links use the selected recording duration", () => {
  assert.equal(tutorialDuration(tutorialMedia.en!), "2:55");
  assert.equal(tutorialDuration(tutorialMedia.es!), "3:29");
  assert.equal(tutorialDuration(tutorialMedia.fr!), "3:37");
});

test("Portuguese never aliases English audio as Portuguese", () => {
  const media = tutorialMedia["pt-BR"]!;
  assert.ok(media);
  assert.equal(media.locale, "pt-BR");
  assert.notEqual(media.src, tutorialMedia.en!.src);
  assert.equal(media.captions?.language, "pt-BR");
  assert.equal(tutorialDuration(media), "3:29");
  assert.ok(existsSync(join(process.cwd(), "public", media.poster)));
  assert.equal(createHash("sha256").update(readFileSync(join(process.cwd(), "public", media.src))).digest("hex"), "53a6fde207b0ee6d905ee7765ffec456df6fda2b70a96733947ba7cd8f5ed4f7");
  const captions = readFileSync(join(process.cwd(), "public", media.captions!.src), "utf8");
  assert.ok(captions.startsWith("WEBVTT"));
  assert.ok(captions.replace(/\s+/g, " ").includes("validação independente em pacientes"));
  assert.ok(captions.includes("um decimal ou um inteiro"));
});
