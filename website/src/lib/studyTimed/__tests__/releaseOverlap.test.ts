/**
 * Overlap with the pinned live-release calculation (ACCEPTANCE_PLAN.md).
 * Tolerance declared in advance: |new − release| ≤ 1e-12 × max(|release|, 1).
 * Run: node --import tsx --test src/lib/studyTimed/__tests__/releaseOverlap.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { computeInitialRegimen } from "../../initialRegimen";
import { buildDoseHistory, historyExposure } from "../../pk/doseHistory";
import { buildPriorParameters } from "../../pk/posterior/buildPriorParameters";
import { predictAtDraw, type TimedCaseInput } from "../predictAtDraw";
import { CALCULATION_RELEASE_COMMIT, PINNED_CALCULATION_FILES } from "../release";

const TOL = 1e-12;
const within = (a: number, b: number) => Math.abs(a - b) <= TOL * Math.max(Math.abs(b), 1);

export const OVERLAP_PATIENTS = [
  { age: 35, weight_kg: 70, scr: 0.83 },
  { age: 22, weight_kg: 58, scr: 0.6 },
  { age: 58, weight_kg: 84, scr: 0.9 },
  { age: 71, weight_kg: 77, scr: 1.2 },
  { age: 84, weight_kg: 52, scr: 1.9 },
  { age: 46, weight_kg: 160, scr: 1.0 },
  { age: 63, weight_kg: 110, scr: 2.6 },
];

function timed(p: (typeof OVERLAP_PATIENTS)[number], doses: TimedCaseInput["doses"], draw: number): TimedCaseInput {
  return {
    study_case_id: "FICT-OVERLAP", time_basis: "elapsed_hours", age_years: p.age, weight_kg: p.weight_kg,
    serum_creatinine_mg_dl: p.scr, scr_collected_at: -1, renal_replacement_therapy: false, history_complete_attested: true,
    draw_time: draw, doses,
  };
}

test("gate 0: calculation source is byte-identical to the pinned release", () => {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  execFileSync("git", ["cat-file", "-e", `${CALCULATION_RELEASE_COMMIT}^{commit}`], { cwd: root });
  const paths = [...PINNED_CALCULATION_FILES, "website/src/lib/pk", "website/src/lib/initialRegimen.ts", "website/src/app/api/calculate", "website/src/components/calculator"];
  const diff = execFileSync("git", ["diff", "--name-only", CALCULATION_RELEASE_COMMIT, "--", ...paths], { cwd: root, encoding: "utf8" }).trim();
  assert.equal(diff, "", `calculation files differ from ${CALCULATION_RELEASE_COMMIT}:\n${diff}`);
});

test("population parameters equal the Empiric tab's (computeInitialRegimen) exactly", () => {
  for (const p of OVERLAP_PATIENTS) {
    const release = computeInitialRegimen({ age: p.age, weight_kg: p.weight_kg, serum_creatinine_mg_dl: p.scr } as never).pk_parameters;
    const mine = predictAtDraw(timed(p, [{ start: 0, dose_mg: 1000, infusion_minutes: 60 }], 6)).model_parameters!;
    assert.ok(within(mine.CL_L_h, release.CL) && within(mine.V1_L, release.V1) && within(mine.Q_L_h, release.Q) && within(mine.V2_L, release.V2), JSON.stringify({ p, mine, release }));
  }
});

test("concentration at every Empiric curve time equals the release curve", () => {
  let compared = 0, maxRel = 0;
  for (const p of OVERLAP_PATIENTS) {
    const r = computeInitialRegimen({ age: p.age, weight_kg: p.weight_kg, serum_creatinine_mg_dl: p.scr } as never);
    if (!r.curve.length) continue;
    const tau = r.recommended_interval_hours;
    const doseMg = Number(String(r.recommended_dose).replace(/[^0-9.]/g, ""));
    const tInfH = Math.min(r.recommended_infusion_duration_hours, tau);
    for (const pt of r.curve) {
      if (!(pt.time_hours > 0)) continue;
      const n = Math.ceil(pt.time_hours / tau - 1e-12); // doses started strictly before t
      const doses = Array.from({ length: n }, (_, k) => ({ start: k * tau, dose_mg: doseMg, infusion_minutes: tInfH * 60 }));
      const mine = predictAtDraw(timed(p, doses, pt.time_hours));
      assert.equal(mine.status, "predicted", JSON.stringify(mine.reasons));
      const rel = Math.abs(mine.predicted_concentration_mg_l! - pt.concentration) / Math.max(Math.abs(pt.concentration), 1);
      maxRel = Math.max(maxRel, rel);
      assert.ok(within(mine.predicted_concentration_mg_l!, pt.concentration), `${JSON.stringify(p)} t=${pt.time_hours}: ${mine.predicted_concentration_mg_l} vs ${pt.concentration}`);
      compared++;
    }
  }
  assert.ok(compared > 1000, `compared ${compared}`);
  console.log(`[overlap] Empiric curve points compared: ${compared}; max scaled difference ${maxRel.toExponential(3)}`);
});

test("loading + maintenance peak and trough equal the level tabs' dose-history function", () => {
  let compared = 0;
  for (const p of OVERLAP_PATIENTS) {
    for (const [load, loadMin, maint, maintMin, tau, gap, n] of [[2000, 120, 1000, 60, 12, 12, 4], [2500, 150, 1250, 90, 8, 10, 6], [1750, 105, 750, 60, 24, 24, 3]]) {
      const regimen = { dose_mg: maint, interval_hours: tau, infusion_duration_hours: maintMin / 60, doses_given: n, loading_dose_mg: load, loading_infusion_duration_hours: loadMin / 60, loading_to_maintenance_hours: gap };
      const events = buildDoseHistory(regimen as never, { dose_mg: load, infusion_duration_hours: loadMin / 60, hours_to_first_maintenance: gap });
      const prior = buildPriorParameters({ age: p.age, weight_kg: p.weight_kg, height_cm: 0, sex: "", serum_creatinine_mg_dl: p.scr }, regimen as never);
      const release = historyExposure(prior, events, tau);
      const doses = events.map((e) => ({ start: e.time, dose_mg: e.dose_mg, infusion_minutes: e.T_inf * 60 }));
      const last = events[events.length - 1];
      const peak = predictAtDraw(timed(p, doses, last.time + last.T_inf));
      const trough = predictAtDraw(timed(p, doses, last.time + tau));
      assert.ok(within(peak.predicted_concentration_mg_l!, release.peak), `peak ${peak.predicted_concentration_mg_l} vs ${release.peak}`);
      assert.ok(within(trough.predicted_concentration_mg_l!, release.trough), `trough ${trough.predicted_concentration_mg_l} vs ${release.trough}`);
      compared += 2;
    }
  }
  console.log(`[overlap] loading+maintenance values compared: ${compared}`);
});
