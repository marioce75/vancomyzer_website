import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  renameSync,
  mkdtempSync,
  statSync,
  readdirSync,
} from "node:fs";
import { resolve, join, dirname, relative } from "node:path";
import { createHash } from "node:crypto";
import { forecastCase } from "../../src/lib/researchValidation/forecast";
import { MODEL_MANIFEST_VERSION } from "../../src/lib/pk/modelRegistry";
const hash = (x: string | Buffer) =>
  createHash("sha256").update(x).digest("hex");
function sourceFiles(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory()
        ? sourceFiles(p)
        : p.endsWith(".ts")
          ? [p]
          : [];
    });
}
function main() {
  const [inputArg, outputArg] = process.argv.slice(2);
  if (!inputArg || !outputArg)
    throw Error(
      "Usage: node --import tsx scripts/research/forecast.ts INPUT.json NEW_OUTPUT_DIRECTORY",
    );
  const inputPath = resolve(inputArg),
    output = resolve(outputArg);
  if (existsSync(output))
    throw Error("Output already exists; locked runs are never overwritten.");
  if (statSync(inputPath).size > 25_000_000)
    throw Error("Input exceeds the 25 MB batch limit.");
  const bytes = readFileSync(inputPath),
    batch = JSON.parse(bytes.toString());
  if (
    !batch ||
    batch.schema_version !== 1 ||
    Object.keys(batch).some(
      (k) => !["schema_version", "study_id", "cases"].includes(k),
    ) ||
    !/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(batch.study_id) ||
    !Array.isArray(batch.cases) ||
    !batch.cases.length ||
    batch.cases.length > 10000
  )
    throw Error("Invalid study batch schema or size.");
  const seen = new Set<string>();
  for (const c of batch.cases) {
    const key = JSON.stringify([c?.site_id, c?.case_id]);
    if (seen.has(key))
      throw Error(
        "Duplicate site/case key; use one primary forecast per patient.",
      );
    seen.add(key);
  }
  const predictions = batch.cases.map(forecastCase);
  const outputBytes = JSON.stringify(predictions, null, 2) + "\n";
  const root = process.cwd();
  const files = [
    ...sourceFiles(join(root, "src/lib/pk")),
    ...sourceFiles(join(root, "src/lib/researchValidation")),
    ...sourceFiles(join(root, "scripts/research")),
    join(root, "src/lib/manualHoursTimestamp.ts"),
    join(root, "src/lib/formatNumber.ts"),
    join(root, "package-lock.json"),
  ];
  const fileHashes = Object.fromEntries(
    files.sort().map((p) => [relative(root, p), hash(readFileSync(p))]),
  );
  const manifest = {
    schema_version: 1,
    study_id: batch.study_id,
    model_manifest: MODEL_MANIFEST_VERSION,
    runtime: process.version,
    generated_at: new Date().toISOString(),
    input_sha256: hash(bytes),
    predictions_sha256: hash(outputBytes),
    source_sha256: hash(JSON.stringify(fileHashes)),
    runner_sha256: hash(readFileSync(resolve(process.argv[1]))),
    files: fileHashes,
    attempted: predictions.length,
    forecasts: predictions.filter(
      (x: { status: string }) => x.status === "forecast",
    ).length,
    intended_use:
      "Research only; no patient-care recommendations. Developer-prepared release, independent review pending.",
  };
  mkdirSync(dirname(output), { recursive: true });
  const staging = mkdtempSync(join(dirname(output), ".study-run-"));
  writeFileSync(join(staging, "predictions.json"), outputBytes, {
    flag: "wx",
    mode: 0o600,
  });
  writeFileSync(
    join(staging, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  // The input hash binds the source dataset without copying it to another location.
  if (existsSync(output))
    throw Error("Output appeared during processing; refusing replacement.");
  renameSync(staging, output);
  console.log(
    JSON.stringify({
      attempted: manifest.attempted,
      forecasts: manifest.forecasts,
      status: "run_locked",
    }),
  );
}
try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : "Research run failed.");
  process.exitCode = 1;
}
