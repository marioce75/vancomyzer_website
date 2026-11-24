/**
 * Build the offline HCA study package into a NEW directory and a .tar.gz with
 * its SHA-256. Run from website/:  node scripts/study-hca/package.mjs /path/to/new-dir
 * Refuses a dirty git tree (the package must map to one commit).
 */
import { build } from "esbuild";
import { mkdirSync, existsSync, cpSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, relative, basename, dirname } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const dest = process.argv[2] && resolve(process.argv[2]);
if (!dest || existsSync(dest)) throw Error("Supply a NEW package directory; existing packages are not overwritten.");
const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const dirty = git("status", "--porcelain", "--", ".");
if (dirty && !process.argv.includes("--allow-dirty")) throw Error(`Working tree has uncommitted changes:\n${dirty}`);
const commit = git("rev-parse", "HEAD");
const sha = (b) => createHash("sha256").update(b).digest("hex");

mkdirSync(dest, { recursive: true });
const common = { bundle: true, minify: false, legalComments: "none", logLevel: "warning" };
await build({ ...common, entryPoints: ["scripts/study-hca/predict.ts"], outfile: join(dest, "predict.cjs"), platform: "node", target: "node18", format: "cjs" });
const web = await build({ ...common, entryPoints: ["scripts/study-hca/case-entry.ts"], write: false, platform: "browser", target: "es2019", format: "iife" });
const js = web.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = readFileSync("scripts/study-hca/case-entry.template.html", "utf8").split("/*BUNDLE*/").join(js);
writeFileSync(join(dest, "case-entry.html"), html);

// Guard: the built artefacts must contain no network client code.
for (const f of ["predict.cjs", "case-entry.html"]) {
  const text = readFileSync(join(dest, f), "utf8");
  const bad = text.match(/\b(fetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|require\("(node:)?(https?|net|tls|dgram|dns|child_process)"\))/);
  if (bad) throw Error(`${f} contains a network or process API: ${bad[0]}`);
}

for (const f of ["README.md", "FIELD_DICTIONARY.md", "ACCEPTANCE_PLAN.md", "REVIEWER_CASES.md"]) cpSync(join("docs/study-hca", f), join(dest, f));
cpSync("docs/study-hca/examples", join(dest, "examples"), { recursive: true });

const version = JSON.parse(execFileSync(process.execPath, [join(dest, "predict.cjs"), "--version"], { encoding: "utf8" }));
writeFileSync(join(dest, "RELEASE.json"), JSON.stringify({ ...version, package_source_commit: commit, built_with_node: process.version, fictional_data_only: true }, null, 2) + "\n");

function files(dir) { return readdirSync(dir).sort().flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : [p]; }); }
const lines = files(dest).map((p) => `${sha(readFileSync(p))}  ${relative(dest, p)}`);
writeFileSync(join(dest, "SHA256SUMS"), lines.join("\n") + "\n");

const archive = `${dest}.tar.gz`;
if (existsSync(archive)) throw Error(`${archive} exists`);
execFileSync("tar", ["-czf", archive, "-C", dirname(dest), basename(dest)], { env: { ...process.env, COPYFILE_DISABLE: "1" } });
const archiveSha = sha(readFileSync(archive));
writeFileSync(`${archive}.sha256`, `${archiveSha}  ${basename(archive)}\n`);
console.log(JSON.stringify({ status: "packaged", directory: dest, archive, archive_sha256: archiveSha, package_source_commit: commit, files: lines.length }, null, 2));
