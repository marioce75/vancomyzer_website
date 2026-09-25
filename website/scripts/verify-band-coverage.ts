/**
 * Simulation–estimation check of the concentration-time credible band.
 *
 * Strictly synthetic: no patient data. Virtual patients are drawn with the
 * synthetic ICU covariate generator (validation/predictive), each is given a
 * TRUE parameter set, levels are simulated from that truth with assay error,
 * and the patient is run through the calculator exactly as a clinician would.
 * Coverage = how often the TRUE concentration lies inside the plotted 90% band.
 *
 * Two truth scenarios:
 *   app        Truth drawn from the calculator's own assumptions (prior SDs
 *              0.35/0.25/0.50/0.50 in log space; error SD max(1 mg/L, 15%)).
 *              Tests the machinery: coverage should be ~90% if the band is
 *              computed correctly.
 *   published  Truth drawn with Colin 2019 published variability (CV 27.9% CL,
 *              27.3% V1, 97.9% V2, no IIV on Q; proportional residual error
 *              21.5%). The calculator still uses its own assumptions, so this
 *              is a stress test of how much the app's choices matter when the
 *              population differs. Published IIV correlations are not modelled.
 *   published_iiv    Published variability, the calculator's own error model.
 *   published_error  The calculator's own variability, published 21.5% error.
 *              (These two split the published scenario into its two causes.)
 *
 * Three designs:
 *   empiric       No levels (empiric path, population-prior band).
 *   one_level     One level 11.5 h after the start of dose 5, q12h, steady
 *                 state not confirmed (the tl;dr article's worked example).
 *   peak_trough   Peak (1 h after the end of infusion) and trough (11.5 h) in
 *                 the same interval at true steady state, steady state confirmed.
 *   loading_dose  25 mg/kg loading dose (max 3,000 mg) as dose 1, then the
 *                 maintenance dose q12h; one level 11.5 h after dose 3, with
 *                 the loading dose entered (pk/doseHistory.ts).
 *
 * Coverage is pointwise and pooled across every plotted time point (t > 0), and
 * also reported at the last plotted trough and peak. It says nothing about how
 * well Colin 2019 describes real patients — only the validation study can.
 *
 * Usage:
 *   node --import tsx scripts/verify-band-coverage.ts --scenario app --design one_level --n 300
 *   node --import tsx scripts/verify-band-coverage.ts --report
 * Results: src/lib/validation/bandCoverage/band-coverage-results.json (read by
 * /transparent-dosing/software-checks). Re-run every cell after an engine change.
 */
import fs from "node:fs";
import path from "node:path";
import { makeRng } from "../src/lib/validation/predictive/rng";
import { sampleSyntheticIcuPatient } from "../src/lib/validation/predictive/syntheticIcuPopulation";
import { runExistingRegimenPipeline } from "../src/lib/pk/runExistingRegimenPipeline";
import { computeInitialRegimen } from "../src/lib/initialRegimen";
import { buildPriorParameters } from "../src/lib/pk/posterior/buildPriorParameters";
import { normalizePatient } from "../src/lib/pk/normalize/normalizePatient";
import { singleDoseConcentration, type TwoCompartmentParameters } from "../src/lib/pk/steadyStateTwoCompartment";
import { PRIOR_LOG_CL_SD, PRIOR_LOG_V1_SD, PRIOR_LOG_Q_SD, PRIOR_LOG_V2_SD } from "../src/lib/pk/posterior/fitPosteriorParameters";
import { COLIN_2019, MODEL_MANIFEST_VERSION } from "../src/lib/pk/modelRegistry";

type Scenario = "app" | "published" | "published_iiv" | "published_error";
type Design = "empiric" | "one_level" | "peak_trough" | "loading_dose";
type Pt = { time_hours: number; concentration: number; lower?: number; upper?: number };

const RESULTS_FILE = path.join(process.cwd(), "src", "lib", "validation", "bandCoverage", "band-coverage-results.json");
const TAU = 12;
const SEED_BASE = 20260924;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const cvToLogSd = (cv: number) => Math.sqrt(Math.log(1 + cv * cv));

function truthSds(scenario: Scenario) {
  if (scenario === "app" || scenario === "published_error") return { CL: PRIOR_LOG_CL_SD, V1: PRIOR_LOG_V1_SD, Q: PRIOR_LOG_Q_SD, V2: PRIOR_LOG_V2_SD };
  const pv = (COLIN_2019 as unknown as { publishedVariability: { iivCvCL: number; iivCvV1: number; iivCvV2: number } }).publishedVariability;
  return { CL: cvToLogSd(pv.iivCvCL), V1: cvToLogSd(pv.iivCvV1), Q: 0, V2: cvToLogSd(pv.iivCvV2) };
}

function observe(c: number, scenario: Scenario, z: number): number {
  const appError = scenario === "app" || scenario === "published_iiv";
  const obs = appError ? c + Math.max(1, 0.15 * c) * z : c * (1 + 0.215 * z);
  return Math.round(Math.max(0.5, obs) * 10) / 10;
}

/** True concentration at time t for dose_mg every tau from t = 0 (the plotted curve's schedule). */
function trueConc(p: TwoCompartmentParameters, dose_mg: number, tau: number, T_inf: number, t: number, maxDoses = Infinity): number {
  let c = 0;
  for (let k = 0; k < maxDoses && k * tau <= t; k++) c += singleDoseConcentration({ ...p, dose_mg, tau, T_inf }, t - k * tau);
  return c;
}

/** True concentration on the plotted schedule: dose 1 (loading dose if any) at t = 0, then every tau. */
function truthAt(p: TwoCompartmentParameters, sc: { dose: number; tau: number; T_inf: number; load?: { dose: number; T_inf: number } }, t: number): number {
  let c = 0;
  for (let k = 0; k * sc.tau <= t; k++) {
    const first = k === 0 && sc.load;
    c += singleDoseConcentration({ ...p, dose_mg: first ? sc.load!.dose : sc.dose, tau: sc.tau, T_inf: first ? sc.load!.T_inf : sc.T_inf }, t - k * sc.tau);
  }
  return c;
}

function empiricDose(weight: number) {
  const dose = Math.min(2000, Math.max(750, Math.round((15 * weight) / 250) * 250));
  const T_inf = dose <= 1000 ? 1 : dose <= 1500 ? 1.5 : 2;
  return { dose, T_inf };
}

interface CellResult {
  scenario: Scenario; design: Design; n_patients: number; n_band: number; n_unavailable: number; n_rejected: number;
  pooled_coverage: number; pooled_coverage_se: number; pooled_below: number; pooled_above: number; n_points: number;
  last_trough_coverage: number; last_peak_coverage: number; median_rel_width_trough: number;
  patient_coverage_p10: number; unavailable_reasons: Record<string, number>;
}

function runCell(scenario: Scenario, design: Design, n: number): CellResult {
  const rng = makeRng(SEED_BASE + ({ app: 0, published: 1000, published_iiv: 2000, published_error: 3000 } as const)[scenario] + ({ empiric: 0, one_level: 1, peak_trough: 2, loading_dose: 3 } as const)[design]);
  const sds = truthSds(scenario);
  let nBand = 0, nUnavail = 0, nRejected = 0, inside = 0, below = 0, above = 0, points = 0;
  let troughIn = 0, peakIn = 0;
  const widths: number[] = [];
  const perPatient: number[] = [];
  const clusters: { inside: number; n: number }[] = [];
  const reasons: Record<string, number> = {};

  for (let i = 0; i < n; i++) {
    const sp = sampleSyntheticIcuPatient(rng);
    const patientIn = { age: Math.round(sp.age_yr), weight_kg: Math.round(sp.weight_kg * 10) / 10, height_cm: Math.round(sp.height_cm), sex: sp.sex, serum_creatinine_mg_dl: Math.round(sp.scr_mg_dl * 100) / 100 };
    const eta = { CL: rng.normal(), V1: rng.normal(), Q: rng.normal(), V2: rng.normal() };
    const noise = [rng.normal(), rng.normal()];
    const { dose, T_inf } = empiricDose(patientIn.weight_kg);
    const prior = buildPriorParameters(normalizePatient(patientIn), { dose_mg: dose, interval_hours: TAU, infusion_duration_hours: T_inf } as never);
    const truth: TwoCompartmentParameters = {
      CL: prior.CL * Math.exp(sds.CL * eta.CL), V1: prior.V1 * Math.exp(sds.V1 * eta.V1),
      Q: prior.Q * Math.exp(sds.Q * eta.Q), V2: prior.V2 * Math.exp(sds.V2 * eta.V2),
    };

    let res: Record<string, unknown>;
    let schedule: { dose: number; tau: number; T_inf: number; load?: { dose: number; T_inf: number } };
    try {
      if (design === "empiric") {
        res = computeInitialRegimen(patientIn) as unknown as Record<string, unknown>;
        const d = parseFloat(String(res.recommended_dose));
        const tau = Number(res.recommended_interval_hours);
        const ti = Math.min(Number(res.recommended_infusion_duration_hours), tau);
        schedule = { dose: d, tau, T_inf: ti };
      } else if (design === "one_level") {
        const tLevel = 4 * TAU + 11.5;
        const obs = observe(trueConc(truth, dose, TAU, T_inf, tLevel, 5), scenario, noise[0]);
        res = runExistingRegimenPipeline({
          patient: patientIn,
          regimen: { dose_mg: dose, interval_hours: TAU, infusion_duration_hours: T_inf, doses_given: 5, steady_state_confirmed: false },
          levels: [{ value_mcg_ml: obs, collection_time: "", time_since_last_dose_hours: 11.5 }],
        }) as Record<string, unknown>;
        schedule = { dose, tau: TAU, T_inf };
      } else if (design === "loading_dose") {
        const load = Math.min(3000, Math.round((25 * patientIn.weight_kg) / 250) * 250);
        const loadTinf = load <= 2000 ? 2 : 2.5;
        schedule = { dose, tau: TAU, T_inf, load: { dose: load, T_inf: loadTinf } };
        const obs = observe(truthAt(truth, schedule, 2 * TAU + 11.5), scenario, noise[0]);
        res = runExistingRegimenPipeline({
          patient: patientIn,
          regimen: { dose_mg: dose, interval_hours: TAU, infusion_duration_hours: T_inf, doses_given: 3, steady_state_confirmed: false, loading_dose_mg: load, loading_infusion_duration_hours: loadTinf },
          levels: [{ value_mcg_ml: obs, collection_time: "", time_since_last_dose_hours: 11.5 }],
        }) as Record<string, unknown>;
      } else {
        const tPeak = T_inf + 1, tTrough = 11.5;
        const ss = (t: number) => trueConc(truth, dose, TAU, T_inf, 80 * TAU + t);
        const start = Date.UTC(2026, 2, 15, 8, 0, 0);
        const iso = (h: number) => new Date(start + h * 3600e3).toISOString();
        res = runExistingRegimenPipeline({
          patient: patientIn,
          regimen: { dose_mg: dose, interval_hours: TAU, infusion_duration_hours: T_inf, doses_given: 6, steady_state_confirmed: true },
          levels: [
            { value_mcg_ml: observe(ss(tPeak), scenario, noise[0]), collection_time: iso(tPeak), time_since_last_dose_hours: tPeak },
            { value_mcg_ml: observe(ss(tTrough), scenario, noise[1]), collection_time: iso(tTrough), time_since_last_dose_hours: tTrough },
          ],
        }) as Record<string, unknown>;
        schedule = { dose, tau: TAU, T_inf };
      }
    } catch {
      nRejected++; continue;
    }
    const curve = res.curve as Pt[] | undefined;
    if (!curve || curve.length < 2 || !Number.isFinite(schedule.dose) || !(schedule.tau > 0)) { nRejected++; continue; }
    const pu = res.parameter_uncertainty as { method: string; reason?: string } | undefined;
    if (!pu || pu.method === "unavailable") {
      nUnavail++;
      const key = (pu?.reason ?? "missing").replace(/\(.*?\)/g, "").trim();
      reasons[key] = (reasons[key] ?? 0) + 1;
      continue;
    }
    nBand++;
    let pIn = 0, pN = 0;
    for (const p of curve) {
      if (p.time_hours <= 0) continue;
      const c = truthAt(truth, schedule, p.time_hours);
      if (c < 0.01) continue;
      points++; pN++;
      if (c < p.lower!) below++; else if (c > p.upper!) above++; else { inside++; pIn++; }
    }
    perPatient.push(pN ? pIn / pN : 1);
    clusters.push({ inside: pIn, n: pN });
    // Last plotted interval: trough = last point, peak = max over the final interval.
    const tEnd = curve[curve.length - 1].time_hours;
    const last = curve.filter((p) => p.time_hours > tEnd - schedule.tau + 1e-9);
    const troughPt = curve[curve.length - 1];
    const peakPt = last.reduce((a, b) => (b.concentration > a.concentration ? b : a), last[0]);
    const cT = truthAt(truth, schedule, troughPt.time_hours);
    const cP = truthAt(truth, schedule, peakPt.time_hours);
    if (cT >= troughPt.lower! && cT <= troughPt.upper!) troughIn++;
    if (cP >= peakPt.lower! && cP <= peakPt.upper!) peakIn++;
    widths.push((troughPt.upper! - troughPt.lower!) / Math.max(troughPt.concentration, 1e-6));
  }
  widths.sort((a, b) => a - b);
  perPatient.sort((a, b) => a - b);
  const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
  // Cluster-robust SE of the pooled coverage (points within a patient are correlated).
  const pHat = inside / points;
  const seCluster = Math.sqrt(clusters.reduce((a, c) => a + (c.inside - pHat * c.n) ** 2, 0)) / points;
  return {
    scenario, design, n_patients: n, n_band: nBand, n_unavailable: nUnavail, n_rejected: nRejected,
    pooled_coverage: r4(inside / points), pooled_coverage_se: r4(seCluster), pooled_below: r4(below / points), pooled_above: r4(above / points), n_points: points,
    last_trough_coverage: r4(troughIn / nBand), last_peak_coverage: r4(peakIn / nBand),
    median_rel_width_trough: r4(widths[Math.floor(widths.length / 2)] ?? NaN),
    patient_coverage_p10: r4(perPatient[Math.floor(perPatient.length * 0.1)] ?? NaN),
    unavailable_reasons: reasons,
  };
}

function loadResults(): CellResult[] {
  try { return JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8")).cells ?? []; } catch { return []; }
}

if (process.argv.includes("--report")) {
  const cells = loadResults();
  console.log("scenario   design        band/n    pooled (±1.96 SE)   below  above  trough  peak   width@trough  p10-patient");
  for (const c of cells) {
    console.log(`${c.scenario.padEnd(10)} ${c.design.padEnd(13)} ${String(c.n_band).padStart(4)}/${String(c.n_patients).padEnd(4)} ${(c.pooled_coverage * 100).toFixed(1).padStart(6)}% (±${(1.96 * (c.pooled_coverage_se ?? 0) * 100).toFixed(1)}) ${(c.pooled_below * 100).toFixed(1).padStart(5)}% ${(c.pooled_above * 100).toFixed(1).padStart(5)}% ${(c.last_trough_coverage * 100).toFixed(1).padStart(6)}% ${(c.last_peak_coverage * 100).toFixed(1).padStart(5)}%  ${(c.median_rel_width_trough * 100).toFixed(0).padStart(6)}%       ${(c.patient_coverage_p10 * 100).toFixed(0)}%`);
  }
} else {
  const scenario = (arg("scenario") ?? "app") as Scenario;
  const design = (arg("design") ?? "one_level") as Design;
  const n = Number(arg("n") ?? 300);
  const t0 = Date.now();
  const cell = runCell(scenario, design, n);
  const cells = loadResults().filter((c) => !(c.scenario === scenario && c.design === design));
  cells.push(cell);
  cells.sort((a, b) => (a.scenario + a.design).localeCompare(b.scenario + b.design));
  fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
  fs.writeFileSync(RESULTS_FILE, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), engine_manifest: MODEL_MANIFEST_VERSION, seed_base: SEED_BASE, n_per_cell: cells[0]?.n_patients, cells }, null, 2) + "\n");
  console.log(JSON.stringify(cell), `${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
