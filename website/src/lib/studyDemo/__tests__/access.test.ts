import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readStudyDemoConfig, studyDemoOwnerAllowed } from "../access";

const now = Date.UTC(2030, 0, 1, 12);
const sql = (ms: number) => new Date(ms).toISOString().replace("T", " ").slice(0, 19);
const row = (id: number, over: Record<string, unknown> = {}) => ({ id, role: "admin", status: "active", mfa_enabled: 0, mfa_verified_at: null, mfa_verified_session_token: null, ...over });
const tok = (id: number, over: Record<string, unknown> = {}) => ({ id: String(id), role: "admin", sessionToken: `s${id}`, lastActivity: now - 60_000, exp: now / 1000 + 600, ...over });
const on = { STUDY_DEMO_ENABLED: "true", STUDY_DEMO_OWNER_USER_ID: "7" };

test("config fails closed", () => {
  assert.deepEqual(readStudyDemoConfig(on), { ownerUserId: 7 });
  for (const env of [{}, { STUDY_DEMO_ENABLED: "true" }, { STUDY_DEMO_OWNER_USER_ID: "7" }, { ...on, STUDY_DEMO_ENABLED: "TRUE" }, { ...on, STUDY_DEMO_ENABLED: "1" },
    { ...on, STUDY_DEMO_OWNER_USER_ID: "" }, { ...on, STUDY_DEMO_OWNER_USER_ID: "0" }, { ...on, STUDY_DEMO_OWNER_USER_ID: "07" }, { ...on, STUDY_DEMO_OWNER_USER_ID: "7 " },
    { ...on, STUDY_DEMO_OWNER_USER_ID: "7,8" }, { ...on, STUDY_DEMO_OWNER_USER_ID: "mario" }, { ...on, STUDY_DEMO_OWNER_USER_ID: "99999999999999999" }]) {
    assert.equal(readStudyDemoConfig(env), null, JSON.stringify(env));
  }
});

test("only the configured owner's fully verified admin session is allowed", () => {
  const cfg = readStudyDemoConfig(on);
  assert.equal(studyDemoOwnerAllowed(cfg, tok(7), row(7), "s7", now), true);
  const denied: [string, Parameters<typeof studyDemoOwnerAllowed>][] = [
    ["flag off / no config", [null, tok(7), row(7), "s7", now]],
    ["other admin", [cfg, tok(1), row(1), "s1", now]],
    ["other admin presenting owner id in token", [cfg, tok(7), row(1), "s7", now]],
    ["owner demoted to pharmacist in DB", [cfg, tok(7), row(7, { role: "pharmacist" }), "s7", now]],
    ["owner disabled", [cfg, tok(7), row(7, { status: "disabled" }), "s7", now]],
    ["token role not admin", [cfg, tok(7, { role: "pharmacist" }), row(7), "s7", now]],
    ["superseded session", [cfg, tok(7), row(7), "other", now]],
    ["no DB row", [cfg, tok(7), undefined, "s7", now]],
    ["no token", [cfg, null, row(7), "s7", now]],
    ["admin inactivity > 60 min", [cfg, tok(7, { lastActivity: now - 3_600_001 }), row(7), "s7", now]],
    ["expired JWT", [cfg, tok(7, { exp: now / 1000 - 1 }), row(7), "s7", now]],
    ["MFA enabled, not verified", [cfg, tok(7), row(7, { mfa_enabled: 1 }), "s7", now]],
    ["MFA pending flag", [cfg, tok(7, { mfaPending: true }), row(7), "s7", now]],
  ];
  for (const [name, args] of denied) assert.equal(studyDemoOwnerAllowed(...args), false, name);
  assert.equal(studyDemoOwnerAllowed(cfg, tok(7), row(7, { mfa_enabled: 1, mfa_verified_at: sql(now - 1000), mfa_verified_session_token: "s7" }), "s7", now), true, "MFA verified for this session");
});

test("every demo entry point checks the owner on the server before serving anything", () => {
  const root = join(__dirname, "..", "..", "..");
  const page = readFileSync(join(root, "app/admin/dashboard/study-demo/page.tsx"), "utf8");
  assert.match(page, /if \(!\(await isStudyDemoOwner\(\)\)\) notFound\(\);/);
  assert.match(page, /force-dynamic/);
  const api = readFileSync(join(root, "app/api/admin/study-demo/route.ts"), "utf8");
  const handlers = api.match(/export async function (GET|POST|PUT|PATCH|DELETE)\b[^{]*\{\n\s*if \(!\(await isStudyDemoOwner\(\)\)\) return notFound\(\);/g) ?? [];
  const exported = api.match(/export async function \w+/g) ?? [];
  assert.equal(handlers.length, exported.length, "each handler starts with the owner check");
  assert.match(api, /private, no-store/);
  assert.doesNotMatch(api, /console\.|getDb|logCalculation|writeFile|insert/i, "the demo stores and logs nothing");
  // No new role, no role/permission change, no public link.
  const access = readFileSync(join(root, "lib/studyDemo/access.ts"), "utf8");
  assert.doesNotMatch(access, /setUserRole|UPDATE users|role\s*=\s*["']/);
});
