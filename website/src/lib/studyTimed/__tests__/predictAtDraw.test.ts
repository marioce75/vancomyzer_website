/**
 * Reference tests for the timed-draw study workflow (see docs/study-hca/ACCEPTANCE_PLAN.md).
 * Run: node --import tsx --test src/lib/studyTimed/__tests__/predictAtDraw.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { predictAtDraw, type TimedCaseInput } from "../predictAtDraw";
import { casesFromCsv, casesFromJson, runBatch, BatchFormatError } from "../batch";
import { FICTIONAL_CASES, FICTIONAL_REFUSED_CASES } from "../fictionalCases";
import { refConcentration, refParams, type RefDose } from "./reference";

const REL_TOL_REF = 1e-8;

function base(over: Partial<TimedCaseInput> = {}): TimedCaseInput {
  return {
    study_case_id: "FICT-T",
    time_basis: "elapsed_hours",
    age_years: 60,
    weight_kg: 80,
    serum_creatinine_mg_dl: 1.0,
    scr_collected_at: -1,
    renal_replacement_therapy: false,
    history_complete_attested: true,
    draw_time: 10,
    doses: [{ start: 0, dose_mg: 1000, infusion_minutes: 60 }],
    ...over,
  };
}
const pt = (c: TimedCaseInput) => ({ age: c.age_years, weight: c.weight_kg, scr: c.serum_creatinine_mg_dl });
const refDoses = (c: TimedCaseInput, draw: number): RefDose[] =>
  c.doses.map((d) => ({ start: d.start as number, mg: d.dose_mg, minutes: d.infusion_minutes as number })).filter((d) => d.start < draw);
function predicted(c: TimedCaseInput): number {
  const r = predictAtDraw(c);
  assert.equal(r.status, "predicted", JSON.stringify(r.reasons));
  return r.predicted_concentration_mg_l as number;
}
function closeRel(a: number, b: number, tol: number, msg: string) {
  assert.ok(Math.abs(a - b) <= tol * Math.max(Math.abs(b), 1e-9), `${msg}: ${a} vs ${b} (rel ${Math.abs(a - b) / Math.abs(b)})`);
}
function matchesRef(c: TimedCaseInput, msg: string) {
  const draw = c.draw_time as number;
  closeRel(predicted(c), refConcentration(pt(c), refDoses(c, draw), draw), REL_TOL_REF, msg);
}
const codes = (c: unknown) => predictAtDraw(c).reasons.map((r) => r.code);

test("population parameters equal the independent Colin 2019 restatement", () => {
  for (const [age, weight, scr] of [[35, 70, 0.83], [18, 30, 0.1], [90, 180, 3.2], [64, 400, 10]]) {
    const r = predictAtDraw(base({ age_years: age, weight_kg: weight, serum_creatinine_mg_dl: scr }));
    const ref = refParams({ age, weight, scr });
    closeRel(r.model_parameters!.CL_L_h, ref.CL, 1e-12, "CL");
    closeRel(r.model_parameters!.V1_L, ref.V1, 1e-12, "V1");
    closeRel(r.model_parameters!.Q_L_h, ref.Q, 1e-12, "Q");
    closeRel(r.model_parameters!.V2_L, ref.V2, 1e-12, "V2");
  }
  const anchor = predictAtDraw(base({ age_years: 35, weight_kg: 70, serum_creatinine_mg_dl: 0.83 }));
  assert.equal(anchor.model_parameters!.CL_L_h.toFixed(2), "4.10", "article form (typical CL 4.10 L/h), not the ESM2 normalised form");
});

test("single dose", () => {
  for (const draw of [0.5, 1, 1.0001, 2, 6, 11.5, 23.9, 72]) matchesRef(base({ draw_time: draw }), `single dose draw ${draw}`);
  // Closed form for a 1-compartment sanity limit is not applicable; the ODE reference is the oracle.
});

test("single dose with a later dose listed: the later dose is excluded and flagged", () => {
  const withLater = base({ draw_time: 11.5, doses: [{ start: 0, dose_mg: 1500, infusion_minutes: 90 }, { start: 12, dose_mg: 1250, infusion_minutes: 90 }] });
  const without = base({ draw_time: 11.5, doses: [{ start: 0, dose_mg: 1500, infusion_minutes: 90 }] });
  const r = predictAtDraw(withLater);
  assert.equal(r.predicted_concentration_mg_l, predicted(without));
  assert.equal(r.doses_used, 1);
  assert.deepEqual(r.warnings.map((w) => w.code), ["DOSES_AFTER_DRAW_EXCLUDED"]);
});

test("loading dose plus maintenance", () => {
  const doses = [{ start: 0, dose_mg: 2500, infusion_minutes: 150 }, ...[1, 2, 3, 4].map((k) => ({ start: 8 + (k - 1) * 12, dose_mg: 1250, infusion_minutes: 90 }))];
  for (const draw of [7.9, 9.5, 19.5, 31.75, 43.9, 55.9]) matchesRef(base({ draw_time: draw, doses, age_years: 72, weight_kg: 95, serum_creatinine_mg_dl: 1.3 }), `load+maint draw ${draw}`);
});

test("delayed and held doses use the actual times, never the schedule", () => {
  const actual = base({ draw_time: 39, doses: [{ start: 0, dose_mg: 1250, infusion_minutes: 90 }, { start: 12, dose_mg: 1250, infusion_minutes: 90 }, { start: 28, dose_mg: 1250, infusion_minutes: 90 }] });
  matchesRef(actual, "delayed");
  const scheduled = base({ draw_time: 39, doses: [0, 12, 24, 36].map((s) => ({ start: s, dose_mg: 1250, infusion_minutes: 90 })) });
  assert.ok(Math.abs(predicted(actual) - predicted(scheduled)) > 1, "scheduled-dose substitution would change the result");
  const held = base({ draw_time: 47.5, doses: [0, 12, 36].map((s) => ({ start: s, dose_mg: 1000, infusion_minutes: 60 })) });
  matchesRef(held, "held dose");
  const longGap = predictAtDraw(base({ draw_time: 80, doses: [0, 60].map((s) => ({ start: s, dose_mg: 1000, infusion_minutes: 60 })) }));
  assert.deepEqual(longGap.warnings.map((w) => w.code), ["LONG_GAP_BETWEEN_DOSES"]);
});

test("timing boundaries", () => {
  const one = (draw: number, extra: TimedCaseInput["doses"] = []) => base({ draw_time: draw, doses: [{ start: 0, dose_mg: 1000, infusion_minutes: 60 }, ...extra] });
  // Draw exactly at the end of infusion: continuous with both sides, no in-progress warning.
  const atEnd = predictAtDraw(one(1));
  assert.equal(atEnd.warnings.length, 0);
  closeRel(atEnd.predicted_concentration_mg_l!, predicted(one(1 - 1e-9)), 1e-7, "left limit");
  closeRel(atEnd.predicted_concentration_mg_l!, predicted(one(1 + 1e-9)), 1e-7, "right limit");
  matchesRef(one(1), "end of infusion");
  // During an infusion: only the drug infused up to the draw counts.
  const mid = predictAtDraw(one(0.5));
  assert.deepEqual(mid.warnings.map((w) => w.code), ["INFUSION_IN_PROGRESS_AT_DRAW"]);
  closeRel(mid.predicted_concentration_mg_l!, refConcentration(pt(one(0.5)), [{ start: 0, mg: 1000, minutes: 60 }], 0.5), REL_TOL_REF, "mid-infusion");
  assert.ok(mid.predicted_concentration_mg_l! < refConcentration(pt(one(0.5)), [{ start: 0, mg: 500, minutes: 30 }], 0.5) + 1e-9);
  closeRel(mid.predicted_concentration_mg_l!, refConcentration(pt(one(0.5)), [{ start: 0, mg: 500, minutes: 30 }], 0.5), REL_TOL_REF, "equals 500 mg over the first 30 min");
  // Second dose still running at the draw.
  const second = base({ draw_time: 12.25, doses: [{ start: 0, dose_mg: 1000, infusion_minutes: 60 }, { start: 12, dose_mg: 1000, infusion_minutes: 60 }] });
  matchesRef(second, "second dose in progress");
  assert.deepEqual(predictAtDraw(second).warnings.map((w) => w.code), ["INFUSION_IN_PROGRESS_AT_DRAW"]);
  // A few seconds after the start: almost nothing infused yet, value finite and ≥ 0.
  const justStarted = predicted(one(1 / 3600));
  assert.ok(justStarted >= 0 && justStarted < 0.05);
  // Dose starting exactly at the draw is ambiguous and refused.
  assert.deepEqual(codes(one(12, [{ start: 12, dose_mg: 1000, infusion_minutes: 60 }])), ["DOSE_STARTS_AT_DRAW"]);
  // A dose starting one minute after the draw is excluded; identical result to omitting it.
  assert.equal(predicted(one(12, [{ start: 12 + 1 / 60, dose_mg: 1000, infusion_minutes: 60 }])), predicted(one(12)));
  // Draw before (or at) the first dose.
  assert.deepEqual(codes(one(-0.5)), ["NO_DOSE_BEFORE_DRAW"]);
  assert.deepEqual(codes(base({ draw_time: 0 })), ["DOSE_STARTS_AT_DRAW", "NO_DOSE_BEFORE_DRAW"]);
});

test("clock times with offsets, including a daylight-saving change", () => {
  const r = predictAtDraw(FICTIONAL_CASES.find((c) => c.input.study_case_id === "FICT-A05")!.input);
  assert.equal(r.status, "predicted");
  assert.equal(r.draw_elapsed_hours, 24.5);
  const asElapsed = base({ age_years: 64, weight_kg: 91, serum_creatinine_mg_dl: 1.4, draw_time: 24.5, doses: [{ start: 0, dose_mg: 1750, infusion_minutes: 120 }, { start: 13, dose_mg: 1250, infusion_minutes: 90 }] });
  closeRel(r.predicted_concentration_mg_l!, predicted(asElapsed), 1e-12, "datetime vs elapsed");
  matchesRef(asElapsed, "datetime case");
  const bad = ["2030-11-03T19:30", "2030-02-30T08:00Z", "2030-11-03 19:30Z", "2030-11-03T24:00Z", "2030-11-03T19:30+15:00", "tomorrow"];
  for (const t of bad) assert.ok(codes({ ...FICTIONAL_CASES[4].input, draw_time: t }).includes("INVALID_TIME"), t);
  assert.ok(codes({ ...FICTIONAL_CASES[4].input, draw_time: 24 }).includes("INVALID_TIME"), "number on a datetime basis");
  assert.ok(codes(base({ draw_time: "10" as unknown as number })).includes("INVALID_TIME"), "string on an elapsed basis");
});

test("invalid and unsupported inputs are refused with reasons and no number", () => {
  const cases: [unknown, string][] = [
    [null, "INVALID_CASE"],
    [base({ study_case_id: "MRN 123/45" }), "INVALID_STUDY_CASE_ID"],
    [base({ time_basis: "hours" as never }), "INVALID_TIME_BASIS"],
    [base({ age_years: 17 }), "UNSUPPORTED_POPULATION"],
    [base({ weight_kg: 401 }), "OUT_OF_RANGE"],
    [base({ serum_creatinine_mg_dl: 0 }), "OUT_OF_RANGE"],
    [base({ serum_creatinine_mg_dl: "1.0" as never }), "MISSING_OR_INVALID_NUMBER"],
    [base({ renal_replacement_therapy: true }), "UNSUPPORTED_RRT"],
    [base({ renal_replacement_therapy: undefined as never }), "MISSING_OR_INVALID_FLAG"],
    [base({ history_complete_attested: false }), "HISTORY_NOT_ATTESTED"],
    [base({ draw_time: undefined as never }), "MISSING_DRAW_TIME"],
    [base({ scr_collected_at: undefined as never }), "MISSING_SCR_TIME"],
    [base({ scr_collected_at: 0.5 }), "SCR_AFTER_TREATMENT_START"],
    [base({ doses: [] }), "NO_DOSES"],
    [base({ doses: [{ start: 0, dose_mg: 1000 }] }), "AMBIGUOUS_INFUSION_DURATION"],
    [base({ doses: [{ start: 0, dose_mg: 1000, infusion_minutes: 60, end: 1 }] }), "AMBIGUOUS_INFUSION_DURATION"],
    [base({ doses: [{ start: 0, dose_mg: 1000, end: 0 }] }), "INVALID_INFUSION_DURATION"],
    [base({ doses: [{ start: 0, dose_mg: 1000, infusion_minutes: 1440 }] }), "UNSUPPORTED_INFUSION_DURATION"],
    [base({ doses: [{ start: 0, dose_mg: 0, infusion_minutes: 60 }] }), "OUT_OF_RANGE"],
    [base({ doses: [{ dose_mg: 1000, infusion_minutes: 60 } as never] }), "MISSING_DOSE_START"],
    [base({ doses: [{ start: 0, dose_mg: 1000, infusion_minutes: 60 }, { start: 0, dose_mg: 1000, infusion_minutes: 60 }] }), "DUPLICATE_DOSE_TIME"],
    [base({ doses: [{ start: 0, dose_mg: 1000, infusion_minutes: 60 }, { start: 0.5, dose_mg: 1000, infusion_minutes: 60 }] }), "OVERLAPPING_INFUSIONS"],
    [{ ...base(), sex: "female" }, "UNKNOWN_FIELD"],
    [base({ doses: Array.from({ length: 501 }, (_, i) => ({ start: i * 12, dose_mg: 500, infusion_minutes: 60 })) }), "TOO_MANY_DOSES"],
  ];
  for (const [input, code] of cases) {
    const r = predictAtDraw(input);
    assert.equal(r.status, "refused", code);
    assert.equal(r.predicted_concentration_mg_l, null, code);
    assert.ok(r.reasons.some((x) => x.code === code), `${code}: got ${r.reasons.map((x) => x.code)}`);
    assert.ok(r.reasons.every((x) => x.message.length > 10), "every refusal explains itself");
  }
});

test("no level: measured results are refused everywhere and cannot influence a prediction", () => {
  for (const key of ["measured_level_mg_l", "vancomycin_level", "observed", "result", "trough", "concentration_mg_l", "lab_value", "prior_level", "outcome"]) {
    assert.ok(codes({ ...base(), [key]: 12.3 }).includes("MEASURED_RESULT_SUPPLIED"), `case.${key}`);
    assert.ok(codes(base({ doses: [{ start: 0, dose_mg: 1000, infusion_minutes: 60, [key]: 12.3 } as never] })).includes("MEASURED_RESULT_SUPPLIED"), `dose.${key}`);
  }
  const header = "study_case_id,time_basis,age_years,weight_kg,serum_creatinine_mg_dl,scr_collected_at,renal_replacement_therapy,history_complete_attested,draw_time";
  const row = "FICT-T,elapsed_hours,60,80,1,-1,false,true,10";
  const doses = "study_case_id,start,dose_mg,infusion_minutes\nFICT-T,0,1000,60\n";
  assert.equal(runBatch(casesFromCsv(`${header}\n${row}\n`, doses))[0].status, "predicted");
  assert.throws(() => casesFromCsv(`${header},measured_level\n${row},14.2\n`, doses), (e: unknown) => e instanceof BatchFormatError && e.reasons.some((r) => r.code === "MEASURED_RESULT_SUPPLIED"));
  assert.throws(() => casesFromCsv(`${header}\n${row}\n`, "study_case_id,start,dose_mg,infusion_minutes,level\nFICT-T,0,1000,60,9\n"), (e: unknown) => e instanceof BatchFormatError && e.reasons.some((r) => r.code === "MEASURED_RESULT_SUPPLIED"));
  assert.throws(() => casesFromJson(JSON.stringify({ schema: "vancomyzer-hca-timed-draw", schema_version: 1, cases: [], outcomes: [] })), (e: unknown) => e instanceof BatchFormatError && e.reasons.some((r) => r.code === "MEASURED_RESULT_SUPPLIED"));
  // The prediction modules never import outcome data.
  for (const f of ["predictAtDraw.ts", "batch.ts", "release.ts", "fictionalCases.ts"]) {
    const src = readFileSync(join(__dirname, "..", f), "utf8");
    assert.doesNotMatch(src, /from ["'][^"']*(studyDemo|Outcome|outcome)/, `${f} must not import outcomes`);
    assert.doesNotMatch(src, /\b(fetch|XMLHttpRequest|http|https|net|dgram|child_process)\b\s*\(|from ["']node:(http|https|net|dgram|child_process)/, `${f} must not do I/O`);
  }
  // Deterministic: same input → bit-identical output, independent of call order.
  const c = FICTIONAL_CASES[1].input;
  assert.equal(predicted(c), predicted(JSON.parse(JSON.stringify(c))));
});

test("fictional example cases: CSV and JSON give identical results; refused examples refuse", () => {
  const dir = join(__dirname, "..", "..", "..", "..", "docs", "study-hca", "examples");
  const fromJson = runBatch(casesFromJson(readFileSync(join(dir, "fictional-cases.json"), "utf8")));
  const fromCsv = runBatch(casesFromCsv(readFileSync(join(dir, "fictional-cases.csv"), "utf8"), readFileSync(join(dir, "fictional-doses.csv"), "utf8")));
  assert.deepEqual(fromCsv, fromJson);
  const ids = [...FICTIONAL_CASES.map((c) => c.input.study_case_id), ...FICTIONAL_REFUSED_CASES.map((c) => c.study_case_id)];
  assert.deepEqual(fromJson.map((r) => r.study_case_id), ids);
  for (const r of fromJson) assert.equal(r.status, r.study_case_id!.startsWith("FICT-R") ? "refused" : "predicted", r.study_case_id!);
  for (const fc of FICTIONAL_CASES) if (fc.input.time_basis === "elapsed_hours") matchesRef(fc.input, fc.input.study_case_id);
  // Duplicate IDs are all refused.
  const dup = runBatch([base(), base()]);
  assert.ok(dup.every((r) => r.status === "refused" && r.reasons.some((x) => x.code === "DUPLICATE_STUDY_CASE_ID")));
});
