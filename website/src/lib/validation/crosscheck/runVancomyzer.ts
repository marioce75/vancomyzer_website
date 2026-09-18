/**
 * Runs the CURRENT Vancomyzer posterior engine over a crosscheck fixture and
 * records prior, posterior, exposure and fit diagnostics per patient.
 *
 *   npx tsx src/lib/validation/crosscheck/runVancomyzer.ts fixtures/crosscheck-seed42-n200.json
 *
 * Output: results/vancomyzer-<manifest>-<fixture>.json — the Vancomyzer side of
 * the comparison. The comparator side is produced separately (see README.md)
 * and must follow the same result schema.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { runPosteriorEngine } from "@/lib/pk/posterior/posteriorEngine";
import { computeExposure } from "@/lib/pk/steadyStateTwoCompartment";
import { MODEL_MANIFEST_VERSION } from "@/lib/pk/modelRegistry";
import { PRIOR_LOG_CL_SD, PRIOR_LOG_V1_SD, PRIOR_LOG_Q_SD, PRIOR_LOG_V2_SD, ASSAY_CV, ASSAY_SD_FLOOR_MCG_ML } from "@/lib/pk/posterior/fitPosteriorParameters";

const fixturePath = process.argv[2];
if (!fixturePath) { console.error("usage: runVancomyzer.ts <fixture.json>"); process.exit(2); }
const fx = JSON.parse(readFileSync(join(__dirname, fixturePath), "utf8"));

const results = fx.patients.map((p: any) => {
  const levels = p.levels.map((l: any) => ({ value_mcg_ml: l.value_mcg_ml, collection_time: "", time_since_last_dose_hours: l.time_since_last_dose_hours }));
  const r = runPosteriorEngine({ patient: p.patient, regimen: p.regimen, levels });
  const reg = { dose_mg: p.regimen.dose_mg, tau: p.regimen.interval_hours, T_inf: p.regimen.infusion_duration_hours };
  const post = computeExposure({ CL: r.CL, V1: r.V1, Q: r.Q, V2: r.V2, ...reg });
  return {
    id: p.id,
    prior: { CL: r.prior_CL, V1: r.prior_V1, Q: r.prior_Q, V2: r.prior_V2 },
    posterior: { CL: r.CL, V1: r.V1, Q: r.Q, V2: r.V2 },
    truth: p.truth,
    exposure_steady_state: { auc24: post.auc24, peak: post.peak, trough: post.trough, horizon: "steady_state" },
    fit: { success: r.success, quality: r.diagnostics.fit_quality, converged: r.diagnostics.convergence?.converged, boundary_hits: r.diagnostics.boundary_hits, objective: r.diagnostics.objective?.total, cl_bound: r.posterior_cl_bound ?? null },
    predicted_at_observations: r.diagnostics.predicted_at_observations,
  };
});

const out = {
  product: "Vancomyzer (this repository, current working tree)",
  engine_manifest: MODEL_MANIFEST_VERSION,
  run_at: new Date().toISOString(),
  fixture: basename(fixturePath),
  fixture_seed: fx.seed,
  prior_model: "Colin 2019 (modelRegistry.ts)",
  prior_log_sd: { CL: PRIOR_LOG_CL_SD, V1: PRIOR_LOG_V1_SD, Q: PRIOR_LOG_Q_SD, V2: PRIOR_LOG_V2_SD },
  error_model: `sigma = max(${ASSAY_SD_FLOOR_MCG_ML}, ${ASSAY_CV} x max(obs, pred)); Gaussian NLL with ln(sigma)`,
  renal_assumption: "SCr used directly as the Colin 2019 covariate; no Cockcroft-Gault in the dose",
  exposure_horizon: "steady_state (confirmed in fixture)",
  peak_definition: "end of infusion, steady state", trough_definition: "end of dosing interval, steady state",
  units: fx.units,
  results,
};
const file = join(__dirname, "results", `vancomyzer-${MODEL_MANIFEST_VERSION}-${basename(fixturePath).replace(/\.json$/, "")}.json`);
writeFileSync(file, JSON.stringify(out, null, 1));
const ok = results.filter((r: any) => r.fit.success).length;
console.log(`wrote ${file}: ${results.length} patients, ${ok} fits succeeded, ${results.filter((r: any) => (r.fit.boundary_hits ?? []).length).length} boundary hits`);
