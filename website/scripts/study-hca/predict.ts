/**
 * Offline batch runner for the HCA timed-draw study workflow.
 *
 *   node predict.cjs --json INPUT.json --out NEW_DIRECTORY
 *   node predict.cjs --cases cases.csv --doses doses.csv --out NEW_DIRECTORY
 *   node predict.cjs --version
 *
 * Reads only the named input files and writes only inside NEW_DIRECTORY, which
 * must not exist yet. No network, accounts, analytics, environment files or
 * background activity. Imports nothing but node:fs, node:path, node:crypto and
 * the pure prediction modules.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { BatchFormatError, casesFromCsv, casesFromJson, resultsToCsv, runBatch, BATCH_SCHEMA, BATCH_SCHEMA_VERSION } from "../../src/lib/studyTimed/batch";
import { CALCULATION_RELEASE_COMMIT, PREDICTION_FUNCTION_ID, RELEASE_LABEL, STUDY_MODEL_MANIFEST_VERSION, TIMED_WORKFLOW_VERSION } from "../../src/lib/studyTimed/release";

const MAX_BYTES = 50_000_000;
const sha = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");

function args(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) throw new Error(`Unexpected argument ${a}`);
    const key = a.slice(2);
    if (key === "version" || key === "help") { out[key] = "1"; continue; }
    const v = argv[++i];
    if (v === undefined) throw new Error(`--${key} needs a value`);
    out[key] = v;
  }
  return out;
}

function read(path: string): Buffer {
  const p = resolve(path);
  if (statSync(p).size > MAX_BYTES) throw new Error(`${path} exceeds the 50 MB limit.`);
  return readFileSync(p);
}

const USAGE = `Usage:
  node predict.cjs --json INPUT.json --out NEW_DIRECTORY
  node predict.cjs --cases cases.csv --doses doses.csv --out NEW_DIRECTORY
  node predict.cjs --version`;

function main(): number {
  const a = args(process.argv.slice(2));
  if (a.version) {
    console.log(JSON.stringify({ workflow: TIMED_WORKFLOW_VERSION, calculation_release_commit: CALCULATION_RELEASE_COMMIT, model_manifest_version: STUDY_MODEL_MANIFEST_VERSION, prediction_function: PREDICTION_FUNCTION_ID, input_schema: `${BATCH_SCHEMA} v${BATCH_SCHEMA_VERSION}` }, null, 2));
    return 0;
  }
  if (a.help || !a.out || (!a.json && !(a.cases && a.doses)) || (a.json && (a.cases || a.doses))) { console.error(USAGE); return 64; }
  const out = resolve(a.out);
  if (existsSync(out)) { console.error(`Refusing to write: ${out} already exists. Runs are never overwritten.`); return 73; }

  const inputs: { name: string; sha256: string; bytes: number }[] = [];
  let cases: unknown[];
  try {
    if (a.json) {
      const b = read(a.json);
      inputs.push({ name: a.json, sha256: sha(b), bytes: b.length });
      cases = casesFromJson(b.toString("utf8"));
    } else {
      const c = read(a.cases), d = read(a.doses);
      inputs.push({ name: a.cases, sha256: sha(c), bytes: c.length }, { name: a.doses, sha256: sha(d), bytes: d.length });
      cases = casesFromCsv(c.toString("utf8"), d.toString("utf8"));
    }
    const results = runBatch(cases);
    const csv = resultsToCsv(results);
    const json = JSON.stringify({ release: RELEASE_LABEL, results }, null, 2) + "\n";
    mkdirSync(out, { mode: 0o700 });
    writeFileSync(join(out, "predictions.csv"), csv, { mode: 0o600, flag: "wx" });
    writeFileSync(join(out, "predictions.json"), json, { mode: 0o600, flag: "wx" });
    const manifest = {
      workflow: TIMED_WORKFLOW_VERSION,
      calculation_release_commit: CALCULATION_RELEASE_COMMIT,
      model_manifest_version: STUDY_MODEL_MANIFEST_VERSION,
      prediction_function: PREDICTION_FUNCTION_ID,
      node_version: process.version,
      inputs,
      outputs: { "predictions.csv": sha(csv), "predictions.json": sha(json) },
      counts: { cases: results.length, predicted: results.filter((r) => r.status === "predicted").length, refused: results.filter((r) => r.status === "refused").length },
      note: "Research use only. Predictions are not dose recommendations and are not for patient care.",
    };
    writeFileSync(join(out, "run-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    console.log(JSON.stringify({ status: "written", directory: out, ...manifest.counts }));
    return 0;
  } catch (e) {
    if (e instanceof BatchFormatError) {
      console.error("Input refused; nothing was written.");
      for (const r of e.reasons) console.error(`  ${r.code}: ${r.message}`);
      return 65;
    }
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

process.exitCode = main();
