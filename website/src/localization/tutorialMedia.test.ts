import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tutorialMedia } from "./tutorialMedia";

// Approved review artifacts: reject superseded narration or slide drafts.
const approved = {
  en: "901d79d28089861be7e96412ac4cdc182e74398c6e4207a697968968690a4005",
  es: "f3f0aaa5539364f3733cf320d356f5d4f26d77e3e72d62f2c544d04b5829a735",
  fr: "d26d0cbd660c0e017fb1dbc9e54cd7f095e6ae59f6cdf4f766c413e23473d63c",
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
