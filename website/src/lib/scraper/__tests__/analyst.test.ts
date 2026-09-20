import { csvRow } from "../csv";
import assert from "node:assert/strict";
import { callAnalyst, parseReport, selectEvidence, buildAnalystPrompt, AnalystError } from "../analystCore";

async function main() {
  assert.equal(csvRow(["a,b", '"quoted"', "=1+1", "line\nbreak"]), '"a,b","""quoted""","\'=1+1","line\nbreak"');
  const evidence = [{ source: "pubmed", title: "Synthetic research fixture", url: "https://pubmed.ncbi.nlm.nih.gov/123/", body_text: "Test only", published_at: "2025", scraped_at: "2026-09-19", upvote_count: 0 }];
  const valid = { executive_brief: "Limited evidence; no market size inference.", market_opportunities: [], competitive_gaps: [], innovation_ideas: [], strategic_recommendations: [{ recommendation: "Review the evidence", rationale: "Requires assessment", priority: 1, timeline: "Next review", source_urls: [evidence[0].url] }], risk_signals: [] };
  assert.equal(selectEvidence(evidence).length, 1, "zero-upvote research retained");
  assert.equal(selectEvidence([...evidence, ...evidence]).length, 1, "URL duplicates removed");
  const regions = ["Africa", "Asia", "Europe", "Latin America"];
  const regional = regions.flatMap(region => Array.from({ length: 20 }, (_, i) => ({ ...evidence[0], source: "europepmc", source_identifier: region, url: `https://example.org/${region}/${i}` })));
  const selected = selectEvidence(regional);
  for (const region of regions) assert.equal(selected.filter(p => p.source_identifier === region).length, 5);
  const prompt = buildAnalystPrompt(evidence, { status: "partial" });
  assert.ok(prompt.user.includes(evidence[0].url));
  assert.ok(prompt.system.includes("untrusted data"));
  assert.ok(!prompt.system.includes("$25-50M"));
  assert.deepEqual(parseReport(JSON.stringify(valid), evidence), valid);
  assert.deepEqual(parseReport('```json\n'+JSON.stringify(valid)+'\n```', evidence), valid);
  const equivalent = { ...valid, strategic_recommendations: [{ ...valid.strategic_recommendations[0], source_urls: [evidence[0].url.replace(/\/$/, "") + "#abstract"] }] };
  assert.deepEqual(parseReport(JSON.stringify(equivalent), evidence), valid);
  assert.throws(() => parseReport("not JSON", evidence), /invalid JSON/);
  assert.throws(() => parseReport('{}', evidence), /report format/);
  assert.throws(() => parseReport(JSON.stringify({ ...valid, strategic_recommendations: [{ ...valid.strategic_recommendations[0], source_urls: ["https://invented.invalid/"] }] }), evidence), /outside the collected evidence/);
  await assert.rejects(callAnalyst("", "", { apiKey: "" }), (e: AnalystError) => e.code === "not_configured");
  for (const status of [400,401,403,404,429,500]) {
    await assert.rejects(callAnalyst("", "", { apiKey: "fake", fetcher: async () => new Response("secret upstream body", { status }) }), (e: AnalystError) => e.code === `provider_${status}` && !e.message.includes("secret"));
  }
  await assert.rejects(callAnalyst("", "", { apiKey: "fake", fetcher: async () => { throw new Error("timeout"); } }), /could not be reached/);
  await assert.rejects(callAnalyst("", "", { apiKey: "fake", fetcher: async () => Response.json({ stop_reason: "max_tokens", content: [] }) }), /length limit/);
  await assert.rejects(callAnalyst("", "", { apiKey: "fake", fetcher: async () => Response.json({ content: [] }) }), /no report/);
  const output = await callAnalyst("s", "u", { apiKey: "fake", fetcher: async (_url, init) => {
    assert.equal(JSON.parse(String(init?.body)).model, "claude-sonnet-4-6");
    assert.ok(init?.signal); return Response.json({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "ignored" }, { type: "text", text: JSON.stringify(valid) }] });
  } });
  assert.deepEqual(parseReport(output, evidence), valid);
  console.log("AI analyst: evidence selection, citations, schema, model, credentials, provider errors, timeout, empty and truncated response checks passed.");
}
void main();
