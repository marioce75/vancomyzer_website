import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "market-intel-test-"));
  process.chdir(dir);
  process.env.MARKET_INTEL_DIR = path.join(dir, "archives");
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.REDDIT_ACCESS_TOKEN;
  const db = await import("../db");
  const { runFullScrape, visibleText } = await import("../engine");
  const originalFetch = global.fetch;
  const visited: string[] = [];
  global.fetch = async (input) => {
    const url = String(input); visited.push(url);
    if (url.includes("esearch")) return Response.json({ esearchresult: { idlist: ["123"] } });
    if (url.includes("esummary")) return Response.json({ result: { "123": { title: "Vancomycin synthetic study", pubdate: "2026 Sep", source: "Test" } } });
    if (url.includes("europepmc")) return Response.json({ resultList: { result: [{ id: "123", pmid: "123", source: "MED", title: "Same article", abstractText: "Same URL must not count twice." }] } });
    if (url.includes("vancocalc")) return new Response("Blocked", { status: 403 });
    return new Response('<html><script>random nonce</script><main>'+"Public vendor source; no customer satisfaction evidence. ".repeat(8)+'</main></html>');
  };
  try {
    const result = await runFullScrape({ analyze: false, quick: true });
    assert.equal(result.status, "partial");
    const posts = db.getAllPosts();
    assert.equal(result.total, posts.length);
    assert.equal(result.newPosts, posts.length);
    assert.equal(posts.filter(p => p.url?.includes("/123/")).length, 1, "cross-source article deduplication");
    assert.ok(!visited.some(url => url.includes("reddit.com")), "no unapproved Reddit calls");
    assert.ok(result.health.some(h => h.state === "blocked"));
    assert.ok(result.health.some(h => h.name === "DosOpt" && h.state === "skipped"));
    assert.equal(db.getLatestRun()?.run_id, result.runId);
    assert.ok(fs.existsSync(path.join(dir, "archives/latest_raw.json")));
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "archives/latest_raw.json"), "utf8")).length, result.total);
    const first = posts[0]; assert.equal(db.insertPost({ ...first, upvote_count: 10 }), false); assert.equal(db.getAllPosts().find(p=>p.id===first.id)?.upvote_count,10);
    db.insertPost({ ...first, post_id: "legacy-duplicate", title: "Newer version" });
    assert.equal(db.getRecentPosts().filter(p => p.url === first.url).length, 1, "rolling summaries deduplicate legacy URLs");
    assert.ok(db.acquireJob("analyst")); assert.equal(db.acquireJob("analyst"),false); db.finishJob("analyst","failed","test"); assert.ok(db.acquireJob("analyst")); db.finishJob("analyst","completed","test");
    const { runAiAnalyst } = await import("../aiAnalyst");
    await assert.rejects(runAiAnalyst(), /not configured/);
    assert.equal(db.getJob("analyst")?.state,"failed");
    assert.equal(db.getLatestAiReport(),undefined,"no empty successful report");
    assert.equal(visibleText('<script>nonce1</script><main>Public content</main>'), visibleText('<script>nonce2</script><main>Public content</main>'));
    const { getFileContents } = await import("../filePersistence");
    assert.equal(getFileContents("../archives-neighbor/secret.json"),null);
    console.log(`Collection/database: actual counts, deduplication, source failures, archives, updates, job locks, error persistence and path containment passed. ${result.total} fixture records.`);
  } finally { global.fetch = originalFetch; }
}
void main();
