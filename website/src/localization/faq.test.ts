import assert from "node:assert/strict";
import { test } from "node:test";
import { FAQ_ITEMS } from "../app/(site)/faq/faqContent";
import { translate } from "./catalog";
import messages from "./messages.json";
test("every FAQ question, prose answer and internal reference has Spanish and French", () => {
  for (const item of FAQ_ITEMS) {
    const sources = [item.question, ...item.answer.filter((block): block is string => typeof block === "string"), ...item.refs.filter(ref => ref.url.startsWith("/")).map(ref => ref.label)];
    for (const source of sources) {
      assert.ok(Object.hasOwn(messages, source), `Missing current FAQ source: ${source}`);
      for (const locale of ["es", "fr"] as const) assert.notEqual(translate(source, locale), source);
    }
  }
});
