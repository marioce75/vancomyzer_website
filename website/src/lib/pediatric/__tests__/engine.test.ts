/**
 * Behavioural tests for the pediatric research engine: validation, units,
 * boundaries, unsupported populations, prior/posterior distinctions,
 * forecast vs steady state, parameter recovery and numerical stability.
 *
 * Run: node --import tsx src/lib/pediatric/__tests__/engine.test.ts
 * Synthetic inputs only. Not clinical validation.
 */
import assert from "node:assert/strict";
import { runPediatricEngine, validatePediatricRequest, pediatricCurve, type PediatricRequest, type PediatricResult } from "../engine";
import { clinicalPostmenstrualAgeWeeks, individualParameters, postmenstrualAgeYears, typicalParameters } from "../colin2019/prior";
import { concentrationFromHistory } from "@/lib/pk/doseHistory";
import { makeRng, standardNormal, residualVariance, OMEGA_SD } from "../colin2019/fit";
import { COLIN_2019_DATASET_SUPPORT, COLIN_2019_NONMEM_FINAL, PEDIATRIC_SCOPE } from "../colin2019/manifest";

let n = 0;
const ok = (c: unknown, m: string) => { assert.ok(c, m); n++; };
const T0 = Date.UTC(2026, 9, 28, 8, 0, 0);
const iso = (h: number) => new Date(T0 + h * 3600000).toISOString();
const base = (over: Partial<PediatricRequest["patient"]> = {}, regimen = { dose_mg: 300, interval_hours: 6, infusion_minutes: 60 }): PediatricRequest => ({
  patient: { postnatal_age: { value: 6, unit: "years" }, weight: { value: 20, unit: "kg" }, serum_creatinine: { value: 0.4, unit: "mg/dL" }, ...over },
  regimen,
});
const refuse = (req: unknown, status: "invalid" | "unsupported", field: string) => {
  const r = runPediatricEngine(req);
  ok(r.status === status && field in r.field_errors, `${status} on ${field}: ${JSON.stringify(r.status === "ok" ? "ok" : r.field_errors)}`);
};
// Existing synthetic histories now supply an explicit planned time as part of their fixture.
// Missing-time regressions call runPediatricEngine directly, without this helper.
const withPlannedTime = (req: PediatricRequest): PediatricRequest => req.doses?.length && !req.regimen.next_dose_start
  ? { ...req, regimen: { ...req.regimen, next_dose_start: new Date(Math.max(...req.doses.map(d => Date.parse(d.start))) + req.regimen.interval_hours * 3600000).toISOString() } }
  : req;
const run = (req: PediatricRequest): PediatricResult => {
  const r = runPediatricEngine(withPlannedTime(req));
  assert.equal(r.status, "ok", JSON.stringify(r));
  return r as PediatricResult;
};

// ── Units and missing data ───────────────────────────────────────────────────
refuse({}, "invalid", "patient");
refuse({ patient: {}, regimen: {} }, "invalid", "patient.postnatal_age");
refuse(base({ postnatal_age: { value: 2, unit: "months" } }), "invalid", "patient.gestational_age_weeks"); // GA required < 1 y
refuse(base({ weight: { value: 20000, unit: "kg" } }), "invalid", "patient.weight");
refuse(base({ postnatal_age: { value: 10, unit: "days" }, gestational_age_weeks: 38, weight: { value: 3200, unit: "kg" } }), "invalid", "patient.weight"); // grams typed as kg
refuse(base({ serum_creatinine: { value: 0.4, unit: "mmol/L" as never } }), "invalid", "patient.serum_creatinine");
refuse(base({ serum_creatinine: { value: 0.4, unit: "umol/L" } }), "invalid", "patient.serum_creatinine"); // 0.4 umol/L is below range
refuse(base({}, { dose_mg: 15, interval_hours: 6, infusion_minutes: 5 }), "invalid", "regimen.infusion_minutes");
refuse(base({}, { dose_mg: 300, interval_hours: 6, infusion_minutes: 400 }), "invalid", "regimen.infusion_minutes");
refuse({ ...base(), levels: [{ time: iso(2), concentration_mg_l: 10 }] }, "invalid", "doses"); // levels need history
refuse({ ...base(), doses: [{ start: "2026-10-28 08:00", dose_mg: 300, infusion_minutes: 60 }] }, "invalid", "doses[0].start");
refuse({ ...base(), doses: [{ start: "2026-10-28T08:00:00", dose_mg: 300, infusion_minutes: 60 }] }, "invalid", "doses[0].start"); // no offset
refuse({ ...base(), doses: [{ start: iso(0), dose_mg: 300, infusion_minutes: 60 }, { start: iso(0.5), dose_mg: 300, infusion_minutes: 60 }] }, "invalid", "doses[1].start"); // overlap
refuse({ ...base(), doses: [{ start: iso(0), dose_mg: 300, infusion_minutes: 60 }], levels: [{ time: iso(-1), concentration_mg_l: 10 }] }, "invalid", "levels[0].time");
refuse({ ...base(), doses: [{ start: iso(0), dose_mg: 300, infusion_minutes: 60 }], levels: [{ time: iso(2), concentration_mg_l: 10 }, { time: iso(2), concentration_mg_l: 20 }] }, "invalid", "levels[1]");
// Units convert explicitly and equivalently.
{
  const a = run(base({ serum_creatinine: { value: 0.4, unit: "mg/dL" } }));
  const b = run(base({ serum_creatinine: { value: 0.4 * 88.4, unit: "umol/L" } }));
  ok(Math.abs(a.prior.parameters.CL - b.prior.parameters.CL) < 1e-9, "umol/L converts to mg/dL at 88.4");
  const c = run(base({ postnatal_age: { value: 10, unit: "days" }, gestational_age_weeks: 32, weight: { value: 1500, unit: "g" } }));
  const d = run(base({ postnatal_age: { value: 10, unit: "days" }, gestational_age_weeks: 32, weight: { value: 1.5, unit: "kg" } }));
  ok(Math.abs(c.prior.parameters.V1 - d.prior.parameters.V1) < 1e-9, "grams convert to kg");
  const e = run(base({ postnatal_age: { value: 72, unit: "months" } }));
  ok(Math.abs(e.derived.pma_years - a.derived.pma_years) < 1e-9, "72 months equals 6 years");
}

// ── Unsupported populations and boundaries ───────────────────────────────────
refuse(base({ renal_replacement_therapy: true }), "unsupported", "patient.renal_replacement_therapy");
refuse(base({ ecmo: true }), "unsupported", "patient.ecmo");
refuse(base({ route: "other" }), "unsupported", "patient.route");
refuse(base({ postnatal_age: { value: 18, unit: "years" } }), "unsupported", "patient.postnatal_age");
ok(run(base({ postnatal_age: { value: 17.999, unit: "years" }, weight: { value: 70, unit: "kg" } })).status === "ok", "17.999 years is accepted");
refuse(base({ postnatal_age: { value: 1, unit: "days" }, gestational_age_weeks: 22, weight: { value: 0.5, unit: "kg" } }), "unsupported", "patient.gestational_age_weeks"); // PMA 22.1 wk < 23.4
ok(run(base({ postnatal_age: { value: 10, unit: "days" }, gestational_age_weeks: 22, weight: { value: 0.5, unit: "kg" } })).derived.pma_weeks > 23.4, "PMA 23.43 wk accepted at the floor");
refuse(base({ postnatal_age: { value: 1, unit: "days" }, gestational_age_weeks: 21.9, weight: { value: 0.5, unit: "kg" } }), "invalid", "patient.gestational_age_weeks");
// dataset gap (PMA 0.88-2.58 y, open interval): always refused; no flag can override it
{
  const gap = COLIN_2019_DATASET_SUPPORT.pediatricPmaGapYears;
  refuse(base({ postnatal_age: { value: 12, unit: "months" }, gestational_age_weeks: 40, weight: { value: 9, unit: "kg" } }), "unsupported", "patient.postnatal_age");
  const withFlag = runPediatricEngine({ patient: { postnatal_age: { value: 12, unit: "months" }, gestational_age_weeks: 40, weight: { value: 9, unit: "kg" }, serum_creatinine: { value: 0.3, unit: "mg/dL" }, acknowledge_dataset_gap: true }, regimen: { dose_mg: 135, interval_hours: 6, infusion_minutes: 60 } });
  ok(withFlag.status === "unsupported" && "patient.postnatal_age" in withFlag.field_errors && /no acknowledgement can override/.test(withFlag.field_errors["patient.postnatal_age"]), "acknowledge_dataset_gap has no effect: still refused");
  const msg = withFlag.status === "unsupported" ? withFlag.field_errors["patient.postnatal_age"] : "";
  ok(msg.includes("Oudin") && msg.includes("van der Meer") && msg.includes(String(gap.from)) && msg.includes(String(gap.to)), "refusal names the boundary evidence");
  // Boundaries under the convention PMA = PNA/365.25 + GA/52 (term birth: gap = 40.5-661.4 postnatal days).
  const daysFrom = (gap.from - 40 / 52) * 365.25, daysTo = (gap.to - 40 / 52) * 365.25;
  ok(run(base({ postnatal_age: { value: Math.floor(daysFrom), unit: "days" }, gestational_age_weeks: 40, weight: { value: 4, unit: "kg" } })).status === "ok", "term infant at 40 days (PMA 0.8787) accepted");
  refuse(base({ postnatal_age: { value: Math.ceil(daysFrom), unit: "days" }, gestational_age_weeks: 40, weight: { value: 4, unit: "kg" } }), "unsupported", "patient.postnatal_age"); // 41 d → 0.8815
  refuse(base({ postnatal_age: { value: Math.floor(daysTo), unit: "days" }, gestational_age_weeks: 40, weight: { value: 12, unit: "kg" } }), "unsupported", "patient.postnatal_age"); // 661 d → 2.5789
  ok(run(base({ postnatal_age: { value: Math.ceil(daysTo), unit: "days" }, gestational_age_weeks: 40, weight: { value: 12, unit: "kg" } })).status === "ok", "term child at 662 days (PMA 2.5816) accepted");
  ok(run(base({ postnatal_age: { value: 150, unit: "days" }, gestational_age_weeks: 24, weight: { value: 3, unit: "kg" } })).derived.pma_years < gap.from, "GA 24 + 150 d (PMA 0.872) accepted: the gap depends on gestational age");
  refuse(base({ postnatal_age: { value: 160, unit: "days" }, gestational_age_weeks: 24, weight: { value: 3.2, unit: "kg" } }), "unsupported", "patient.postnatal_age");
  refuse(base({ postnatal_age: { value: 18, unit: "months" }, gestational_age_weeks: 40, weight: { value: 11, unit: "kg" } }), "unsupported", "patient.postnatal_age");
  ok(run(base({ postnatal_age: { value: 2, unit: "years" }, weight: { value: 12, unit: "kg" } })).status === "ok", "2.0 y (PMA 2.769) accepted");
  ok(run(base({ postnatal_age: { value: 662, unit: "days" }, gestational_age_weeks: 40, weight: { value: 12, unit: "kg" } })).limitations.some((l) => l.includes("does not establish clinical validation")), "limitations state that pooled inclusion is not clinical validation");
}
// weight extremes
ok(run(base({ postnatal_age: { value: 5, unit: "days" }, gestational_age_weeks: 24, weight: { value: 420, unit: "g" } })).prior.parameters.CL > 0, "0.42 kg computes");
refuse(base({ postnatal_age: { value: 5, unit: "days" }, gestational_age_weeks: 24, weight: { value: 190, unit: "g" } }), "invalid", "patient.weight"); // below the smallest documented survivor (212 g)
ok(run(base({ postnatal_age: { value: 5, unit: "days" }, gestational_age_weeks: 24, weight: { value: 390, unit: "g" } })).input_review.items.some((it) => it.category === "outside_model_population"), "0.39 kg computes but is reported as outside the model population");
ok(run(base({ postnatal_age: { value: 17, unit: "years" }, weight: { value: 160, unit: "kg" } })).prior.parameters.CL > 0, "160 kg adolescent computes");
refuse(base({ postnatal_age: { value: 17, unit: "years" }, weight: { value: 161, unit: "kg" } }), "invalid", "patient.weight");
// renal function monotonicity and creatinine extremes
{
  const cls = [0.2, 0.4, 0.8, 1.6, 3.2, 6.4, 10].map((s) => run(base({ serum_creatinine: { value: s, unit: "mg/dL" } })).prior.parameters.CL);
  ok(cls.every((c, i) => i === 0 || c < cls[i - 1]), "clearance falls monotonically with creatinine");
  ok(cls.every((c) => Number.isFinite(c) && c > 0), "finite positive clearance up to SCr 10");
  ok(run(base({ serum_creatinine: { value: 10, unit: "mg/dL" } })).warnings.some((w) => w.includes("outside the development data range")), "SCr 10 warned as outside dataset support");
  ok(run(base({ unstable_renal_function: true })).warnings.some((w) => w.includes("Unstable (deteriorating or recovering) renal function")), "unstable renal function warning");
}
// age boundaries and maturation monotonicity (same weight/creatinine)
{
  const pm = [24, 28, 32, 36, 40, 44, 52, 104].map((wk) => typicalParameters({ pmaYears: wk / 52, weightKg: 3, scrMgDl: 0.5 }).CL);
  ok(pm.every((c, i) => i === 0 || c > pm[i - 1]), "clearance rises monotonically with PMA across the neonatal/infant range");
  // Age convention: PMA_years = PNA_days/365.25 + GA/52 (AGE-CONVENTION.md)
  ok(Math.abs(postmenstrualAgeYears(40, 0) - 40 / 52) < 1e-12, "PMA of a term newborn at birth = 40/52 y");
  ok(Math.abs(postmenstrualAgeYears(40, 35 * 365.25) - COLIN_2019_NONMEM_FINAL.pmaReferenceYears) < 1e-12, "35 y + GA 40 reproduces PMA_R = 35 + 40/52 exactly");
  ok(Math.abs(clinicalPostmenstrualAgeWeeks(28, 84) - 40) < 1e-12 && Math.abs(postmenstrualAgeYears(28, 84) - 40 / 52) * 365.25 < 0.35, "28 wk + 84 d: clinical PMA 40.0 wk; model PMA within 0.35 days of 40/52 y");
  const six = run(base({ postnatal_age: { value: 6, unit: "years" } }));
  ok(Math.abs(six.derived.pma_years - (6 + 40 / 52)) < 1e-12, "6 years postnatal → PMA 6 + 40/52 (non-neonatal rule of the article)");
  ok(six.assumptions.some((a) => a.includes("365.25") && a.includes("/ 52")), "assumption states the convention");
  ok(Math.abs(run(base({ postnatal_age: { value: 10, unit: "days" }, gestational_age_weeks: 32, weight: { value: 1.5, unit: "kg" } })).derived.pma_weeks_clinical - (32 + 10 / 7)) < 1e-12, "clinical PMA weeks reported");
  const neo = run(base({ postnatal_age: { value: 2, unit: "days" }, gestational_age_weeks: 40, weight: { value: 3.4, unit: "kg" } }));
  ok(neo.warnings.some((w) => w.includes("72 hours")), "postnatal age < 72 h creatinine warning");
  const assumed = run(base({ postnatal_age: { value: 3, unit: "years" }, weight: { value: 14, unit: "kg" } }));
  ok(assumed.derived.gestational_age_assumed && assumed.assumptions.some((a) => a.includes("40 weeks assumed")), "GA assumption is stated");
}

// ── Prior-only vs posterior; forecast vs steady state ────────────────────────
const doses = (nDoses: number, dose = 300, tau = 6, minutes = 60) => Array.from({ length: nDoses }, (_, i) => ({ start: iso(i * tau), dose_mg: dose, infusion_minutes: minutes }));
{
  const p = run(base());
  ok(p.estimate_basis === "prior_only" && p.posterior === undefined && p.prior.exposure.forecast_auc24_next24h === null, "no history → prior only, no forecast");
  ok(Math.abs(p.prior.exposure.steady_state_auc24 - (300 * 4) / p.prior.parameters.CL) < 1e-9, "steady-state AUC24 = daily dose / CL");
  ok(p.sensitivity.clearance_ratio_fitted_to_article > 1.27 && p.sensitivity.clearance_ratio_fitted_to_article < 1.32, "sensitivity row present");
  ok(p.prior.exposure.steady_state_auc24_interval!.lower < p.prior.exposure.steady_state_auc24 && p.prior.exposure.steady_state_auc24_interval!.upper > p.prior.exposure.steady_state_auc24, "prior interval brackets the typical value");
  const h = run({ ...base(), doses: doses(3) });
  ok(h.estimate_basis === "prior_only" && typeof h.prior.exposure.forecast_auc24_next24h === "number", "history without levels → prior-only forecast");
  ok(h.prior.exposure.forecast_auc24_next24h! < h.prior.exposure.steady_state_auc24, "forecast after 3 doses is below steady state (accumulation incomplete)");
  const h12 = run({ ...base(), doses: doses(12) });
  ok(Math.abs(h12.prior.exposure.forecast_auc24_next24h! - h12.prior.exposure.steady_state_auc24) / h12.prior.exposure.steady_state_auc24 < 0.03, "forecast after 12 doses (72 h, ~7 half-lives) approaches steady state");
  ok(h12.candidate_regimens.length > 0 && h12.candidate_regimens.every((c) => c.infusion_minutes >= 60 && c.infusion_minutes / 60 <= c.interval_hours), "candidate regimens respect infusion limits");
  const curve = pediatricCurve(h12, withPlannedTime({ ...base(), doses: doses(12) }));
  ok(curve.length > 100 && curve.every((pt) => pt.prior >= 0), "curve points available");
}

// ── Parameter recovery from simulated levels (1 and 2 levels) ────────────────
function simulateLevels(req: PediatricRequest, eta: { CL: number; V1: number; V2: number }, timesH: number[], seed: number, noise = true) {
  const v = validatePediatricRequest(withPlannedTime(req));
  assert.ok(v.ok);
  const val = v.value;
  const cov = { pmaYears: postmenstrualAgeYears(val.gestationalWeeks, val.postnatalDays), weightKg: val.weightKg, scrMgDl: val.scrMgDl };
  const p = individualParameters(cov, eta);
  const t0 = val.doses[0].startMs;
  const schedule = val.doses.map((d) => ({ time: (d.startMs - t0) / 3600000, dose_mg: d.dose_mg, T_inf: d.infusion_minutes / 60 }));
  const rng = makeRng(seed);
  return { p, levels: timesH.map((t) => { const f = concentrationFromHistory(p, schedule, t); const y = noise ? f + Math.sqrt(residualVariance(f)) * standardNormal(rng) : f; return { time: new Date(t0 + t * 3600000).toISOString(), concentration_mg_l: Math.max(0.1, Math.round(y * 10) / 10) }; }) };
}
{
  const req = { ...base(), doses: doses(6) };
  const truth = { CL: -0.45, V1: 0.2, V2: 0.3 };
  const two = simulateLevels(req, truth, [31.5, 35.8], 7, false); // exact levels: posterior must move toward truth
  const r2 = run({ ...req, levels: two.levels });
  ok(r2.estimate_basis === "posterior_two_level", "two levels → two-level posterior");
  ok(Math.abs(r2.posterior!.parameters.CL - two.p.CL) / two.p.CL < 0.15, `two exact levels recover CL within 15% (MAP shrinkage toward the prior is expected) (${r2.posterior!.parameters.CL} vs ${two.p.CL})`);
  ok(Math.abs(r2.posterior!.parameters.CL - two.p.CL) < Math.abs(r2.prior.parameters.CL - two.p.CL), "posterior CL closer to truth than prior");
  ok(r2.posterior!.exposure.steady_state_auc24_interval!.lower <= r2.posterior!.exposure.steady_state_auc24 && r2.posterior!.exposure.steady_state_auc24_interval!.upper >= r2.posterior!.exposure.steady_state_auc24, "posterior interval brackets the MAP AUC");
  ok(r2.posterior!.fit.posterior_sampling!.method === "importance_sampling_mixture" && r2.posterior!.fit.posterior_sampling!.effective_sample_size > 200, `intervals from importance sampling with adequate ESS (${r2.posterior!.fit.posterior_sampling!.effective_sample_size.toFixed(0)})`);
  ok(r2.posterior!.exposure.steady_state_auc24_interval!.median > r2.posterior!.exposure.steady_state_auc24 * 0.98, "posterior median AUC is not below the MAP value by more than 2% (mode < median for a right-skewed AUC posterior)");
  ok(r2.posterior!.fit.eta_sd !== null && r2.posterior!.fit.eta_sd!.CL < 0.27, "Laplace η SD still reported as a diagnostic");
  ok(r2.posterior!.exposure.steady_state_auc24_interval!.upper - r2.posterior!.exposure.steady_state_auc24_interval!.lower < r2.prior.exposure.steady_state_auc24_interval!.upper - r2.prior.exposure.steady_state_auc24_interval!.lower, "two levels narrow the AUC interval versus the prior");
  const one = simulateLevels(req, truth, [35.8], 7, false);
  const r1 = run({ ...req, levels: one.levels });
  ok(r1.estimate_basis === "posterior_one_level" && r1.warnings.some((w) => w.includes("One level")), "one level → one-level posterior with identifiability warning");
  ok(Math.abs(r1.posterior!.parameters.CL - one.p.CL) < Math.abs(r1.prior.parameters.CL - one.p.CL), "one level still moves CL toward truth");
  const r3 = run({ ...req, levels: [...two.levels, { time: iso(30.5), concentration_mg_l: 25 }] });
  ok(r3.estimate_basis === "posterior_multi_level", "three levels → multi-level posterior");
  // Determinism
  const again = run({ ...req, levels: two.levels });
  ok(JSON.stringify(again.posterior!.exposure) === JSON.stringify(r2.posterior!.exposure), "identical inputs give identical intervals");
}
// Neonate one-level fit with explicit GA/PNA and irregular dose times
{
  const req: PediatricRequest = { patient: { postnatal_age: { value: 20, unit: "days" }, gestational_age_weeks: 30, weight: { value: 1200, unit: "g" }, serum_creatinine: { value: 1.1, unit: "mg/dL" } }, regimen: { dose_mg: 18, interval_hours: 18, infusion_minutes: 60 }, doses: [{ start: iso(0), dose_mg: 18, infusion_minutes: 60 }, { start: iso(18.5), dose_mg: 18, infusion_minutes: 60 }, { start: iso(36), dose_mg: 18, infusion_minutes: 75 }] };
  const sim = simulateLevels(req, { CL: 0.3, V1: -0.1, V2: 0 }, [53.5], 11, false);
  const r = run({ ...req, levels: sim.levels });
  ok(r.estimate_basis === "posterior_one_level" && Math.abs(r.posterior!.parameters.CL - sim.p.CL) < Math.abs(r.prior.parameters.CL - sim.p.CL), "neonate one-level fit moves toward truth");
  ok(r.timeline!.last_dose_start_hours === 36 && r.timeline!.next_planned_dose_hours === 54, "timeline from actual dose times");
}
// Inconsistent level is flagged, not silently absorbed
{
  const req = { ...base(), doses: doses(6), levels: [{ time: iso(35.8), concentration_mg_l: 150 }] };
  const r = runPediatricEngine(withPlannedTime(req));
  ok(r.status === "ok" && (r.warnings.some((w) => w.includes("population SDs")) || r.warnings.some((w) => w.includes("η estimate exceeds")) || r.warnings.some((w) => w.includes("residual SDs")) || r.estimate_basis === "prior_only"), "implausible level → warning or fallback to prior");
}

// ── Numerical stability at extremes ──────────────────────────────────────────
for (const req of [
  base({ postnatal_age: { value: 1, unit: "days" }, gestational_age_weeks: 23.5, weight: { value: 400, unit: "g" }, serum_creatinine: { value: 10, unit: "mg/dL" } }, { dose_mg: 4, interval_hours: 48, infusion_minutes: 60 }),
  base({ postnatal_age: { value: 17.99, unit: "years" }, weight: { value: 160, unit: "kg" }, serum_creatinine: { value: 0.1, unit: "mg/dL" } }, { dose_mg: 4000, interval_hours: 4, infusion_minutes: 240 }),
  base({ postnatal_age: { value: 1, unit: "days" }, gestational_age_weeks: 44, weight: { value: 6, unit: "kg" }, serum_creatinine: { value: 0.1, unit: "mg/dL" } }, { dose_mg: 1, interval_hours: 4, infusion_minutes: 240 }),
]) {
  const r = run({ ...req, inputs_verified: true }); // extremes are deliberately unusual for age; verification is asserted elsewhere
  const nums = [r.prior.parameters.CL, r.prior.parameters.V1, r.prior.exposure.steady_state_auc24, r.prior.exposure.steady_state_peak, r.prior.exposure.steady_state_trough, r.prior.exposure.terminal_half_life_hours];
  ok(nums.every((x) => Number.isFinite(x) && x >= 0), `finite results at extremes: ${nums.map((x) => x.toPrecision(3)).join(", ")}`);
}
{
  const omegaCl = OMEGA_SD.CL;
  ok(Math.abs(omegaCl - Math.sqrt(0.074619)) < 1e-12 && PEDIATRIC_SCOPE.targetAuc24.low === 400 && PEDIATRIC_SCOPE.targetAuc24.high === 600, "published ω and target constants");
}
console.log(`${n} engine behaviour checks passed (validation, units, boundaries, unsupported populations, prior/posterior, forecast vs steady state, recovery, stability).`);
