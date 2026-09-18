/**
 * Regression suite for the exposure-horizon remediation (17 Sep 2026).
 *
 * Reference patient (public review, 17 Sep 2026): age 35, 70 kg, 175 cm,
 * SCr 0.83 mg/dL, no RRT; 1000 mg q12h infused over 1.75 h; "≥6 · steady state";
 * level 12.9 mg/L at 12 h after infusion START.
 *
 * Observed before the fix: current row AUC 486.9 / peak 30.6 / trough 12.0 and
 * recommended row (same regimen) 486.9 / 31.9 / 12.9, both labelled steady
 * state. Cause: three steady-state predicates (validator, fitter, engine); the
 * engine reported six-dose peak/trough from the plotted curve beside a
 * steady-state daily AUC, while the fit and the candidates used steady state.
 *
 * Run: npx tsx src/lib/pk/__tests__/exposureHorizon.regression.test.ts
 */

import { runExistingRegimenPipeline } from "../runExistingRegimenPipeline";
import { computeExposure, finiteHistoryExposure } from "../steadyStateTwoCompartment";
import { resolveExposureHorizon, assessSteadyStateApproach } from "../exposureHorizon";
import { computeSafeInfusionDurationHours } from "../recommend/infusionSafety";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) { passed++; }
  else { failed++; console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
}
function near(a: number, b: number, rel: number) { return Math.abs(a - b) <= rel * Math.abs(b); }

const patient = { age: 35, weight_kg: 70, height_cm: 175, sex: "male", serum_creatinine_mg_dl: 0.83, dialysis_or_rrt: false };
const regimenSS = { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1.75, doses_given: 6, steady_state_confirmed: true };
const lvl = (v: number, t: number) => ({ value_mcg_ml: v, collection_time: `2026-09-16T${String(Math.floor(t)).padStart(2, "0")}:${String(Math.round((t % 1) * 60)).padStart(2, "0")}:00`, time_since_last_dose_hours: t });

type R = Record<string, any>;
function run(regimen: R, levels: R[]): R {
  const r = runExistingRegimenPipeline({ patient, regimen, levels }) as R;
  if (r.error_type) throw new Error(`pipeline error: ${r.message} ${JSON.stringify(r.field_errors)}`);
  return r;
}

// ── 0. Reference closed-form values (independent oracle constants) ───────────
const REF = { CL: 4.102381651824105, V1: 42.9, Q: 3.22, V2: 41.7 };
const ss = computeExposure({ ...REF, dose_mg: 1000, tau: 12, T_inf: 1.75 });
check("ss AUC24 = 487.521681243555", near(ss.auc24, 487.521681243555, 1e-9));
check("ss peak = 31.920450104043", near(ss.peak, 31.920450104043, 1e-9));
check("ss trough = 12.927927800297", near(ss.trough, 12.927927800297, 1e-9));
const six = finiteHistoryExposure({ ...REF, dose_mg: 1000, tau: 12, T_inf: 1.75 }, 6);
check("6-dose peak = 30.608889261698", near(six.peak, 30.608889261698, 1e-9), String(six.peak));
check("6-dose trough = 12.008178342517", near(six.trough, 12.008178342517, 1e-9), String(six.trough));
check("6-dose interval AUC < steady-state interval AUC", six.auc_interval_n < ss.auc24 / 2);

// ── 1. Horizon resolution ────────────────────────────────────────────────────
check("doses 1 → single_dose", resolveExposureHorizon({ doses_given: 1 }) === "single_dose");
check("confirmed → steady_state", resolveExposureHorizon({ doses_given: 6, steady_state_confirmed: true }) === "steady_state");
check("5 doses, confirmed=false → actual_history", resolveExposureHorizon({ doses_given: 5, steady_state_confirmed: false }) === "actual_history");
check("legacy: 5 doses, no flag → steady_state", resolveExposureHorizon({ doses_given: 5 }) === "steady_state");
check("legacy: 4 doses, no flag → actual_history", resolveExposureHorizon({ doses_given: 4 }) === "actual_history");
check("no history → steady_state", resolveExposureHorizon({}) === "steady_state");
const approach = assessSteadyStateApproach(6, 12, REF)!;
check("approach: 6×12h vs t½≈20h → <4 half-lives, not adequate", approach.half_lives_elapsed < 4 && !approach.adequate, JSON.stringify(approach));

// ── 2. §2 reproduction: 12.9 mg/L at 12 h, steady state confirmed ───────────
{
  const r = run(regimenSS, [lvl(12.9, 12)]);
  check("horizon reported = steady_state", r.exposure_horizon === "steady_state");
  check("top-level triple == steady_state_exposure", r.auc24 === r.steady_state_exposure.auc24 && Math.abs(r.peak - r.steady_state_exposure.peak) < 0.06 && Math.abs(r.trough - r.steady_state_exposure.trough) < 0.06);
  const rec = r.frequency_options.find((o: R) => o.dose_mg === 1000 && o.interval_hours === 12);
  check("recommended row exists for 1000 q12h", !!rec && rec.is_recommended);
  check("current row == recommended row (AUC)", rec.auc24 === r.auc24, `${rec.auc24} vs ${r.auc24}`);
  check("current row == recommended row (peak)", Math.abs(rec.peak - r.peak) <= 0.1, `${rec.peak} vs ${r.peak}`);
  check("current row == recommended row (trough)", Math.abs(rec.trough - r.trough) <= 0.1, `${rec.trough} vs ${r.trough}`);
  check("band predicted_* == recommended row", r.predicted_auc24 === rec.auc24 && r.predicted_peak === rec.peak && r.predicted_trough === rec.trough,
    `${r.predicted_auc24}/${r.predicted_peak}/${r.predicted_trough} vs ${rec.auc24}/${rec.peak}/${rec.trough}`);
  check("fit stays near prior: CL ≈ 4.1", near(r.pk_parameters.CL, 4.10, 0.01), String(r.pk_parameters.CL));
  check("AUC ≈ 486.9 (site)", Math.abs(r.auc24 - 486.9) <= 0.5, String(r.auc24));
  check("diagnostics: objective, convergence, prior/posterior exposed", r.posterior_fit.objective && r.posterior_fit.convergence && r.posterior_fit.prior && r.posterior_fit.posterior);
  check("diagnostics: horizon carried in fit", r.posterior_fit.horizon === "steady_state");
  check("diagnostics: no boundary hits", Array.isArray(r.posterior_fit.boundary_hits) && r.posterior_fit.boundary_hits.length === 0);
  check("steady-state approach warning present (92% of plateau)", typeof r.steady_state_warning === "string" && /92%/.test(r.steady_state_warning), r.steady_state_warning);
  check("no actual-history block under steady state", r.actual_history_exposure === undefined);
  // Every candidate row must equal the canonical function at ITS OWN infusion duration.
  for (const o of r.frequency_options) {
    const tinf = Math.min(computeSafeInfusionDurationHours(o.dose_mg).infusion_duration_hours, o.interval_hours);
    const e = computeExposure({ CL: r.pk_parameters.CL, V1: r.pk_parameters.V1, Q: r.pk_parameters.Q, V2: r.pk_parameters.V2, dose_mg: o.dose_mg, tau: o.interval_hours, T_inf: tinf });
    check(`candidate ${o.dose_mg} q${o.interval_hours}h == canonical steady state at T_inf ${tinf}`,
      Math.abs(e.auc24 - o.auc24) <= 0.05 && Math.abs(e.peak - o.peak) <= 0.05 && Math.abs(e.trough - o.trough) <= 0.05 && o.infusion_duration_hours === tinf,
      `${e.auc24.toFixed(2)}/${e.peak.toFixed(2)}/${e.trough.toFixed(2)} vs ${o.auc24}/${o.peak}/${o.trough}`);
  }
  check("result_snapshot absent at pipeline level (added by the route)", r.result_snapshot === undefined);
}

// ── 3. Actual-history horizon: same inputs, steady state NOT confirmed ───────
{
  const r = run({ ...regimenSS, steady_state_confirmed: false }, [lvl(12.9, 12)]);
  check("horizon = actual_history", r.exposure_horizon === "actual_history");
  check("fit used actual-history horizon", r.posterior_fit.horizon === "actual_history");
  check("top-level triple is the steady-state projection", r.auc24 === r.steady_state_exposure.auc24);
  check("actual_history_exposure present with dose 6", r.actual_history_exposure?.doses_given === 6);
  // Finite-dose values must be computed from the SAME parameters analytically.
  const p = r.pk_parameters;
  const f = finiteHistoryExposure({ CL: p.CL, V1: p.V1, Q: p.Q, V2: p.V2, dose_mg: 1000, tau: 12, T_inf: 1.75 }, 6);
  check("actual-history peak/trough analytic", Math.abs(f.peak - r.actual_history_exposure.peak) <= 0.01 && Math.abs(f.trough - r.actual_history_exposure.trough) <= 0.01);
  check("finite trough is never paired with ss AUC at top level", r.trough === r.steady_state_exposure.trough || Math.abs(r.trough - r.steady_state_exposure.trough) < 0.06);
  check("no steady-state warning in actual-history mode", r.steady_state_warning === undefined);
}

// ── 4. §4 regressions ────────────────────────────────────────────────────────
{
  const r = run(regimenSS, [lvl(25, 12)]);
  check("25@12h: CL ≈ 2.68849 (independent minimiser) within 0.5%", near(r.pk_parameters.CL, 2.68849, 0.005), String(r.pk_parameters.CL));
  check("25@12h: current AUC ≈ 743.4 (site) within 1", Math.abs(r.auc24 - 743.4) <= 1, String(r.auc24));
  const q18 = r.frequency_options.find((o: R) => o.interval_hours === 18);
  check("25@12h: q18h suggestion ≈ 495.6", !!q18 && Math.abs(q18.auc24 - 495.6) <= 1, q18 && String(q18.auc24));
  check("25@12h: recommendation is 1000 q18h", r.recommended_dose === "1000 mg" && r.recommended_interval_hours === 18);
}
{
  const r = run(regimenSS, [lvl(28, 3), lvl(12.9, 12)]);
  check("28@3+12.9@12: CL ≈ 4.08958 within 0.5%", near(r.pk_parameters.CL, 4.08958, 0.005), String(r.pk_parameters.CL));
  check("28@3+12.9@12: AUC ≈ 488.7 within 0.5", Math.abs(r.auc24 - 488.7) <= 0.5, String(r.auc24));
  const r2 = run(regimenSS, [lvl(12.9, 12), lvl(28, 3)]);
  check("ordering invariance (CL)", Math.abs(r.pk_parameters.CL - r2.pk_parameters.CL) < 1e-9);
  const r3 = run(regimenSS, [lvl(28, 3), lvl(12.9, 12)]);
  check("determinism (repeat run identical)", JSON.stringify(r.pk_parameters) === JSON.stringify(r3.pk_parameters));
}
{
  const r = run(regimenSS, [lvl(28, 3), lvl(12.9, 3)]);
  check("duplicate discordant samples → review_hold", r.review_hold?.reason === "discordant_duplicate_samples", JSON.stringify(r.review_hold));
  check("review hold: no recommended dose", r.recommended_dose === "" && r.recommended_interval_hours === 0);
  check("review hold: no candidate rows", Array.isArray(r.frequency_options) && r.frequency_options.length === 0);
  check("review hold: exposure of the current regimen still visible", typeof r.auc24 === "number" && r.auc24 > 0);
  check("review hold: conflict details carried", r.posterior_fit.observation_conflicts.length === 1);
}
{
  // Concordant replicates (within 20%) are NOT held.
  const r = run(regimenSS, [lvl(12.9, 12), lvl(13.5, 12)]);
  check("concordant replicates → no hold", r.review_hold === undefined);
}

// ── 5. Unsafe current exposure stays visible when unsafe candidates are excluded
{
  const r = run(regimenSS, [lvl(45, 12)]);
  check("high level: current ss exposure reported (AUC > 600)", r.auc24 > 600, String(r.auc24));
  check("high level: current exposure not hidden by candidate filtering", r.steady_state_exposure.auc24 === r.auc24);
}

console.log(`\nexposureHorizon regression: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
