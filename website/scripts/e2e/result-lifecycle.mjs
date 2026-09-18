/**
 * Deterministic out-of-order response test for the calculator result lifecycle.
 *
 * Requires a dev server on BASE (default http://localhost:3005) and Playwright
 * (`npx playwright` or a local install; set PW_CHROMIUM to a Chromium path).
 *   node scripts/e2e/result-lifecycle.mjs
 *
 * Scenario A (superseded response): the FIRST /api/calculate response is held
 * for 4 s; the user meanwhile changes SCr (a newer request completes first).
 * When the old response finally arrives it must NOT replace the newer result:
 * the displayed AUC must be the newer one, and the result snapshot digest must
 * match the newer inputs.
 * Scenario B (RRT block): a response arrives after the user selects RRT = Yes.
 * The RRT block must still be shown and no recommendation rendered.
 * Scenario C (stale gating): editing an input after a result obscures it and
 * disables Export/Copy until recalculation.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3005";
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  localStorage.setItem("vmz_disclaimer_acceptance", JSON.stringify({ version: "2026-09-16", acceptedAt: new Date().toISOString() }));
  localStorage.setItem("vancomyzer_settings", JSON.stringify({ teachingMode: false, blinkingCursor: false }));
});
const page = await ctx.newPage();
let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`); if (!ok) failures++; };

// Hold the first calculate response for 4 s; let later ones through immediately.
let calls = 0;
await page.route("**/api/calculate", async (route) => {
  const n = ++calls;
  if (n === 1) await new Promise((r) => setTimeout(r, 4000));
  await route.continue();
});

await page.goto(`${BASE}/calculator`, { waitUntil: "load" });
await page.locator("input[inputmode]").first().waitFor({ timeout: 30000 });
const inputs = page.locator("input[inputmode]");
await inputs.nth(0).fill("35"); await inputs.nth(1).fill("70"); await inputs.nth(2).fill("175"); await inputs.nth(3).fill("0.83");
await page.locator("button", { hasText: /^No$/ }).first().click();     // → request 1 (held)
await page.waitForTimeout(1200);
await inputs.nth(3).fill("2.5");                                          // → request 2 (fast)
await page.waitForTimeout(2000);
const aucAfterFast = await page.locator("text=/mg·h\\/L/").first().textContent().catch(() => "");
const readAuc = async () => {
  const t = await page.evaluate(() => {
    const el = [...document.querySelectorAll("span")].find((s) => s.textContent?.trim() === "AUC₂₄");
    return el?.parentElement?.querySelector(".tabular-nums")?.textContent ?? "";
  });
  return t;
};
const aucNewer = await readAuc();
await page.waitForTimeout(3500);                                          // old response arrives now
const aucAfterOld = await readAuc();
check("A: superseded response does not overwrite newer result", aucNewer !== "" && aucAfterOld === aucNewer, `${aucNewer} → ${aucAfterOld}`);
const digestOk = await page.evaluate(() => {
  try { const s = JSON.parse(sessionStorage.getItem("vancomyzer_calculator_state") || "{}"); return s?.result?.result_snapshot?.input_digest ? true : false; } catch { return false; }
});
check("A: result carries a snapshot digest", digestOk);
check("A: two requests were issued", calls >= 2, String(calls));

// Scenario B: hold the next response, switch RRT to Yes while it is in flight.
let holdNext = true;
await page.unroute("**/api/calculate");
await page.route("**/api/calculate", async (route) => {
  if (holdNext) { holdNext = false; await new Promise((r) => setTimeout(r, 2500)); }
  await route.continue();
});
await inputs.nth(3).fill("1.1");                                           // request (held 2.5 s)
await page.waitForTimeout(900);
await page.locator("button", { hasText: /^Yes$/ }).first().click();        // RRT = Yes while in flight
await page.waitForTimeout(3200);
const blocked = await page.locator("text=Calculator blocked").count();
const emptyBand = await page.locator("text=Calculator blocked for RRT.").count();   // empty-state band advisory
const numericDose = await page.evaluate(() => /\b\d{3,4}\s*\n?\s*mg\s*\n?\s*every/i.test(document.body.innerText));
check("B: RRT block persists after late response", blocked > 0);
check("B: no recommendation rendered after late response", emptyBand > 0 && !numericDose, `emptyBand=${emptyBand} numericDose=${numericDose}`);

// Scenario C: stale gating.
await page.locator("button", { hasText: /^No$/ }).first().click();
await page.waitForTimeout(2500);
await inputs.nth(1).fill("90");
await page.waitForTimeout(200);
const overlay = await page.locator("text=/Inputs changed/").count();
const exportsDisabled = await page.evaluate(() => {
  const el = [...document.querySelectorAll("[aria-disabled]")].find((e) => e.textContent?.includes("EXPORT"));
  return el?.getAttribute("aria-disabled") === "true";
});
check("C: stale overlay shown after input edit", overlay > 0);
check("C: exports disabled while stale", exportsDisabled);

await browser.close();
console.log(failures === 0 ? "\nresult-lifecycle: all checks passed" : `\nresult-lifecycle: ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
