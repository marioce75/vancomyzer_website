/**
 * Replays docs/pediatric/reference-cases.json (independent Python/RK4 reference,
 * scripts/pediatric/reference-cases.py) against the TypeScript pediatric engine.
 *
 * Run: node --import tsx src/lib/pediatric/__tests__/reference.test.ts
 *
 * Tolerances: typical parameters 1e-9 relative (both sides analytic);
 * ODE vs analytic concentrations 2e-5 relative (RK4 at dt 0.002 h);
 * MAP objective at fixed η 2e-5 relative (RK4 at dt 0.01 h inside the
 * reference objective); MAP optimum η within 2e-3 absolute (two independent
 * Nelder-Mead optimisers on a flat objective) and the parameters within 3e-3.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aucFromHistory, concentrationFromHistory } from "@/lib/pk/doseHistory";
import { fitEta, objectiveAt } from "../colin2019/fit";
import { clinicalPostmenstrualAgeWeeks, individualParameters, postmenstrualAgeYears, typicalParameters } from "../colin2019/prior";
import { COLIN_2019_ARTICLE_TABLE3, COLIN_2019_DATASET_SUPPORT, COLIN_2019_NONMEM_FINAL } from "../colin2019/manifest";
import { runPediatricEngine } from "../engine";

const ref = JSON.parse(readFileSync("docs/pediatric/reference-cases.json", "utf8"));
let checks = 0;
const close = (a: number, b: number, rel: number, what: string) => {
  const err = Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);
  assert.ok(err <= rel, `${what}: ${a} vs ${b} (rel ${err.toExponential(2)} > ${rel})`);
  checks++;
};

// A. typical parameters, both formulations
for (const c of ref.typical) {
  const cov = { pmaYears: c.pma_years, weightKg: c.weight_kg, scrMgDl: c.scr_mg_dl };
  const f = typicalParameters(cov, "fitted_nonmem");
  const a = typicalParameters(cov, "article_transcription");
  for (const k of ["CL", "V1", "Q", "V2"] as const) {
    close(f[k], c.fitted[k], 1e-9, `${c.label} fitted ${k}`);
    close(a[k], c.article[k], 1e-9, `${c.label} article ${k}`);
  }
  close(f.factors.scrStd, c.scr_std_fitted, 1e-9, `${c.label} SCRstd`);
  if (c.published_article_value !== null) {
    // The article's own numbers reproduce only under the transcription, never under the fitted model.
    assert.ok(Math.abs(a.CL - c.published_article_value) / c.published_article_value < 0.005, `${c.label}: article value should reproduce under the transcription`);
    assert.ok(Math.abs(f.CL - c.published_article_value) / c.published_article_value > 0.2, `${c.label}: fitted model must differ from the published article value`);
    checks += 2;
  }
  // Constant clearance ratio between formulations up to coefficient rounding.
  const ratio = f.CL / a.CL;
  assert.ok(ratio > 1.27 && ratio < 1.32, `${c.label}: CL ratio ${ratio}`);
  checks++;
}
// Reference individual: fitted clearance equals e^θ1 (normalisation cancels at PMA_R, SCR = 0.83 ≈ SCRstd).
{
  const r = typicalParameters({ pmaYears: COLIN_2019_NONMEM_FINAL.pmaReferenceYears, weightKg: 70, scrMgDl: 0.83 });
  const expected = Math.exp(COLIN_2019_NONMEM_FINAL.theta.lnCLref) * Math.exp(-Math.exp(COLIN_2019_NONMEM_FINAL.theta.lnEXPO2) * (0.83 - r.factors.scrStd));
  close(r.CL, expected, 1e-12, "reference individual CL = e^θ1 · Fscr");
  close(r.V1, Math.exp(COLIN_2019_NONMEM_FINAL.theta.lnV1), 1e-12, "reference V1");
  const art = typicalParameters({ pmaYears: COLIN_2019_NONMEM_FINAL.pmaReferenceYears, weightKg: 70, scrMgDl: 0.83 }, "article_transcription");
  assert.ok(Math.abs(art.CL - 4.10) < 0.01 && Math.abs(r.CL - 5.30) < 0.01, "4.10 (article) vs 5.30 (fitted) at the reference individual");
  checks++;
  // Table 3 is exp() of the printed 3-significant-digit estimates of the same run.
  assert.equal(Math.round(Math.exp(1.67) * 100) / 100, COLIN_2019_ARTICLE_TABLE3.thetaCL);
  assert.equal(Math.round(Math.exp(4.12) * 10) / 10, COLIN_2019_ARTICLE_TABLE3.age50Years);
  assert.equal(Math.round(Math.exp(-0.113) * 52 * 10) / 10, COLIN_2019_ARTICLE_TABLE3.pma50Weeks);
  checks += 3;
}
// η coupling and study effects
for (const c of ref.eta_and_study_effects) {
  const p = individualParameters({ pmaYears: c.pma_years, weightKg: c.weight_kg, scrMgDl: c.scr_mg_dl, heelPrick: c.heel, haematologicalMalignancy: c.cancer }, { CL: c.eta[0], V1: c.eta[1], V2: c.eta[2] });
  for (const k of ["CL", "V1", "Q", "V2"] as const) close(p[k], c.fitted[k], 1e-9, `eta/study ${k}`);
}
// B. ODE profiles vs analytic superposition
for (const c of ref.ode_profiles) {
  const p = typicalParameters({ pmaYears: c.pma_years, weightKg: c.weight_kg, scrMgDl: c.scr_mg_dl });
  for (const k of ["CL", "V1", "Q", "V2"] as const) close(p[k], c.parameters[k], 1e-9, `${c.label} ${k}`);
  const schedule = c.schedule.map((s: { start_h: number; dose_mg: number; duration_h: number }) => ({ time: s.start_h, dose_mg: s.dose_mg, T_inf: s.duration_h }));
  for (const pt of c.points) {
    close(concentrationFromHistory(p, schedule, pt.time_h), pt.concentration, 2e-5, `${c.label} C(${pt.time_h})`);
    close(aucFromHistory(p, schedule, 0, pt.time_h), pt.cumulative_auc, 2e-5, `${c.label} AUC(0-${pt.time_h})`);
  }
}
// C. MAP objective and optimum
for (const c of ref.map_fits) {
  const input = {
    covariates: { pmaYears: c.pma_years, weightKg: c.weight_kg, scrMgDl: c.scr_mg_dl },
    formulation: "fitted_nonmem" as const,
    schedule: c.schedule.map((s: { start_h: number; dose_mg: number; duration_h: number }) => ({ time: s.start_h, dose_mg: s.dose_mg, T_inf: s.duration_h })),
    observations: c.observations.map((o: { time_h: number; concentration: number }) => ({ timeHours: o.time_h, concentration: o.concentration })),
  };
  for (const o of c.objective_at_eta) close(objectiveAt(o.eta, input).total, o.objective, 2e-5, `${c.label} objective at ${o.eta}`);
  const fit = fitEta(input);
  assert.ok(fit.success && fit.converged, `${c.label} fit converged`);
  assert.ok(fit.objective <= c.map_objective + 1e-6, `${c.label}: TS optimum ${fit.objective} must not be worse than reference ${c.map_objective}`);
  (["CL", "V1", "V2"] as const).forEach((k, i) => assert.ok(Math.abs(fit.eta[k] - (c.map_eta[i] as number)) < 2e-3, `${c.label} η_${k} ${fit.eta[k]} vs ${c.map_eta[i]}`));
  for (const k of ["CL", "V1", "Q", "V2"] as const) close(fit.parameters[k], c.map_parameters[k], 3e-3, `${c.label} MAP ${k}`);
  checks += 2 + 3;
}
// D. age convention and dataset boundaries (independent expected outcomes)
{
  const ac = ref.age_convention;
  assert.equal(ac.convention, "PMA_years = postnatal_days/365.25 + gestational_weeks/52");
  assert.ok(ac.reference_reproduced === true);
  assert.deepEqual(ac.gap_open_interval_years, [COLIN_2019_DATASET_SUPPORT.pediatricPmaGapYears.from, COLIN_2019_DATASET_SUPPORT.pediatricPmaGapYears.to]);
  assert.ok(ac.max_abs_deviation_days_neonatal_range.clinical_over_52 < 0.35 && ac.max_abs_deviation_days_neonatal_range.control_stream_identity < 1.0 && ac.max_abs_deviation_days_to_18y.control_stream_identity < 6, `author-variant deviations ${JSON.stringify(ac.max_abs_deviation_days_neonatal_range)} ${JSON.stringify(ac.max_abs_deviation_days_to_18y)}`);
  checks += 4;
  for (const c of ac.cases) {
    close(postmenstrualAgeYears(c.gestational_age_weeks, c.postnatal_days), c.pma_years, 1e-12, `${c.label} PMA`);
    close(clinicalPostmenstrualAgeWeeks(c.gestational_age_weeks, c.postnatal_days), c.pma_weeks_clinical, 1e-12, `${c.label} clinical PMA`);
    const out = runPediatricEngine({ patient: { postnatal_age: { value: c.postnatal_days, unit: "days" }, gestational_age_weeks: c.gestational_age_weeks, weight: { value: c.weight_kg, unit: "kg" }, serum_creatinine: { value: c.scr_mg_dl, unit: "mg/dL" } }, regimen: { dose_mg: Math.max(1, Math.round(15 * c.weight_kg)), interval_hours: 8, infusion_minutes: 60 } });
    assert.equal(out.status, c.expected_status, `${c.label}: ${JSON.stringify(out.status === "ok" ? "ok" : out.field_errors)}`);
    checks++;
    if (out.status === "ok") {
      close(out.derived.pma_years, c.pma_years, 1e-12, `${c.label} engine PMA`);
      close(out.derived.pma_weeks_clinical, c.pma_weeks_clinical, 1e-12, `${c.label} engine clinical PMA`);
      for (const k of ["CL", "V1", "Q", "V2"] as const) close(out.prior.parameters[k], c.fitted[k], 1e-9, `${c.label} ${k}`);
    } else {
      assert.ok(c.expected_field in out.field_errors, `${c.label}: expected field ${c.expected_field}, got ${Object.keys(out.field_errors)}`);
      checks++;
    }
  }
}
console.log(`${checks} reference checks passed against the independent Python/RK4 fixtures (${ref.typical.length} typical, ${ref.ode_profiles.length} profiles, ${ref.map_fits.length} fits, ${ref.age_convention.cases.length} age/boundary cases).`);
