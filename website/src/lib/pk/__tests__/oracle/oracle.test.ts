/**
 * Oracle test for the two-compartment vancomycin PK engine.
 *
 * Run: npx tsx src/lib/pk/__tests__/oracle/oracle.test.ts   (or npm run test:oracle)
 *
 * Sections:
 *   A. Closed-form oracle (closedFormOracle.ts, no production imports) vs
 *      scripts/pk-reference/fixtures.json (scipy expm reference).
 *   B. Literal reference values (must reproduce from the equations).
 *   C. Property tests on the oracle alone.
 *   D. PRODUCTION vs oracle — the only section that imports src/lib/pk code.
 *
 * Tolerances:
 *   REL = 1e-6 relative everywhere both sides are analytic / exact. Fixture
 *   steady-state values come from a long simulation (>= 45 terminal
 *   half-lives, residual ~2^-45 ≈ 3e-14) so 1e-6 also applies to them.
 *   Reference-value literals are quoted to 12-13 significant figures; they are
 *   asserted at 1e-9 relative (the literals themselves limit precision), the
 *   BMI CL values at 1e-5 as specified.
 *   Any looser tolerance is stated inline with the reason.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  colinPrior,
  macroConstants,
  regularTrain,
  scheduleA2,
  scheduleAucWindow,
  scheduleC,
  scheduleCumAuc,
  singleDoseAucWindow,
  singleDoseC,
  singleDoseCumAuc,
  steadyStateAucWindow,
  steadyStateC,
  steadyStateExposure,
  terminalHalfLife,
  type OracleParams,
} from "./closedFormOracle";

const REL = 1e-6;
const here = dirname(fileURLToPath(import.meta.url));
const fixturesPath = resolve(here, "../../../../../scripts/pk-reference/fixtures.json");

// ── minimal harness ─────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];
function section(name: string): void {
  console.log(`\n== ${name}`);
}
function check(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`${name}: ${msg}`);
    console.log(`  FAIL ${name}\n       ${msg}`);
  }
}
function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}
function relErr(actual: number, expected: number): number {
  const denom = Math.max(Math.abs(expected), 1e-12);
  return Math.abs(actual - expected) / denom;
}
function assertRel(actual: number, expected: number, tol: number, label: string): void {
  const e = relErr(actual, expected);
  if (!(e <= tol)) {
    throw new Error(`${label}: expected ${expected}, actual ${actual}, rel err ${e.toExponential(3)} > ${tol}`);
  }
}

// ── fixtures ────────────────────────────────────────────────────────────────
interface FixtureCase {
  name: string;
  patient: { age: number; weight_kg: number; scr_mg_dl: number } | null;
  params: OracleParams;
  micro: { k10: number; k12: number; k21: number; discriminant_sq: number };
  regimen: { dose_mg: number; tau_h: number; T_inf_h: number };
  single_dose: { curve: { t: number; C: number }[]; auc_0_24_exact: number; auc_0_inf_exact_identity: number; auc_0_500h_exact: number };
  finite_train: {
    n_doses: number;
    peak_dose_n: number;
    trough_interval_n: number;
    auc_0_to_24_exact: number;
    auc_0_to_24_trapezoid_richardson: number;
    auc_0_to_end: number;
    mass_balance: { infused_mg: number; in_body_mg: number; eliminated_mg: number; residual_mg: number };
    curve: { t: number; C: number }[];
  };
  steady_state_long_simulation: {
    n_doses_simulated: number;
    terminal_half_life_h: number;
    peak_end_of_infusion: number;
    trough_end_of_interval: number;
    auc_tau: number;
    auc24: number;
    auc24_linear_identity: number;
  };
}
interface Fixtures {
  reference_prior: { patient: { age: number; weight_kg: number; scr_mg_dl: number }; CL: number; V1: number; V2: number; Q: number };
  bmi_continuity: { weights: Record<string, number>; expected_ratio: number };
  cases: FixtureCase[];
}
const fx: Fixtures = JSON.parse(readFileSync(fixturesPath, "utf8"));

// ═══════════════════════════════════════════════════════════════════════════
section("A. closed-form oracle vs scipy expm fixtures (1e-6 relative)");
// ═══════════════════════════════════════════════════════════════════════════
check("reference prior parameters match fixture", () => {
  const p = colinPrior(fx.reference_prior.patient);
  assertRel(p.CL, fx.reference_prior.CL, 1e-12, "CL");
  assertRel(p.V1, fx.reference_prior.V1, 1e-12, "V1");
  assertRel(p.V2, fx.reference_prior.V2, 1e-12, "V2");
  assertRel(p.Q, fx.reference_prior.Q, 1e-12, "Q");
});

for (const c of fx.cases) {
  const p = c.params;
  const { dose_mg: D, tau_h: tau, T_inf_h: T } = c.regimen;
  check(`[${c.name}] single-dose curve (${c.single_dose.curve.length} pts)`, () => {
    for (const pt of c.single_dose.curve) assertRel(singleDoseC(p, D, T, pt.t), pt.C, REL, `C(t=${pt.t})`);
  });
  check(`[${c.name}] single-dose AUC 0-24, 0-500 (analytic vs expm-augmented)`, () => {
    assertRel(singleDoseAucWindow(p, D, T, 0, 24), c.single_dose.auc_0_24_exact, REL, "AUC0-24");
    assertRel(singleDoseAucWindow(p, D, T, 0, 500), c.single_dose.auc_0_500h_exact, REL, "AUC0-500");
  });
  check(`[${c.name}] finite train n=${c.finite_train.n_doses}: curve, peak, trough, AUC, mass`, () => {
    const n = c.finite_train.n_doses;
    const sched = regularTrain(D, tau, T, n);
    for (const pt of c.finite_train.curve) assertRel(scheduleC(p, sched, pt.t), pt.C, REL, `C(t=${pt.t})`);
    assertRel(scheduleC(p, sched, (n - 1) * tau + T), c.finite_train.peak_dose_n, REL, "peak dose n");
    assertRel(scheduleC(p, sched, n * tau), c.finite_train.trough_interval_n, REL, "trough interval n");
    assertRel(scheduleAucWindow(p, sched, 0, Math.min(24, n * tau)), c.finite_train.auc_0_to_24_exact, REL, "AUC0-24");
    assertRel(scheduleCumAuc(p, sched, n * tau), c.finite_train.auc_0_to_end, REL, "AUC0-end");
    const inBody = scheduleC(p, sched, n * tau) * p.V1 + scheduleA2(p, sched, n * tau);
    assertRel(inBody, c.finite_train.mass_balance.in_body_mg, REL, "amount in body at end");
  });
  check(`[${c.name}] steady state (closed-form accumulation vs long simulation)`, () => {
    const ss = steadyStateExposure(p, D, tau, T);
    const ref = c.steady_state_long_simulation;
    assertRel(ss.peak, ref.peak_end_of_infusion, REL, "ss peak");
    assertRel(ss.trough, ref.trough_end_of_interval, REL, "ss trough");
    assertRel(ss.aucTau, ref.auc_tau, REL, "ss AUC tau");
    assertRel(ss.auc24, ref.auc24, REL, "ss AUC24");
    assertRel(ss.auc24, ref.auc24_linear_identity, REL, "ss AUC24 vs dose/CL identity");
  });
  check(`[${c.name}] micro-constant discriminant matches`, () => {
    assertRel(macroConstants(p).discriminantSq, c.micro.discriminant_sq, 1e-6, "disc^2");
  });
}

// ═══════════════════════════════════════════════════════════════════════════
section("B. literal reference values (age 35, 70 kg, SCr 0.83; 1000 mg q12h over 1.75 h)");
// ═══════════════════════════════════════════════════════════════════════════
// All values below REPRODUCED from the equations (scipy expm and the closed
// form agree with the literals to ~1e-13). If a future edit makes one fail,
// report the computed value — do not adjust the literal.
const REF_PT = { age: 35, weight_kg: 70, scr_mg_dl: 0.83 };
const REF = colinPrior(REF_PT);
const LIT_TOL = 1e-9;
check("CL 4.102381651824105, V1 42.9, Q 3.22, V2 41.7", () => {
  assertRel(REF.CL, 4.102381651824105, 1e-12, "CL");
  assert(REF.V1 === 42.9, `V1 ${REF.V1}`);
  assert(REF.Q === 3.22, `Q ${REF.Q}`);
  assert(REF.V2 === 41.7, `V2 ${REF.V2}`);
});
check("steady-state AUC24 487.521681243555", () => {
  assertRel(steadyStateExposure(REF, 1000, 12, 1.75).auc24, 487.521681243555, LIT_TOL, "AUC24");
});
check("steady-state peak 31.920450104043 (end of infusion)", () => {
  assertRel(steadyStateExposure(REF, 1000, 12, 1.75).peak, 31.920450104043, LIT_TOL, "peak");
});
check("steady-state trough 12.927927800297 (pre-dose)", () => {
  assertRel(steadyStateExposure(REF, 1000, 12, 1.75).trough, 12.927927800297, LIT_TOL, "trough");
});
check("six doses from zero: peak 30.608889261698, trough 12.008178342517", () => {
  const s = regularTrain(1000, 12, 1.75, 6);
  assertRel(scheduleC(REF, s, 5 * 12 + 1.75), 30.608889261698, LIT_TOL, "peak dose 6");
  assertRel(scheduleC(REF, s, 6 * 12), 12.008178342517, LIT_TOL, "trough interval 6");
});
check("BMI continuity: 122.19375 kg -> CL 6.230161, 122.5 kg -> 6.241868, ratio == (122.5/122.19375)^0.75", () => {
  const a = colinPrior({ age: 35, weight_kg: 122.19375, scr_mg_dl: 0.83 }).CL;
  const b = colinPrior({ age: 35, weight_kg: 122.5, scr_mg_dl: 0.83 }).CL;
  assertRel(a, 6.230161, 1e-5, "CL @122.19375");
  assertRel(b, 6.241868, 1e-5, "CL @122.5");
  assertRel(b / a, Math.pow(122.5 / 122.19375, 0.75), 1e-12, "CL ratio");
  assertRel(a, fx.bmi_continuity.weights["122.19375"], 1e-12, "fixture @122.19375");
  assertRel(b, fx.bmi_continuity.weights["122.5"], 1e-12, "fixture @122.5");
});

// ═══════════════════════════════════════════════════════════════════════════
section("C. property tests on the oracle");
// ═══════════════════════════════════════════════════════════════════════════
const PROP_PARAMS: { label: string; p: OracleParams }[] = [
  { label: "reference", p: REF },
  { label: "slow CL0.3 V40", p: { CL: 0.3, V1: 40, Q: 3.22, V2: 41.7 } },
  { label: "near-degenerate alpha~beta", p: { CL: 4, V1: 40, Q: 1e-5, V2: 1e-4 } },
  { label: "elderly 80y 110kg SCr2.2", p: colinPrior({ age: 80, weight_kg: 110, scr_mg_dl: 2.2 }) },
];
const PROP_REGIMENS: { D: number; tau: number; T: number }[] = [
  { D: 1000, tau: 12, T: 1.75 },
  { D: 1250, tau: 18, T: 1 },
  { D: 1500, tau: 36, T: 2 },
  { D: 750, tau: 8, T: 0.5 },
  { D: 750, tau: 8, T: 4 },
  { D: 2000, tau: 24, T: 3 },
];
for (const { label, p } of PROP_PARAMS) {
  for (const { D, tau, T } of PROP_REGIMENS) {
    const tag = `[${label}; ${D} mg q${tau}h/${T}h]`;
    check(`${tag} positivity & continuity at end of infusion`, () => {
      const s = regularTrain(D, tau, T, 6);
      for (let t = 0.01; t <= 6 * tau; t += 0.37) assert(scheduleC(p, s, t) > 0, `C(${t}) <= 0`);
      const eps = 1e-9;
      const cm = scheduleC(p, s, 3 * tau + T - eps);
      const cp = scheduleC(p, s, 3 * tau + T + eps);
      assertRel(cp, cm, 1e-7, "continuity at end of infusion"); // eps*slope ≈ 1e-9 × O(10) mg/L/h
      // slope must be discontinuous: rising before, falling after
      const slopeBefore = (scheduleC(p, s, 3 * tau + T) - scheduleC(p, s, 3 * tau + T - 1e-4)) / 1e-4;
      const slopeAfter = (scheduleC(p, s, 3 * tau + T + 1e-4) - scheduleC(p, s, 3 * tau + T)) / 1e-4;
      assert(slopeBefore > 0 && slopeAfter < 0, `slope before ${slopeBefore}, after ${slopeAfter}`);
    });
    check(`${tag} dose linearity (2x dose -> 2x C, 2x AUC)`, () => {
      for (const t of [0.5 * T, T, T + 1, tau, 2.5 * tau]) {
        assertRel(singleDoseC(p, 2 * D, T, t), 2 * singleDoseC(p, D, T, t), 1e-12, `C(${t})`);
        assertRel(steadyStateC(p, 2 * D, tau, T, Math.min(t, tau)), 2 * steadyStateC(p, D, tau, T, Math.min(t, tau)), 1e-12, `Css(${t})`);
      }
      assertRel(singleDoseCumAuc(p, 2 * D, T, 24), 2 * singleDoseCumAuc(p, D, T, 24), 1e-12, "AUC");
    });
    check(`${tag} superposition (train == sum of single doses)`, () => {
      const n = 7;
      for (const t of [T / 2, T, tau, 2 * tau + T, 5.5 * tau, n * tau]) {
        let sum = 0;
        for (let k = 0; k < n; k++) if (t > k * tau) sum += singleDoseC(p, D, T, t - k * tau);
        assertRel(scheduleC(p, regularTrain(D, tau, T, n), t), sum, 1e-12, `C(${t})`);
      }
    });
    check(`${tag} conservation of mass: A1 + A2 + CL*AUC == infused`, () => {
      const s = regularTrain(D, tau, T, 5);
      for (const t of [T / 3, T, tau / 2, tau, 2 * tau + T / 2, 5 * tau, 5 * tau + 100]) {
        let infused = 0;
        for (const d of s) infused += d.dose_mg * Math.min(1, Math.max(0, (t - d.time) / d.T_inf));
        const a1 = scheduleC(p, s, t) * p.V1;
        const a2 = scheduleA2(p, s, t);
        const elim = p.CL * scheduleCumAuc(p, s, t);
        assertRel(a1 + a2 + elim, infused, 1e-9, `t=${t}: A1 ${a1} + A2 ${a2} + elim ${elim}`);
      }
    });
    check(`${tag} finite train converges to steady state (N -> large)`, () => {
      const ss = steadyStateExposure(p, D, tau, T);
      const hl = terminalHalfLife(p);
      const N = Math.max(20, Math.ceil((40 * hl) / tau));
      const s = regularTrain(D, tau, T, N);
      const peakN = scheduleC(p, s, (N - 1) * tau + T);
      const troughN = scheduleC(p, s, N * tau);
      assertRel(peakN, ss.peak, 1e-9, `peak after ${N} doses`);
      assertRel(troughN, ss.trough, 1e-9, `trough after ${N} doses`);
      // monotone approach: trough after k doses increases with k
      let prev = 0;
      for (let k = 1; k <= 8; k++) {
        const tr = scheduleC(p, regularTrain(D, tau, T, k), k * tau);
        assert(tr > prev, `trough not increasing at k=${k}`);
        assert(tr <= ss.trough * (1 + 1e-12), `finite trough ${tr} exceeds ss ${ss.trough}`);
        prev = tr;
      }
    });
    check(`${tag} steady-state daily AUC == daily dose / CL; first-24h AUC differs`, () => {
      const ss = steadyStateExposure(p, D, tau, T);
      assertRel(ss.auc24, ((D / p.CL) * 24) / tau, 1e-10, "ss AUC24 identity");
      const nIn24 = Math.ceil(24 / tau);
      const first24 = scheduleAucWindow(p, regularTrain(D, tau, T, nIn24), 0, 24);
      // The first-24h AUC of a finite train is NOT the steady-state identity.
      // For tau <= 24 it is strictly below (no accumulation yet). For tau > 24
      // the steady-state DAILY AVERAGE (D/CL x 24/tau) can sit on either side
      // of the first-24h AUC depending on half-life vs tau, so only "differs"
      // and "< (doses given) x D/CL" (their total AUC to infinity) are invariants.
      assert(relErr(first24, ss.auc24) > 1e-3, `first-24h AUC ${first24} should differ from ss AUC24 ${ss.auc24}`);
      if (tau <= 24) assert(first24 < ss.auc24, `first-24h AUC ${first24} should be < ss AUC24 ${ss.auc24}`);
      assert(first24 < (nIn24 * D) / p.CL, `first-24h AUC ${first24} should be < ${nIn24} x D/CL ${(nIn24 * D) / p.CL}`);
      // The interval AUC at steady state over any sub-window still integrates the profile
      assertRel(steadyStateAucWindow(p, D, tau, T, 0, T) + steadyStateAucWindow(p, D, tau, T, T, tau), ss.aucTau, 1e-12, "additivity");
    });
    check(`${tag} single-dose AUC(0,inf) == D/CL`, () => {
      const far = 200 * terminalHalfLife(p);
      assertRel(singleDoseCumAuc(p, D, T, Math.min(far, 1e7)), D / p.CL, 1e-9, "AUCinf");
    });
  }
}
check("infusion durations 0.5..4 h (step 0.25) reproduce reference q12h steady-state identity and peak ordering", () => {
  let lastPeak = Infinity;
  for (let T = 0.5; T <= 4.0001; T += 0.25) {
    const ss = steadyStateExposure(REF, 1000, 12, T);
    assertRel(ss.auc24, 2000 / REF.CL, 1e-10, `AUC24 at T=${T}`);
    assert(ss.peak < lastPeak, `peak not decreasing with longer infusion at T=${T}`);
    lastPeak = ss.peak;
    const c = fx.cases.find((k) => k.name === `q8h_750_tinf${T}`);
    if (c) assertRel(steadyStateExposure(REF, 750, 8, T).peak, c.steady_state_long_simulation.peak_end_of_infusion, REL, `fixture peak T=${T}`);
  }
});
check("alpha~beta guard: discriminant tiny, values finite, agree with fixture", () => {
  const p = { CL: 4, V1: 40, Q: 1e-5, V2: 1e-4 };
  const m = macroConstants(p);
  assert(m.discriminantSq < 2e-7 && m.discriminantSq > 0, `disc^2 ${m.discriminantSq}`);
  assert(Number.isFinite(m.Ca) && Number.isFinite(m.Cb), "coefficients finite");
  const c = fx.cases.find((k) => k.name === "near_degenerate_alpha_eq_beta")!;
  assertRel(steadyStateExposure(p, 1000, 12, 1).trough, c.steady_state_long_simulation.trough_end_of_interval, REL, "trough");
  assertRel(singleDoseC(p, 1000, 1, 1), c.single_dose.curve.find((q) => q.t === 1)!.C, REL, "peak single dose");
});
check("BMI continuity across a fine weight sweep (CL is smooth in WT^0.75)", () => {
  let prev = colinPrior({ age: 35, weight_kg: 100, scr_mg_dl: 0.83 }).CL;
  for (let w = 100.25; w <= 160; w += 0.25) {
    const cl = colinPrior({ age: 35, weight_kg: w, scr_mg_dl: 0.83 }).CL;
    assertRel(cl / prev, Math.pow(w / (w - 0.25), 0.75), 1e-12, `ratio at ${w}`);
    prev = cl;
  }
});

// ═══════════════════════════════════════════════════════════════════════════
section("D. PRODUCTION vs oracle (imports from src/lib/pk) — 1e-6 relative");
// ═══════════════════════════════════════════════════════════════════════════
import {
  computeExposure,
  concentrationAtTime,
  singleDoseConcentration,
  curvePoints,
  singleDoseAuc,
  type SteadyStateInput,
} from "../../steadyStateTwoCompartment";
import { buildPriorParameters } from "../../posterior/buildPriorParameters";

interface Discrepancy {
  fn: string;
  inputs: string;
  expected: number;
  actual: number;
  relErr: number;
}
const discrepancies: Discrepancy[] = [];
function compare(fn: string, inputs: string, actual: number, expected: number, tol = REL): void {
  const e = relErr(actual, expected);
  if (!(e <= tol)) discrepancies.push({ fn, inputs, expected, actual, relErr: e });
}

function compareRegimen(label: string, p: OracleParams, D: number, tau: number, T: number): void {
  const input: SteadyStateInput = { ...p, dose_mg: D, tau, T_inf: T };
  const ss = steadyStateExposure(p, D, tau, T);
  const ex = computeExposure(input);
  const pin = `${label} {CL ${p.CL}, V1 ${p.V1}, Q ${p.Q}, V2 ${p.V2}} ${D} mg q${tau}h T_inf ${T}`;
  compare("computeExposure.auc24", pin, ex.auc24, ss.auc24);
  compare("computeExposure.peak", pin, ex.peak, ss.peak);
  compare("computeExposure.trough", pin, ex.trough, ss.trough);
  for (const t of [0, T / 4, T / 2, T, Math.min(T + 0.5, tau), (T + tau) / 2, tau]) {
    compare("concentrationAtTime", `${pin} t=${t}`, concentrationAtTime({ ...input, t }), steadyStateC(p, D, tau, T, t));
  }
  for (const t of [0, T / 3, T, T + 0.25, tau, 2 * tau, 48, 96]) {
    compare("singleDoseConcentration", `${pin} t=${t}`, singleDoseConcentration(input, t), singleDoseC(p, D, T, t));
  }
  // singleDoseAuc is trapezoid (step 0.02 h); compared at 1e-6 as specified —
  // any discrepancy is reported, not hidden.
  compare("singleDoseAuc(0,24)", pin, singleDoseAuc(input, 0, 24), singleDoseAucWindow(p, D, T, 0, 24));
  compare("singleDoseAuc(0,tau)", pin, singleDoseAuc(input, 0, tau), singleDoseAucWindow(p, D, T, 0, tau));
  // curvePoints: evaluate the oracle at curvePoints' own times with the same dose count.
  const pts = curvePoints(input);
  const totalTime = pts[pts.length - 1].time_hours;
  const nDoses = Math.round(totalTime / tau);
  const sched = regularTrain(D, tau, T, nDoses);
  for (const pt of pts) {
    compare("curvePoints", `${pin} n_doses=${nDoses} t=${pt.time_hours}`, pt.concentration, scheduleC(p, sched, pt.time_hours));
  }
}

check("buildPriorParameters (Colin prior) vs oracle on reference + BMI patients", () => {
  const cases = [
    { age: 35, weight_kg: 70, height_cm: 175, scr: 0.83 },
    { age: 35, weight_kg: 122.19375, height_cm: 175, scr: 0.83 },
    { age: 35, weight_kg: 122.5, height_cm: 175, scr: 0.83 },
    { age: 65, weight_kg: 90, height_cm: 170, scr: 1.5 },
    { age: 25, weight_kg: 55, height_cm: 160, scr: 0.6 },
    { age: 80, weight_kg: 110, height_cm: 180, scr: 2.2 },
  ];
  for (const c of cases) {
    const prod = buildPriorParameters(
      { age: c.age, weight_kg: c.weight_kg, height_cm: c.height_cm, sex: "male", serum_creatinine_mg_dl: c.scr },
      { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 },
    );
    const o = colinPrior({ age: c.age, weight_kg: c.weight_kg, scr_mg_dl: c.scr });
    const pin = `age ${c.age} wt ${c.weight_kg} scr ${c.scr}`;
    compare("buildPriorParameters.CL", pin, prod.CL, o.CL);
    compare("buildPriorParameters.V1", pin, prod.V1, o.V1);
    compare("buildPriorParameters.Q", pin, prod.Q, o.Q);
    compare("buildPriorParameters.V2", pin, prod.V2, o.V2);
  }
  const before = discrepancies.length;
  assert(before === 0, `${before} discrepancies (listed at end)`);
});

check("production BMI continuity: CL ratio 122.5/122.19375 == (122.5/122.19375)^0.75", () => {
  const mk = (w: number) =>
    buildPriorParameters({ age: 35, weight_kg: w, height_cm: 175, sex: "male", serum_creatinine_mg_dl: 0.83 }, { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 }).CL;
  const a = mk(122.19375);
  const b = mk(122.5);
  assertRel(a, 6.230161, 1e-5, "CL @122.19375");
  assertRel(b, 6.241868, 1e-5, "CL @122.5");
  assertRel(b / a, Math.pow(122.5 / 122.19375, 0.75), 1e-12, "ratio");
});

check("production reference regimen (1000 mg q12h / 1.75 h) vs oracle", () => {
  const n0 = discrepancies.length;
  compareRegimen("reference", REF, 1000, 12, 1.75);
  const ex = computeExposure({ ...REF, dose_mg: 1000, tau: 12, T_inf: 1.75 });
  assertRel(ex.auc24, 487.521681243555, LIT_TOL, "prod AUC24");
  assertRel(ex.peak, 31.920450104043, LIT_TOL, "prod peak");
  assertRel(ex.trough, 12.927927800297, LIT_TOL, "prod trough");
  const s = discrepancies.slice(n0).filter((d) => !d.fn.startsWith("singleDoseAuc"));
  assert(s.length === 0, `${s.length} discrepancies: ${Array.from(new Set(s.map((d) => d.fn))).join(", ")} (listed at end)`);
});

check("production vs oracle on every fixture case (incl. slow, near-degenerate, q18/q36, T_inf 0.5-4)", () => {
  const n0 = discrepancies.length;
  for (const c of fx.cases) compareRegimen(c.name, c.params, c.regimen.dose_mg, c.regimen.tau_h, c.regimen.T_inf_h);
  const s = discrepancies.slice(n0).filter((d) => !d.fn.startsWith("singleDoseAuc"));
  assert(s.length === 0, `${s.length} discrepancies: ${Array.from(new Set(s.map((d) => d.fn))).join(", ")} (listed at end)`);
});

// Seeded PRNG (mulberry32) for the random regimen grid.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED = Number(process.env.ORACLE_SEED ?? 20260917);
console.log(`  (random regimen grid seed = ${SEED}; override with ORACLE_SEED=<int>)`);
check("production vs oracle on 20 seeded random adult regimens", () => {
  const rnd = mulberry32(SEED);
  const n0 = discrepancies.length;
  const TAUS = [6, 8, 12, 18, 24, 36, 48];
  for (let i = 0; i < 20; i++) {
    // Adult ranges only: buildPriorParameters floors age at 18 and weight at 30 kg,
    // which the oracle deliberately does not replicate.
    const age = 18 + Math.floor(rnd() * 78); // 18..95
    const weight_kg = Math.round((40 + rnd() * 160) * 10) / 10; // 40..200
    const scr = Math.round((0.3 + rnd() * 4.7) * 100) / 100; // 0.3..5.0
    const D = 250 * (1 + Math.floor(rnd() * 12)); // 250..3000
    const tau = TAUS[Math.floor(rnd() * TAUS.length)];
    const T = Math.round((0.5 + rnd() * 3.5) * 4) / 4; // 0.5..4 in 0.25 steps
    const prod = buildPriorParameters(
      { age, weight_kg, height_cm: 170, sex: rnd() < 0.5 ? "male" : "female", serum_creatinine_mg_dl: scr },
      { dose_mg: D, interval_hours: tau, infusion_duration_hours: T },
    );
    const o = colinPrior({ age, weight_kg, scr_mg_dl: scr });
    const pin = `rand#${i} age ${age} wt ${weight_kg} scr ${scr}`;
    compare("buildPriorParameters.CL", pin, prod.CL, o.CL);
    compare("buildPriorParameters.V1", pin, prod.V1, o.V1);
    compare("buildPriorParameters.Q", pin, prod.Q, o.Q);
    compare("buildPriorParameters.V2", pin, prod.V2, o.V2);
    compareRegimen(`rand#${i}`, o, D, tau, T);
  }
  const s = discrepancies.slice(n0).filter((d) => !d.fn.startsWith("singleDoseAuc"));
  assert(s.length === 0, `${s.length} discrepancies: ${Array.from(new Set(s.map((d) => d.fn))).join(", ")} (listed at end)`);
});

// singleDoseAuc is reported in its own check so that the analytic functions'
// verdict above is not masked by a quadrature-error finding.
//
// KNOWN FINDING (2026-09-17): production singleDoseAuc integrates by composite
// trapezoid with a fixed 0.02 h step. It misses the analytic AUC by 1e-6 to
// ~1.2e-5 relative (always low: trapezoid under-estimates the concave
// post-infusion decay, and the end-of-infusion kink usually falls between grid
// nodes, e.g. 1.75 h / 0.02 h = 87.5 steps). It is quadrature error, not a
// formula error: with step 0.01 h (kink on a node) the reference case agrees to
// 3.2e-8, and with step 1e-4 h to 3.2e-12. The tolerance is deliberately NOT
// loosened here; the discrepancy list at the end quantifies it per regimen.
check("production singleDoseAuc (trapezoid, step 0.02 h) vs analytic AUC at 1e-6", () => {
  const s = discrepancies.filter((d) => d.fn.startsWith("singleDoseAuc"));
  assert(
    s.length === 0,
    `${s.length} of the regimens above exceed 1e-6; worst rel err ${Math.max(...s.map((d) => d.relErr)).toExponential(3)} (listed at end)`,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Report
// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${passed} passed, ${failed} failed`);
if (discrepancies.length > 0) {
  console.log(`\nPRODUCTION vs ORACLE DISCREPANCIES (${discrepancies.length}, tolerance ${REL} relative):`);
  const byFn = new Map<string, Discrepancy[]>();
  for (const d of discrepancies) byFn.set(d.fn, [...(byFn.get(d.fn) ?? []), d]);
  for (const [fn, list] of Array.from(byFn.entries())) {
    const worst = list.reduce((a: Discrepancy, b: Discrepancy) => (b.relErr > a.relErr ? b : a));
    console.log(`  ${fn}: ${list.length} case(s); worst rel err ${worst.relErr.toExponential(3)}`);
    for (const d of list.slice(0, 5)) {
      console.log(`    inputs: ${d.inputs}\n      expected ${d.expected}\n      actual   ${d.actual}\n      rel err  ${d.relErr.toExponential(3)}`);
    }
    if (list.length > 5) console.log(`    ... ${list.length - 5} more`);
  }
} else {
  console.log("\nPRODUCTION vs ORACLE: no discrepancies at 1e-6 relative.");
}
if (failed > 0) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
