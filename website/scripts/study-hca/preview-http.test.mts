/**
 * Protected-preview test: builds an isolated production preview of this branch
 * on a fixture database (synthetic accounts only, never an application DB or
 * .env), then checks owner-only access over real HTTP, demo/offline parity,
 * and the release calculator's unrounded output against the timed workflow.
 *
 * Run from website/ (needs ~500 MB free; nothing is sent off this machine):
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node --import tsx scripts/study-hca/preview-http.test.mts
 * Set STUDY_PREVIEW_KEEP=1 to leave the owner preview running for a manual look.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import fictionalModule from "../../src/lib/studyTimed/fictionalCases";
import predictModule from "../../src/lib/studyTimed/predictAtDraw";

const require = createRequire(path.join(process.cwd(), "package.json"));
const Database = require("better-sqlite3");
const { encode } = require("next-auth/jwt");
const { FICTIONAL_CASES } = fictionalModule as unknown as typeof import("../../src/lib/studyTimed/fictionalCases");
const { predictAtDraw } = predictModule as unknown as typeof import("../../src/lib/studyTimed/predictAtDraw");
const source = process.cwd();
assert(fs.existsSync(path.join(source, "src/lib/studyDemo/access.ts")), "run from website/");
assert(!fs.existsSync("/data"), "Refuse fixture run when a production /data directory exists");

const OWNER = 7;
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "study-demo-preview-"));
for (const name of ["src", "public", "package.json", "tsconfig.json", "next-env.d.ts", "next.config.js", "postcss.config.js", "tailwind.config.ts"]) {
  if (fs.existsSync(path.join(source, name))) fs.cpSync(path.join(source, name), path.join(fixture, name), { recursive: true });
}
fs.symlinkSync(fs.realpathSync("node_modules"), path.join(fixture, "node_modules"), "dir");
fs.mkdirSync(path.join(fixture, "data"));
const db = new Database(path.join(fixture, "data/users.db"));
const schema = fs.readFileSync("src/lib/db.ts", "utf8").match(/CREATE TABLE IF NOT EXISTS users \([\s\S]*?\n    \);/)![0];
db.exec(schema);
for (const q of ["ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0", "ALTER TABLE users ADD COLUMN mfa_verified_at TEXT", "ALTER TABLE users ADD COLUMN mfa_verified_session_token TEXT"]) db.exec(q);
const now = Date.now();
const sql = (ms: number) => new Date(ms).toISOString().replace("T", " ").slice(0, 19);
const insert = db.prepare("INSERT INTO users (id,username,email,password_hash,full_name,credentials,role,status,session_token,last_login,mfa_enabled,mfa_verified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
// 1 other admin, 2 pharmacist, 3 disabled admin, 4 admin with MFA pending, 7 owner admin.
for (const [id, role, status, mfa] of [[1, "admin", "active", 0], [2, "pharmacist", "active", 0], [3, "admin", "disabled", 0], [4, "admin", "active", 1], [OWNER, "admin", "active", 0]] as const) {
  insert.run(id, `fixture${id}`, `fixture${id}@example.invalid`, "NO_LOGIN_PASSWORD", "Synthetic fixture", "Fixture", role, status, `fixture-session-${id}`, sql(now - 120000), mfa, null);
}
const secret = randomBytes(32).toString("hex");
const port = process.env.STUDY_PREVIEW_PORT || "3247";
const base = `http://127.0.0.1:${port}`;
const baseEnv = { PATH: process.env.PATH!, HOME: process.env.HOME!, NODE_ENV: "production", NEXTAUTH_SECRET: secret, NEXTAUTH_URL: base, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_OPEN_ACCESS: "true" };
const next = require.resolve("next/dist/bin/next");

console.log(`[preview] building in ${fixture}`);
const built = spawnSync(process.execPath, [next, "build"], { cwd: fixture, env: baseEnv, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
fs.writeFileSync(path.join(fixture, "build.log"), (built.stdout ?? "") + (built.stderr ?? ""));
assert.equal(built.status, 0, `next build failed; see ${fixture}/build.log`);

const cookie = (id: number, over: Record<string, unknown> = {}) =>
  encode({ secret, token: { id: String(id), role: id === 2 ? "pharmacist" : "admin", sessionToken: `fixture-session-${id}`, lastActivity: Date.now(), mfaPending: id === 4, mfaVerified: false, ...over }, maxAge: 1800 });

async function start(env: Record<string, string>): Promise<ChildProcess> {
  const log = fs.openSync(path.join(fixture, `server-${Object.values(env).join("-") || "default"}.log`), "w");
  const server = spawn(process.execPath, [next, "start", "-H", "127.0.0.1", "-p", port], { cwd: fixture, env: { ...baseEnv, ...env }, stdio: ["ignore", log, log] });
  for (let i = 0; i < 120; i++) {
    assert(server.exitCode === null, "preview server exited; inspect the server log");
    try { await fetch(base + "/api/health"); return server; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("preview server did not start");
}
async function stop(server: ChildProcess) {
  server.kill("SIGTERM");
  await new Promise((r) => server.once("exit", r));
}
async function req(token: string | null, method: string, target: string, body?: unknown) {
  const r = await fetch(base + target, { method, redirect: "manual", headers: { ...(token ? { cookie: `next-auth.session-token=${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: r.status, location: r.headers.get("location"), cache: r.headers.get("cache-control"), text: await r.text() };
}

const PAGE = "/admin/dashboard/study-demo";
const API = "/api/admin/study-demo";
const report: Record<string, unknown>[] = [];
const expectDenied = async (label: string, token: string | null) => {
  const page = await req(token, "GET", PAGE);
  const get = await req(token, "GET", API);
  const post = await req(token, "POST", API, { case_id: "FICT-A01", action: "predict" });
  const reveal = await req(token, "POST", API, { case_id: "FICT-A01", action: "reveal" });
  const row = { who: label, page: `${page.status}${page.location ? ` -> ${new URL(page.location, base).pathname}` : ""}`, api_get: get.status, api_predict: post.status, api_reveal: reveal.status };
  report.push(row);
  assert.ok([307, 308, 404].includes(page.status), `${label} page ${page.status}`);
  if (page.status === 404) assert.doesNotMatch(page.text, /Fictional case only|FICT-A0/, `${label}: 404 page leaks demo content`);
  for (const r of [get, post, reveal]) {
    assert.ok([401, 404].includes(r.status), `${label} api ${r.status}`);
    assert.doesNotMatch(r.text, /FICT-A0|predicted_concentration|fictional_lab_result/, `${label}: API leaks demo content`);
  }
};

let server: ChildProcess | null = null;
try {
  // 1. Enabled, owner configured.
  server = await start({ STUDY_DEMO_ENABLED: "true", STUDY_DEMO_OWNER_USER_ID: String(OWNER) });
  const owner = await cookie(OWNER);
  const page = await req(owner, "GET", PAGE);
  assert.equal(page.status, 200, "owner page");
  assert.match(page.text, /Fictional case only • Research demo • Not for patient care/);
  assert.match(page.cache ?? "", /no-store/, `page cache-control ${page.cache}`);
  const catalog = await req(owner, "GET", API);
  assert.equal(catalog.status, 200);
  assert.match(catalog.cache ?? "", /private, no-store/);
  const parity: Record<string, unknown>[] = [];
  for (const fc of FICTIONAL_CASES) {
    const r = await req(owner, "POST", API, { case_id: fc.input.study_case_id, action: "predict" });
    assert.equal(r.status, 200);
    const demo = JSON.parse(r.text).result.predicted_concentration_mg_l;
    const offline = predictAtDraw(fc.input).predicted_concentration_mg_l;
    assert.equal(demo, offline, `${fc.input.study_case_id} demo ${demo} vs offline ${offline}`);
    const rev = await req(owner, "POST", API, { case_id: fc.input.study_case_id, action: "reveal" });
    assert.equal(rev.status, 200);
    parity.push({ case: fc.input.study_case_id, demo_mg_l: demo, offline_mg_l: offline, identical: demo === offline, fictional_lab_mg_l: JSON.parse(rev.text).fictional_lab_result_mg_l });
  }
  report.push({ who: "owner admin (id 7)", page: 200, api_get: 200, api_predict: 200, api_reveal: 200 });
  // Free-text / patient data is refused even for the owner.
  for (const body of [{ case_id: "FICT-A01", action: "predict", age_years: 50 }, { case_id: "REAL-1", action: "predict" }, { input: FICTIONAL_CASES[0].input }]) {
    assert.equal((await req(owner, "POST", API, body)).status, 400, JSON.stringify(body));
  }
  await expectDenied("signed out", null);
  await expectDenied("pharmacist (id 2)", await cookie(2));
  await expectDenied("other admin (id 1)", await cookie(1));
  await expectDenied("disabled admin (id 3)", await cookie(3));
  await expectDenied("admin with MFA pending (id 4)", await cookie(4));
  await expectDenied("other admin claiming owner id in a token signed with another key", await encode({ secret: "wrong-signing-key", token: { id: String(OWNER), role: "admin", sessionToken: `fixture-session-${OWNER}`, lastActivity: Date.now() }, maxAge: 600 }));
  await expectDenied("owner after 60 min admin inactivity", await cookie(OWNER, { lastActivity: Date.now() - 3_600_001 }));
  await expectDenied("owner with a superseded session", await cookie(OWNER, { sessionToken: "old-session" }));

  // Release calculator over HTTP (unchanged code) vs the timed workflow.
  let compared = 0, maxScaled = 0;
  for (const p of [{ age: 35, weight_kg: 70, scr: 0.83 }, { age: 71, weight_kg: 77, scr: 1.2 }, { age: 46, weight_kg: 160, scr: 1.0 }, { age: 84, weight_kg: 52, scr: 1.9 }]) {
    const r = await req(null, "POST", "/api/calculate", { mode: "initial_regimen", patient: { age: p.age, weight_kg: p.weight_kg, serum_creatinine_mg_dl: p.scr, dialysis_or_rrt: false } });
    assert.equal(r.status, 200, r.text.slice(0, 300));
    const j = JSON.parse(r.text);
    const res = j.result ?? j;
    const tau = res.recommended_interval_hours, mg = Number(String(res.recommended_dose).replace(/[^0-9.]/g, ""));
    const tInf = Math.min(res.recommended_infusion_duration_hours, tau);
    for (const pt of res.curve as { time_hours: number; concentration: number }[]) {
      if (!(pt.time_hours > 0)) continue;
      const n = Math.ceil(pt.time_hours / tau - 1e-12);
      const mine = predictAtDraw({ study_case_id: "FICT-HTTP", time_basis: "elapsed_hours", age_years: p.age, weight_kg: p.weight_kg, serum_creatinine_mg_dl: p.scr, scr_collected_at: -1, renal_replacement_therapy: false, history_complete_attested: true, draw_time: pt.time_hours, doses: Array.from({ length: n }, (_, k) => ({ start: k * tau, dose_mg: mg, infusion_minutes: tInf * 60 })) });
      const scaled = Math.abs(mine.predicted_concentration_mg_l! - pt.concentration) / Math.max(Math.abs(pt.concentration), 1);
      maxScaled = Math.max(maxScaled, scaled);
      assert.ok(scaled <= 1e-12, `t=${pt.time_hours}: ${mine.predicted_concentration_mg_l} vs ${pt.concentration}`);
      compared++;
    }
    const pk = res.pk_parameters;
    const mp = predictAtDraw({ study_case_id: "FICT-HTTP", time_basis: "elapsed_hours", age_years: p.age, weight_kg: p.weight_kg, serum_creatinine_mg_dl: p.scr, scr_collected_at: -1, renal_replacement_therapy: false, history_complete_attested: true, draw_time: 5, doses: [{ start: 0, dose_mg: 1000, infusion_minutes: 60 }] }).model_parameters!;
    assert.deepEqual([mp.CL_L_h, mp.V1_L, mp.Q_L_h, mp.V2_L], [pk.CL, pk.V1, pk.Q, pk.V2]);
  }

  // Browser: owner sees the nav entry and the demo; another admin sees neither.
  let browserNote = "skipped (PLAYWRIGHT_MODULE not set)";
  if (process.env.PLAYWRIGHT_MODULE) {
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
    const browser = await chromium.launch({ headless: true });
    try {
      for (const [who, token, expectLink] of [["owner", owner, true], ["other admin", await cookie(1), false]] as const) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
        await context.route("**/*", (r: { request(): { url(): string }; continue(): unknown; abort(): unknown }) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
        await context.addCookies([{ name: "next-auth.session-token", value: token, url: base }]);
        const tab = await context.newPage();
        await tab.goto(base + "/admin/dashboard", { waitUntil: "networkidle", timeout: 60000 });
        const links = await tab.locator(`a[href="${PAGE}"]`).count();
        assert.equal(links > 0, expectLink, `${who} nav link count ${links}`);
        if (expectLink) {
          await tab.goto(base + PAGE, { waitUntil: "networkidle" });
          await tab.getByRole("tab", { name: "FICT-A02" }).click();
          await tab.getByRole("button", { name: "Predict concentration at the draw" }).click();
          await tab.getByText("Reveal fictional lab result").click();
          await tab.getByText("Fictional lab result:").waitFor();
          await tab.screenshot({ path: path.join(fixture, "owner-study-demo.png"), fullPage: true });
        } else {
          const r = await tab.goto(base + PAGE, { waitUntil: "networkidle" });
          assert.equal(r?.status(), 404);
          assert.equal(await tab.getByText("Fictional case only").count(), 0);
        }
        await context.close();
      }
      browserNote = `owner sees the entry and completes predict + reveal; other admin has no entry and gets 404 (screenshot ${path.join(fixture, "owner-study-demo.png")})`;
    } finally { await browser.close(); }
  }
  if (process.env.STUDY_PREVIEW_KEEP !== "1") { await stop(server); server = null; }

  // 2. Fail closed: flag off, owner ID missing, owner ID malformed.
  if (process.env.STUDY_PREVIEW_KEEP !== "1") {
    for (const env of [{ STUDY_DEMO_OWNER_USER_ID: String(OWNER) }, { STUDY_DEMO_ENABLED: "true" }, { STUDY_DEMO_ENABLED: "true", STUDY_DEMO_OWNER_USER_ID: "7 or 1" }]) {
      server = await start(env);
      await expectDenied(`owner, config ${JSON.stringify(env)}`, await cookie(OWNER));
      await stop(server); server = null;
    }
  }
  console.log(JSON.stringify({ fixture, access: report, demo_offline_parity: parity, release_http_curve_points_compared: compared, release_http_max_scaled_difference: maxScaled, browser: browserNote }, null, 2));
  if (process.env.STUDY_PREVIEW_KEEP === "1") console.log(`[preview] owner preview left running at ${base}${PAGE}; owner cookie next-auth.session-token=${owner}`);
} finally {
  if (server && process.env.STUDY_PREVIEW_KEEP !== "1") await stop(server);
  db.close();
}
