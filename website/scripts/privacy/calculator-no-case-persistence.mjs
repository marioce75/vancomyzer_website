/** Local synthetic regression only; run from website/ with PLAYWRIGHT_MODULE set if needed. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

assert(!fs.existsSync("/data"), "Do not run this fixture on a production volume");
const source = process.cwd();
const require = createRequire(path.join(source, "package.json"));
const Database = require("better-sqlite3");
const { encode } = require("next-auth/jwt");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "vmz-no-case-persistence-"));
for (const name of ["src", "public", "package.json", "tsconfig.json", "next-env.d.ts", "next.config.js", "postcss.config.js", "tailwind.config.ts"]) {
  if (fs.existsSync(path.join(source, name))) {
    fs.cpSync(path.join(source, name), path.join(fixture, name), {
      recursive: true, filter: p => !p.startsWith(path.join(source, "public", "videos")),
    });
  }
}
fs.symlinkSync(fs.realpathSync("node_modules"), path.join(fixture, "node_modules"), "dir");
const secret = randomBytes(32).toString("hex");
const port = process.env.PRIVACY_TEST_PORT || "3299";
const base = "http://localhost:" + port;
const log = fs.openSync(path.join(fixture, "server.log"), "w");
const server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "-H", "127.0.0.1", "-p", port], {
  cwd: fixture,
  env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "development", NEXTAUTH_SECRET: secret,
    NEXTAUTH_URL: base, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_OPEN_ACCESS: "true" },
  stdio: ["ignore", log, log],
});
const email = "synthetic@example.invalid";
const session = await encode({ secret, token: { id: "1", email, name: "Synthetic fixture", role: "pharmacist",
  username: email, sessionToken: "synthetic-session", first_login_acknowledged: 1, lastActivity: Date.now(),
}, maxAge: 600 });
const patient = { age: 55, weight_kg: 75, height_cm: 175, sex: "male", serum_creatinine_mg_dl: 1, dialysis_or_rrt: false };
const existing = { mode: "existing_regimen", patient, regimen: { dose_mg: 1000, interval_hours: 12,
  infusion_duration_hours: 2, doses_given: 12, steady_state_confirmed: true },
levels: [{ value_mcg_ml: 13, collection_time: "2026-01-01T19:00:00Z", time_since_last_dose_hours: 11 }] };
const modes = [{ mode: "initial_regimen", patient }, existing, { ...existing,
  levels: [...existing.levels, { value_mcg_ml: 24, collection_time: "2026-01-01T12:00:00Z", time_since_last_dose_hours: 4 }],
}];
const post = (url, payload) => fetch(base + url, { method: "POST",
  headers: { cookie: "next-auth.session-token=" + session, "Content-Type": "application/json" }, body: JSON.stringify(payload),
});
let db; let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    assert.equal(server.exitCode, null, "Fixture server exited");
    try {
      const health = await fetch(base + "/api/health");
      if (health.ok && fs.existsSync(path.join(fixture, "data", "users.db"))) { ready = true; break; }
    } catch { /* wait for module compilation/startup */ }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  assert(ready, "Fixture server did not create its isolated database");
  db = new Database(path.join(fixture, "data", "users.db"));
  // Simulate a historical DB upgraded on a subsequent process start. In a brand-new
  // DB, the two legacy ALTERs precede CREATE TABLE in the existing initializer.
  const historyColumns = db.pragma("table_info(calculation_log)").map(c => c.name);
  if (!historyColumns.includes("case_id")) db.exec("ALTER TABLE calculation_log ADD COLUMN case_id TEXT");
  if (!historyColumns.includes("tier_at_time")) db.exec("ALTER TABLE calculation_log ADD COLUMN tier_at_time TEXT");
  db.prepare("INSERT INTO users (id, username, email, password_hash, full_name, credentials, role, status, session_token, subscription_tier) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(1, email, email, "NO_LOGIN_PASSWORD", "Synthetic fixture", "Fixture", "pharmacist", "active", "synthetic-session", "individual_pro");
  db.prepare("INSERT INTO calculation_log (user_id, workflow_type, auc24, case_id) VALUES (1, 'empiric', 499.8, 'LEGACY-SYNTHETIC')").run();
  const historical = db.prepare("SELECT * FROM calculation_log").all();
  const tempSession = { cookie: "next-auth.session-token=" + session };
  const current = await fetch(base + "/api/auth/session", { headers: tempSession });
  assert.equal((await current.json()).user?.subscriptionTier, "individual_pro", "Must exercise a signed-in history-eligible user");
  for (const [i, payload] of modes.entries()) {
    const r = await post("/api/calculate", { ...payload, case_id: "NEW-SYNTHETIC", intent: "explicit" });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("Cache-Control"), "private, no-store");
    const result = await r.json();
    assert.equal(result.auc24, [499.8, 470.4, 468][i]);
    assert.equal(result.pk_parameters.used_posterior_refinement, i !== 0);
    assert.deepEqual(db.prepare("SELECT * FROM calculation_log").all(), historical);
  }
  const trial = await post("/api/trial/log-case", { ageGroup: "adult", bmi: 24, calculatedAuc: 499.8 });
  assert.equal(trial.status, 403);
  assert.equal((await trial.json()).ok, false);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM trial_cases").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM trials").get().n, 0);
  const history = await fetch(base + "/api/history", { headers: tempSession });
  assert.equal(history.status, 200);
  assert.equal((await history.json()).rows[0].case_id, "LEGACY-SYNTHETIC");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.route("**/*", r => r.request().url().startsWith(base) ? r.continue() : r.abort());
  await context.addCookies([{ name: "next-auth.session-token", value: session, url: base }]);
  const page = await context.newPage();
  // Synthetic localhost fixture marker; never use this route on a deployed site.
  await page.addInitScript(() => {
    localStorage.setItem("vmz_disclaimer_acceptance", JSON.stringify({ version: "2026-10-11", acceptedAt: new Date().toISOString() }));
    if (!sessionStorage.getItem("legacy-fixture-seeded")) {
      sessionStorage.setItem("legacy-fixture-seeded", "yes");
      sessionStorage.setItem("vancomyzer_calculator_state", JSON.stringify({ patient: { age: 66 }, timestamp: Date.now() }));
    }
  });
  const auditConsole = [];
  page.on("console", message => { if (message.text().includes("VANCOMYZER PK VALIDATION")) auditConsole.push(message.text()); });
  await page.goto(base + "/calculator", { waitUntil: "domcontentloaded", timeout: 60000 });
  const age = page.getByPlaceholder("e.g. 65", { exact: true });
  try { await age.waitFor({ timeout: 12000 }); } catch (error) {
    console.error(await page.locator("body").innerText());
    console.error(await page.locator("input").evaluateAll(inputs => inputs.map(input => [input.placeholder, input.getAttribute("aria-label")])));
    throw error;
  }
  assert.equal(await age.inputValue(), "", "Legacy draft should not restore");
  assert.equal(await page.locator("#case-id-input").count(), 0);
  await age.fill("55");
  await page.getByPlaceholder("e.g. 75.5", { exact: true }).fill("75");
  await page.getByPlaceholder("e.g. 1.1", { exact: true }).fill("1");
  const calc = page.waitForResponse(r => r.url() === base + "/api/calculate" && r.request().method() === "POST");
  await page.getByRole("button", { name: "No", exact: true }).first().click();
  const response = await calc;
  assert.equal(response.status(), 200);
  assert(!Object.hasOwn(response.request().postDataJSON(), "case_id"));
  await page.getByText("Before levels", { exact: true }).first().waitFor();
  assert.equal(await age.inputValue(), "55", "Retain in-memory edits during use");
  assert.equal((await page.evaluate(() => JSON.parse(sessionStorage.getItem("vancomyzer_calculator_state")))).patient.age, 66,
    "No new browser draft should overwrite the legacy marker");
  await page.reload({ waitUntil: "domcontentloaded" });
  await age.waitFor();
  assert.equal(await age.inputValue(), "", "New input must not survive a reload");
  assert.equal(auditConsole.length, 0, "Clinical results must not be written to browser console");
  assert.deepEqual(db.prepare("SELECT * FROM calculation_log").all(), historical);
  console.log("Passed: signed-in adult 0/1/2-level responses, no history writes, no-store headers, disabled pilot write, legacy read, in-memory only browser UX.");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  if (db) db.close();
  fs.closeSync(log);
}
