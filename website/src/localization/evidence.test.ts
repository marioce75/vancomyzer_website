import assert from "node:assert/strict";
import { test } from "node:test";
import { REVIEW_POINTS, LIMITS, SOURCES, METHOD_PAGES } from "../app/(site)/transparent-dosing/evidenceContent";
import messages from "./messages.json";
test("evidence overview data has translations for current model and software version", () => {
  const sources = [...REVIEW_POINTS.flatMap(item => [item.title,item.body]),...LIMITS,...SOURCES.flatMap(item=>[item.label,item.note]),...METHOD_PAGES.flatMap(item=>[item.title,item.covers,item.status])];
  for (const source of sources) assert.ok(Object.hasOwn(messages,source),`Missing current evidence source: ${source}`);
});
