/**
 * Credible band on the concentration-time curve (posterior/parameterUncertainty.ts).
 *
 * 1. The band brackets the plotted curve and is deterministic.
 * 2. It agrees with an independent brute-force posterior: 60,000 prior draws
 *    weighted by the likelihood the MAP objective uses. Edges must match within
 *    8% (Monte Carlo error of a 400-draw band is ~2-4%).
 * 3. Levels narrow it: a fitted band is narrower than the prior-only band.
 * 4. No band (with a reason) when the posterior cannot be trusted.
 * 5. Draws never reach the client payload.
 */
import assert from "node:assert/strict";
import { runExistingRegimenPipeline } from "../runExistingRegimenPipeline";
import { computeInitialRegimen } from "../../initialRegimen";
import { buildPriorParameters } from "../posterior/buildPriorParameters";
import { normalizeObservations } from "../posterior/normalizeObservations";
import { objectiveComponents, PRIOR_LOG_CL_SD, PRIOR_LOG_V1_SD, PRIOR_LOG_Q_SD, PRIOR_LOG_V2_SD } from "../posterior/fitPosteriorParameters";
import { singleDoseConcentration } from "../steadyStateTwoCompartment";
import { normalizePatient } from "../normalize/normalizePatient";
import { normalizeRegimen } from "../normalize/normalizeRegimen";
import { normalizeLevels } from "../normalize/normalizeLevels";

type Pt = { time_hours: number; concentration: number; lower?: number; upper?: number };
let passed = 0;

const articleCase = {
  patient: { age: 60, weight_kg: 80, height_cm: 175, sex: "male", serum_creatinine_mg_dl: 1.0 },
  regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 2, doses_given: 5, steady_state_confirmed: false },
  levels: [{ value_mcg_ml: 12, collection_time: "", time_since_last_dose_hours: 11.5 }],
};

// 1. brackets + deterministic
{
  const a = runExistingRegimenPipeline(articleCase) as Record<string, unknown>;
  const b = runExistingRegimenPipeline(articleCase) as Record<string, unknown>;
  const curve = a.curve as Pt[];
  assert.ok(curve.length > 10);
  for (const p of curve) {
    assert.ok(Number.isFinite(p.lower) && Number.isFinite(p.upper), `band missing at t=${p.time_hours}`);
    assert.ok(p.lower! <= p.concentration + 0.05 && p.concentration <= p.upper! + 0.05, `curve outside band at t=${p.time_hours}`);
  }
  assert.deepEqual(a.curve, b.curve, "band must be deterministic");
  const pu = a.parameter_uncertainty as Record<string, unknown>;
  assert.equal(pu.method, "posterior_sir");
  assert.ok(!("draws" in pu), "draws must not be serialized");
  for (const opt of a.frequency_options as { curve: Pt[] }[]) {
    assert.ok(opt.curve.every((p) => Number.isFinite(p.lower)), "every option curve carries the band");
  }
  passed++;
}

// 2. agreement with brute-force importance sampling from the prior
function bruteForce(inp: typeof articleCase, times: number[]) {
  const patient = normalizePatient(inp.patient), regimen = normalizeRegimen(inp.regimen), levels = normalizeLevels(inp.levels);
  const prior = buildPriorParameters(patient, regimen);
  const { observations, context } = normalizeObservations(levels, regimen);
  const fitInput = { priorCL: prior.CL, priorV1: prior.V1, priorQ: prior.Q, priorV2: prior.V2, dose_mg: regimen.dose_mg, tau: context.tau, T_inf: context.T_inf, observations, doses_given: context.doses_given, horizon: context.horizon };
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed + 0.5) / 2147483648; };
  const nrm = () => Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
  const sds = [PRIOR_LOG_CL_SD, PRIOR_LOG_V1_SD, PRIOR_LOG_Q_SD, PRIOR_LOG_V2_SD];
  const S: { p: { CL: number; V1: number; Q: number; V2: number }; lw: number }[] = [];
  for (let i = 0; i < 60000; i++) {
    const p = { CL: prior.CL * Math.exp(sds[0] * nrm()), V1: prior.V1 * Math.exp(sds[1] * nrm()), Q: prior.Q * Math.exp(sds[2] * nrm()), V2: prior.V2 * Math.exp(sds[3] * nrm()) };
    S.push({ p, lw: -objectiveComponents(p.CL, p.V1, p.Q, p.V2, fitInput).nll_observations });
  }
  const m = Math.max(...S.map((s) => s.lw));
  const w = S.map((s) => Math.exp(s.lw - m));
  const W = w.reduce((a, b) => a + b, 0);
  const { interval_hours: tau, infusion_duration_hours: T_inf, dose_mg } = regimen;
  return times.map((t) => {
    const vals = S.map((s, i) => {
      let c = 0;
      for (let k = 0; k * tau <= t; k++) c += singleDoseConcentration({ ...s.p, dose_mg, tau, T_inf }, t - k * tau);
      return { c, w: w[i] };
    }).sort((a, b) => a.c - b.c);
    const q = (x: number) => { let acc = 0; for (const v of vals) { acc += v.w; if (acc >= x * W) return v.c; } return NaN; };
    return { lower: q(0.05), upper: q(0.95) };
  });
}
{
  const r = runExistingRegimenPipeline(articleCase) as Record<string, unknown>;
  const curve = r.curve as Pt[];
  const picks = [curve[Math.floor(curve.length * 0.2)], curve[Math.floor(curve.length * 0.6)], curve[curve.length - 1]];
  const exact = bruteForce(articleCase, picks.map((p) => p.time_hours));
  picks.forEach((p, i) => {
    for (const edge of ["lower", "upper"] as const) {
      const rel = Math.abs(p[edge]! - exact[i][edge]) / exact[i][edge];
      assert.ok(rel < 0.08, `t=${p.time_hours} ${edge}: band ${p[edge]} vs brute-force ${exact[i][edge].toFixed(2)} (${(rel * 100).toFixed(1)}%)`);
    }
  });
  passed++;
}

// 3. a level narrows the band relative to the population prior
{
  const fitted = runExistingRegimenPipeline(articleCase) as Record<string, unknown>;
  const priorOnly = runExistingRegimenPipeline({ ...articleCase, levels: [] }) as Record<string, unknown>;
  if ((priorOnly as { ok?: boolean }).ok !== false) {
    assert.equal((priorOnly.parameter_uncertainty as { method: string }).method, "population_prior");
  }
  const empiric = computeInitialRegimen({ age: 60, weight_kg: 80, height_cm: 175, sex: "male", serum_creatinine_mg_dl: 1.0 } as never);
  assert.equal((empiric.parameter_uncertainty as { method: string }).method, "population_prior");
  const width = (c: Pt[]) => { const p = c[c.length - 1]; return (p.upper! - p.lower!) / p.concentration; };
  assert.ok(empiric.curve.every((p) => Number.isFinite(p.lower)), "empiric curve carries the prior band");
  assert.ok(width(fitted.curve as Pt[]) < width(empiric.curve as Pt[]), "fitted band narrower than prior band");
  passed++;
}

// 4. An implausible level (1.0 mg/L trough at SCr 2.5) that no parameter set
//    explains well → no band, with a reason, rather than a misleading one.
{
  const r = runExistingRegimenPipeline({
    patient: { age: 65, weight_kg: 80, height_cm: 175, sex: "male", serum_creatinine_mg_dl: 2.5 },
    regimen: { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1, doses_given: 6, steady_state_confirmed: true },
    levels: [{ value_mcg_ml: 1.0, collection_time: "", time_since_last_dose_hours: 11.5 }],
  }) as Record<string, unknown>;
  const pu = r.parameter_uncertainty as { method: string; reason?: string };
  assert.equal(pu.method, "unavailable");
  assert.ok(pu.reason && pu.reason.length > 10);
  assert.ok((r.curve as Pt[]).every((p) => p.lower === undefined), "no band when unavailable");
  passed++;
}

console.log(`Credible band: ${passed} passed, 0 failed`);
