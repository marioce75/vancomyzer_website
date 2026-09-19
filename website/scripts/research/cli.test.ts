import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const temp = mkdtempSync(join(tmpdir(), "vanc-study-test-"));
const run = join(temp, "locked"),
  report = join(temp, "analysis.json");
let checks = 0;
function launch(script: string, args: string[], ok: boolean) {
  const p = spawnSync(
    process.execPath,
    ["--import", "tsx", `scripts/research/${script}.ts`, ...args],
    { encoding: "utf8" },
  );
  assert.equal(p.status === 0, ok, p.stdout + p.stderr);
  checks++;
}
launch("forecast", ["docs/study-release/synthetic-input.json", run], true);
launch("forecast", ["docs/study-release/synthetic-input.json", run], false);
launch(
  "analyze",
  [run, "docs/study-release/synthetic-outcomes.json", report],
  true,
);
const result = JSON.parse(readFileSync(report, "utf8"));
assert.equal(result.evaluable, 1);
assert.equal(result.attempted, 1);
checks += 2;
launch(
  "analyze",
  [run, "docs/study-release/synthetic-outcomes.json", report],
  false,
);
const predictions = JSON.parse(
  readFileSync(join(run, "predictions.json"), "utf8"),
);
predictions[0].forecast_mg_l = 999;
writeFileSync(join(run, "predictions.json"), JSON.stringify(predictions));
launch(
  "analyze",
  [
    run,
    "docs/study-release/synthetic-outcomes.json",
    join(temp, "tampered.json"),
  ],
  false,
);
const invalid = JSON.parse(
  readFileSync("docs/study-release/synthetic-input.json", "utf8"),
);
invalid.cases.push(invalid.cases[0]);
writeFileSync(join(temp, "duplicates.json"), JSON.stringify(invalid));
launch(
  "forecast",
  [join(temp, "duplicates.json"), join(temp, "duplicate-run")],
  false,
);
console.log(
  `Research CLI: ${checks} checks passed; synthetic files retained in temporary test directory.`,
);
