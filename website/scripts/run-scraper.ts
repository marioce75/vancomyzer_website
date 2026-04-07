#!/usr/bin/env tsx
/**
 * Standalone scraper runner for GitHub Actions.
 * Imports the scraper engine and runs a full scrape.
 */

async function main() {
  console.log("[SCRAPER] Starting standalone scraper run...");

  // Dynamic import to handle module resolution
  const { runFullScrape } = await import("../src/lib/scraper/engine");
  const result = await runFullScrape();

  console.log(`[SCRAPER] Done: ${result.newPosts} new posts, ${result.duration.toFixed(1)}s`);

  if (result.changes.length > 0) {
    console.log("[SCRAPER] Competitor changes detected:");
    result.changes.forEach(c => console.log(`  - ${c.name}: ${c.url}`));
  }

  // Send digest
  try {
    const { getLatestRun } = await import("../src/lib/scraper/db");
    const { sendWeeklyDigest } = await import("../src/lib/scraper/digest");
    const latestRun = getLatestRun();
    if (latestRun) {
      await sendWeeklyDigest(latestRun);
    }
  } catch (err) {
    console.error("[SCRAPER] Digest error:", err);
  }

  process.exit(0);
}

main().catch(err => {
  console.error("[SCRAPER] Fatal:", err);
  process.exit(1);
});
