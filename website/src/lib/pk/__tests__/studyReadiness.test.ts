import assert from "node:assert/strict";
import { runExistingRegimenPipeline as run } from "../runExistingRegimenPipeline";
import { runPosteriorEngine } from "../posterior/posteriorEngine";
import { normalizeObservations } from "../posterior/normalizeObservations";
import {
  predictConcentration,
  findObservationConflicts,
} from "../posterior/fitPosteriorParameters";
import { singleDoseC, colinPrior, scheduleC } from "./oracle/closedFormOracle";
import {
  forecastCase,
  type StudyCase,
} from "../../researchValidation/forecast";
import { validateRawInput } from "../validate/validateRawInput";
import { logCalculation, getAuditLog } from "../../auditLog";
let checks = 0;
function check(v: unknown, m: string) {
  assert.ok(v, m);
  checks++;
}
function near(a: number, b: number, m: string) {
  check(Math.abs(a - b) < 1e-7 * Math.max(1, Math.abs(b)), m);
}
const patient = {
  age: 35,
  weight_kg: 70,
  height_cm: 175,
  sex: "male" as const,
  serum_creatinine_mg_dl: 0.83,
};
const regimen = {
  dose_mg: 1000,
  interval_hours: 12,
  infusion_duration_hours: 1.75,
  doses_given: 3,
  steady_state_confirmed: false,
};
const level = (v: number, t: number, date = "") => ({
  value_mcg_ml: v,
  time_since_last_dose_hours: t,
  collection_time: date,
});
const pair = [
  level(20, 3, "2026-09-19T03:00:00Z"),
  level(25, 3, "2026-09-19T15:00:00Z"),
];
for (const levels of [pair, [...pair].reverse()]) {
  const out = run({ patient, regimen, levels });
  check(
    "ok" in out && out.ok === false,
    "cross-cycle finite-history rejected in both orders",
  );
}
check(
  findObservationConflicts(
    normalizeObservations(pair, { ...regimen, steady_state_confirmed: true })
      .observations,
  ).length === 0,
  "different dated samples are not duplicates",
);
check(
  findObservationConflicts(
    normalizeObservations([pair[0], { ...pair[0], value_mcg_ml: 10 }], regimen)
      .observations,
  ).length === 1,
  "real duplicates still held",
);
const prior = colinPrior({
    ...patient,
    scr_mg_dl: patient.serum_creatinine_mg_dl,
  }),
  ss = { ...regimen, doses_given: 10, steady_state_confirmed: true };
for (const t of [12, 12.2, 12.5, 13]) {
  const n = normalizeObservations([level(12, t)], ss);
  const pred = predictConcentration(
    prior,
    {
      priorCL: prior.CL,
      priorV1: prior.V1,
      priorQ: prior.Q,
      priorV2: prior.V2,
      dose_mg: 1000,
      tau: 12,
      T_inf: 1.75,
      doses_given: 10,
      horizon: "steady_state",
      observations: n.observations,
    },
    n.observations[0],
  );
  let expected = 0;
  for (let k = 0; k < 2000; k++)
    expected += singleDoseC(prior, 1000, 1.75, t + k * 12);
  near(pred, expected, "late sample agrees with independent past-infusion sum");
}
const bounded = runPosteriorEngine({
  patient: { ...patient, age: 65, weight_kg: 80, serum_creatinine_mg_dl: 6 },
  regimen: ss,
  levels: [level(25, 12)],
});
check(!!bounded.posterior_cl_bound, "policy bound triggered");
const final = { CL: bounded.CL, V1: bounded.V1, Q: bounded.Q, V2: bounded.V2 };
let expected = 0;
for (let k = 0; k < 10000; k++)
  expected += singleDoseC(final, 1000, 1.75, 12 + k * 12);
near(
  bounded.per_level_residuals[0].predicted,
  expected,
  "residuals use final parameters",
);
near(
  bounded.diagnostics.predicted_at_observations![0].predicted,
  expected,
  "objective uses final parameters",
);
near(
  bounded.diagnostics.posterior!.CL,
  bounded.CL,
  "diagnostic clearance equals exposure clearance",
);
check(
  bounded.diagnostics.pre_policy_bound!.posterior.CL !== bounded.CL,
  "original fit labeled separately",
);
const raw = { patient, regimen, levels: [level(12, 10)] };
for (const v of [NaN, Infinity, -Infinity, 0, 400.1])
  check(
    Object.keys(
      validateRawInput({ ...raw, patient: { ...patient, weight_kg: v } }),
    ).length > 0,
    "invalid weight refused",
  );
for (const v of [Infinity, 2.5, 0, 1001, "3"])
  check(
    Object.keys(
      validateRawInput({ ...raw, regimen: { ...regimen, doses_given: v } }),
    ).length > 0,
    "invalid dose count refused",
  );
for (const v of [NaN, Infinity, -1])
  check(
    Object.keys(validateRawInput({ ...raw, levels: [level(12, v)] })).length >
      0,
    "invalid time refused",
  );
for (const date of [
  "2026-02-30T12:00:00Z",
  "2026-11-01T01:30:00",
  "2026-09-19T25:00:00Z",
])
  check(
    Object.keys(validateRawInput({ ...raw, levels: [level(12, 10, date)] }))
      .length > 0,
    "ambiguous/invalid date refused",
  );
for (const date of [
  "2026-11-01T01:30:00-05:00",
  "2026-11-01T01:30:00-06:00",
  "2026-09-20T00:00:00Z",
])
  check(
    Object.keys(validateRawInput({ ...raw, levels: [level(12, 10, date)] }))
      .length === 0,
    "explicit DST offset/midnight accepted",
  );
check(
  Object.keys(
    validateRawInput({
      ...raw,
      patient: { ...patient, serum_creatinine_unit: "µmol/L" },
    }),
  ).length > 0,
  "unconverted creatinine refused",
);
for (const extra of [
  { administration_history: [{}] },
  { regimen: { ...regimen, loading_dose_mg: 2000 } },
  { patient: { ...patient, dialysis_or_rrt: true } },
  { patient: { ...patient, ecmo: true } },
]) {
  const out = run({ ...raw, ...extra });
  check(
    "ok" in out && out.ok === false,
    "unsupported inputs rejected before normalization",
  );
}
const c: StudyCase = {
  case_id: "P001",
  site_id: "S01",
  patient: { ...patient, dialysis_or_rrt: false, ecmo: false },
  covariates_available_hour: 0,
  regimen,
  history_verified_uniform: true,
  steady_state_justification: "finite history",
  cutoff_hour: 6,
  forecast_hour: 22,
  forecast_basis: "operational",
  plan_available_hour: 5,
  samples: [{ value_mcg_ml: 18, collected_hour: 3, available_hour: 5 }],
  future_doses: [
    { start_hour: 12, dose_mg: 1000, infusion_duration_hours: 1.75 },
  ],
};
const forecast = forecastCase(c);
check(forecast.status === "forecast", "valid study forecast");
near(
  forecast.forecast_mg_l!,
  scheduleC(
    forecast.final_parameters!,
    [-24, -12, 0, 12].map((time) => ({ time, dose_mg: 1000, T_inf: 1.75 })),
    22,
  ),
  "future finite forecast agrees with independent schedule oracle",
);
check(
  JSON.stringify(forecast) === JSON.stringify(forecastCase(c)),
  "deterministic forecast",
);
for (const bad of [
  { ...c, observed_mg_l: 20 },
  { ...c, cutoff_hour: 2 },
  { ...c, forecast_hour: 4 },
  { ...c, covariates_available_hour: 7 },
  { ...c, plan_available_hour: 7 },
  { ...c, history_verified_uniform: false },
  { ...c, future_doses: [] },
  { ...c, regimen: { ...regimen, steady_state_confirmed: undefined } },
  {
    ...c,
    samples: [
      ...c.samples,
      { value_mcg_ml: 20, collected_hour: 11.5, available_hour: 12 },
    ],
  },
  { ...c, patient: { ...c.patient, dialysis_or_rrt: true } },
  { ...c, future_doses: [{ ...c.future_doses[0], dose_mg: 1250 }] },
  { ...c, patient: { ...c.patient, serum_creatinine_mg_dl: Infinity } },
])
  check(
    forecastCase(bad).status !== "forecast",
    "leakage/unsupported study input refused",
  );
const steady = forecastCase({
  ...c,
  regimen: ss,
  steady_state_justification: "Verified stable regular regimen per protocol",
});
check(steady.status === "forecast", "explicit steady state accepted");
let ssExpected = singleDoseC(steady.final_parameters!, 1000, 1.75, 10);
for (let k = 0; k < 2000; k++)
  ssExpected += singleDoseC(steady.final_parameters!, 1000, 1.75, 22 + k * 12);
near(
  steady.forecast_mg_l!,
  ssExpected,
  "steady forecast agrees with independent infusion schedule",
);
const old = console.log;
let logged = "";
console.log = (v) => {
  logged += String(v);
};
try {
  logCalculation({
    mode: "existing_regimen",
    duration_ms: 4,
    status: "success",
    user_email: "private@example.test",
    inputs: {
      age: 35,
      weight_kg: 70,
      serum_creatinine_mg_dl: 0.83,
      level_count: 1,
    },
    pk_parameters: final,
  });
} finally {
  console.log = old;
}
check(
  !logged.includes("private") &&
    !logged.includes("weight_kg") &&
    !logged.includes("pk_parameters"),
  "stdout omits clinical values and identity",
);
check(
  !("inputs" in getAuditLog().at(-1)!) &&
    !("user_email" in getAuditLog().at(-1)!),
  "ring buffer sanitized",
);
console.log(`Study readiness: ${checks} checks passed.`);
