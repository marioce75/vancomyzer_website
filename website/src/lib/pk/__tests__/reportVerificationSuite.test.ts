/**
 * Report verification suite: section 10 ("cases the next release should
 * survive") of the external review "Vancomyzer: international comparison and
 * improvement plan", 15 Sep 2026.
 *
 * Run from the website directory:
 *   npm run test:report-suite
 *   npx tsx src/lib/pk/__tests__/reportVerificationSuite.test.ts
 *
 * Each entry in CHECKS has an id, a report reference and a status:
 *   REQUIRED  Must pass against the current code. Any REQUIRED failure sets
 *             exit code 1.
 *   PENDING   Desired behavior for an open issue owned by another workstream
 *             (owner and one-line reason are recorded). PENDING checks still
 *             run and print "PENDING (still failing)" or
 *             "PENDING → NOW PASSING (promote to REQUIRED)". They never fail
 *             the run. Change the status to REQUIRED in the same change that
 *             makes the check pass.
 *
 * Like the other files in this folder, this is a plain tsx script with no test
 * framework. The API route (src/app/api/calculate/route.ts) cannot be imported
 * without Next.js, auth and database side effects, so validation checks call
 * validateExistingRegimenRequest and the engine entry points directly.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

import { computeInitialRegimen, type InitialRegimenResult } from "../../initialRegimen";
import { parseClinicalNumber } from "../../parseClinicalNumber";
import {
  COLIN_2019,
  COLIN_2019_PARAMETERS,
  computeBmi,
  highBmiAdvisory,
  modelShortName,
  renalCovariateDescription,
} from "../modelRegistry";
import { buildPriorParameters, type PriorParameters } from "../posterior/buildPriorParameters";
import { simulateCandidateExposure } from "../recommend/simulateCandidateExposure";
import { runExistingRegimenPipeline, type ExistingRegimenPipelineInput } from "../runExistingRegimenPipeline";
import { computeExposure, concentrationAtTime, type TwoCompartmentParameters } from "../steadyStateTwoCompartment";
import type { NormalizedLevel, NormalizedPatient, NormalizedRegimen } from "../types";
import { validateExistingRegimenRequest } from "../validate/validateExistingRegimenRequest";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type CheckStatus = "REQUIRED" | "PENDING";

/** Collects every failed expectation in a check, so one run reports all of them. */
class CheckContext {
  readonly failures: string[] = [];
  readonly details: string[] = [];

  expect(condition: boolean, message: string): void {
    if (!condition) this.failures.push(message);
  }

  /** Measured values worth printing whether or not the check passes. */
  detail(text: string): void {
    this.details.push(text);
  }
}

interface CheckDefinition {
  id: string;
  ref: string;
  title: string;
  status: CheckStatus;
  /** PENDING checks: the workstream that owns the fix. */
  owner?: string;
  /** PENDING checks: one line on why the check cannot pass yet. */
  reason?: string;
  run: (c: CheckContext) => void;
}

export interface CheckOutcome {
  id: string;
  ref: string;
  title: string;
  status: CheckStatus;
  owner?: string;
  reason?: string;
  passed: boolean;
  result: string;
  failures: string[];
  details: string[];
}

const ENGINE_SESSION = "engine session";

// ---------------------------------------------------------------------------
// Numeric and formatting helpers
// ---------------------------------------------------------------------------

function relDiff(actual: number, expected: number): number {
  if (actual === expected) return 0;
  return Math.abs(actual - expected) / Math.max(Math.abs(expected), Number.MIN_VALUE);
}

function within(actual: number | undefined, expected: number, relativeTolerance: number): boolean {
  return (
    typeof actual === "number" &&
    Number.isFinite(actual) &&
    Number.isFinite(expected) &&
    relDiff(actual, expected) <= relativeTolerance
  );
}

function n(value: number | null | undefined, digits = 3): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : String(value);
}

function signedPct(fraction: number, digits = 2): string {
  const percent = fraction * 100;
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(digits)}%`;
}

function show(value: unknown): string {
  return typeof value === "number" ? String(value) : JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Inputs and engine wrappers
// ---------------------------------------------------------------------------

type Sex = "male" | "female" | "";

function patient(age: number, weight_kg: number, scr: number, height_cm = 0, sex: Sex = ""): NormalizedPatient {
  return { age, weight_kg, height_cm, sex, serum_creatinine_mg_dl: scr };
}

function level(value_mcg_ml: number, time_since_last_dose_hours: number, collection_time = ""): NormalizedLevel {
  return { value_mcg_ml, collection_time, time_since_last_dose_hours };
}

/** buildPriorParameters ignores the regimen; any valid one will do. */
const PRIOR_REGIMEN: NormalizedRegimen = { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 };

function prior(p: NormalizedPatient): PriorParameters {
  return buildPriorParameters(p, PRIOR_REGIMEN);
}

function pkOf(p: { CL: number; V1: number; Q: number; V2: number }): TwoCompartmentParameters {
  return { CL: p.CL, V1: p.V1, Q: p.Q, V2: p.V2 };
}

/** A valid steady-state peak and trough from the same interval (pattern of existingRegimen Case 26). */
const TWO_LEVEL_REGIMEN = { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1, doses_given: 6 };
const TWO_LEVELS: NormalizedLevel[] = [
  level(30, 2, "2026-03-15T08:00:00Z"),
  level(13, 11.5, "2026-03-15T17:30:00Z"),
];

interface CurvePoint {
  time_hours: number;
  concentration: number;
}

interface OptionView {
  dose_mg: number;
  interval_hours: number;
  auc24: number;
  peak: number;
  trough: number;
  is_recommended?: boolean;
  interpretation_summary?: string;
  quick_summary?: string;
  clinical_note?: string;
}

/** The response fields this suite reads. Initial and existing-regimen responses share them. */
interface ResponseView {
  auc24: number;
  peak: number;
  trough: number;
  recommended_dose: string;
  recommended_interval_hours: number;
  interpretation_summary: string;
  assumptions: string[];
  limitations: string[];
  curve: CurvePoint[];
  frequency_options: OptionView[];
  documentation_preview: { quick_summary: string; clinical_note: string };
  pk_parameters: {
    CL: number;
    V1: number;
    Q: number;
    V2: number;
    scr: number;
    weight_kg?: number;
    pk_model_name?: string;
    used_posterior_refinement: boolean;
  };
  fit_diagnostic?: { prior_CL: number; prior_V1: number };
  timing_warnings?: string[];
}

type ExistingOutcome =
  | { rejected: true; message: string; fieldErrors: Record<string, string>; raw: unknown }
  | { rejected: false; response: ResponseView; raw: unknown };

/**
 * runExistingRegimenPipeline with the loose request shapes the route passes
 * (height_cm, sex and any extra fields travel through untyped, as in the route).
 */
function runExisting(patientInput: object, regimen: object, levels: NormalizedLevel[], extraTopLevel: object = {}): ExistingOutcome {
  const request = { ...extraTopLevel, patient: patientInput, regimen, levels };
  const raw: unknown = runExistingRegimenPipeline(request as unknown as ExistingRegimenPipelineInput);
  const maybeError = raw as { ok?: unknown; message?: unknown; field_errors?: Record<string, string> };
  if (maybeError.ok === false) {
    return { rejected: true, message: String(maybeError.message ?? ""), fieldErrors: maybeError.field_errors ?? {}, raw };
  }
  return { rejected: false, response: raw as ResponseView, raw };
}

function mustAccept(c: CheckContext, outcome: ExistingOutcome, label: string): ResponseView | null {
  if (outcome.rejected) {
    c.expect(false, `${label}: the existing-regimen pipeline rejected a valid request: ${JSON.stringify(outcome.fieldErrors)}`);
    return null;
  }
  return outcome.response;
}

function viewOf(result: InitialRegimenResult): ResponseView {
  return result as unknown as ResponseView;
}

/** Every string anywhere in a response (notes, assumptions, limitations, options, details). */
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) collectStrings((value as Record<string, unknown>)[key], out);
  }
  return out;
}

/** Numeric fields at any object depth whose key mentions AUC, except the top-level auc24. */
function aucFields(value: unknown, path = ""): Array<{ path: string; value: number }> {
  const found: Array<{ path: string; value: number }> = [];
  if (value === null || typeof value !== "object" || Array.isArray(value)) return found;
  for (const key of Object.keys(value)) {
    const child = (value as Record<string, unknown>)[key];
    const childPath = path ? `${path}.${key}` : key;
    if (typeof child === "number" && /auc/i.test(key) && childPath !== "auc24") {
      found.push({ path: childPath, value: child });
    } else if (child !== null && typeof child === "object" && !Array.isArray(child)) {
      found.push(...aucFields(child, childPath));
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Independent reference implementations (written for this suite, not imported)
// ---------------------------------------------------------------------------

/** Colin 2019 Table 3 values as published, typed in here so registry drift is caught. */
const PUBLISHED_COLIN_2019 = {
  thetaCL: 5.31,
  thetaV1: 42.9,
  thetaV2: 41.7,
  thetaQ: 3.22,
  pma50Weeks: 46.4,
  hillMaturation: 2.89,
  age50DeclineYears: 61.6,
  hillDecline: 2.24,
  thetaSCr: 0.649,
};

/** Colin 2019 adult covariate model (PMA, FMat, FDecline, SCRstd, FSCR, allometry). */
function colin2019Reference(age: number, weight_kg: number, scr: number): TwoCompartmentParameters {
  const T = PUBLISHED_COLIN_2019;
  const pmaYears = age + 40 / 52;
  const pmaWeeks = pmaYears * 52;
  const fMat = Math.pow(pmaWeeks, T.hillMaturation) / (Math.pow(pmaWeeks, T.hillMaturation) + Math.pow(T.pma50Weeks, T.hillMaturation));
  const fDecline = 1 / (1 + Math.pow(pmaYears / T.age50DeclineYears, T.hillDecline));
  const scrStd = Math.exp(-1.228 + 0.672 * Math.log10(pmaYears) + 6.27 * Math.exp(-3.11 * pmaYears));
  const fScr = Math.exp(-T.thetaSCr * (scr - scrStd));
  const size = weight_kg / 70;
  return {
    CL: T.thetaCL * Math.pow(size, 0.75) * fMat * fDecline * fScr,
    V1: T.thetaV1 * size,
    V2: T.thetaV2 * size,
    Q: T.thetaQ * Math.pow(size, 0.75),
  };
}

function hybridRates(pk: TwoCompartmentParameters): { alpha: number; beta: number; k21: number } {
  const k10 = pk.CL / pk.V1;
  const k12 = pk.Q / pk.V1;
  const k21 = pk.Q / pk.V2;
  const sum = k10 + k12 + k21;
  const root = Math.sqrt(sum * sum - 4 * k10 * k21);
  return { alpha: (sum + root) / 2, beta: (sum - root) / 2, k21 };
}

/** Closed-form concentration t hours after the start of ONE intermittent infusion. */
function singleDoseConcentration(pk: TwoCompartmentParameters, dose_mg: number, T_inf: number, t: number): number {
  if (t <= 0) return 0;
  const { alpha, beta, k21 } = hybridRates(pk);
  const rate = dose_mg / T_inf;
  const phases: Array<[number, number]> = [
    [alpha, (alpha - k21) / (pk.V1 * (alpha - beta))],
    [beta, (k21 - beta) / (pk.V1 * (alpha - beta))],
  ];
  let concentration = 0;
  for (const [lambda, coefficient] of phases) {
    const scale = (rate * coefficient) / lambda;
    concentration +=
      t <= T_inf
        ? scale * (1 - Math.exp(-lambda * t))
        : scale * (1 - Math.exp(-lambda * T_inf)) * Math.exp(-lambda * (t - T_inf));
  }
  return concentration;
}

/** Fixed-step RK4 on the two-compartment ODEs for one infusion; shares no algebra with the closed forms. */
function odeSingleDoseConcentration(pk: TwoCompartmentParameters, dose_mg: number, T_inf: number, t_end: number): number {
  const dt = 0.001;
  const k10 = pk.CL / pk.V1;
  const k12 = pk.Q / pk.V1;
  const k21 = pk.Q / pk.V2;
  const infusionSteps = Math.round(T_inf / dt);
  const steps = Math.round(t_end / dt);
  let central = 0;
  let peripheral = 0;
  for (let step = 0; step < steps; step++) {
    const input = step < infusionSteps ? dose_mg / T_inf : 0;
    const d1 = (a1: number, a2: number) => input - (k10 + k12) * a1 + k21 * a2;
    const d2 = (a1: number, a2: number) => k12 * a1 - k21 * a2;
    const p1 = d1(central, peripheral);
    const q1 = d2(central, peripheral);
    const p2 = d1(central + (dt / 2) * p1, peripheral + (dt / 2) * q1);
    const q2 = d2(central + (dt / 2) * p1, peripheral + (dt / 2) * q1);
    const p3 = d1(central + (dt / 2) * p2, peripheral + (dt / 2) * q2);
    const q3 = d2(central + (dt / 2) * p2, peripheral + (dt / 2) * q2);
    const p4 = d1(central + dt * p3, peripheral + dt * q3);
    const q4 = d2(central + dt * p3, peripheral + dt * q3);
    central += (dt / 6) * (p1 + 2 * p2 + 2 * p3 + p4);
    peripheral += (dt / 6) * (q1 + 2 * q2 + 2 * q3 + q4);
  }
  return central / pk.V1;
}

function simpson(f: (t: number) => number, a: number, b: number, intervals = 2000): number {
  const h = (b - a) / intervals;
  let sum = f(a) + f(b);
  for (let i = 1; i < intervals; i++) sum += (i % 2 === 1 ? 4 : 2) * f(a + i * h);
  return (sum * h) / 3;
}

/** AUC of ONE dose between t0 and t1, split at the end of infusion where the curve has a kink. */
function singleDoseAuc(pk: TwoCompartmentParameters, dose_mg: number, T_inf: number, t0: number, t1: number): number {
  const f = (t: number) => singleDoseConcentration(pk, dose_mg, T_inf, t);
  return t0 < T_inf && t1 > T_inf ? simpson(f, t0, T_inf) + simpson(f, T_inf, t1) : simpson(f, t0, t1);
}

// ---------------------------------------------------------------------------
// Response-text helpers
// ---------------------------------------------------------------------------

const EXPOSURE_STATEMENT = /AUC24:?\s+(-?\d+(?:\.\d+)?)\s*mg.h\/L;\s*peak\s+(-?\d+(?:\.\d+)?)(?:\s*mcg\/mL)?;\s*trough\s+(-?\d+(?:\.\d+)?)/g;

function expectExposureText(
  c: CheckContext,
  label: string,
  text: string | undefined,
  expected: { auc24: number; peak: number; trough: number },
): void {
  const pattern = new RegExp(EXPOSURE_STATEMENT.source, "g");
  let match: RegExpExecArray | null;
  let statements = 0;
  while ((match = pattern.exec(text ?? "")) !== null) {
    statements++;
    const auc24 = Number(match[1]);
    const peak = Number(match[2]);
    const trough = Number(match[3]);
    c.expect(
      auc24 === expected.auc24 && peak === expected.peak && trough === expected.trough,
      `${label}: text says AUC24 ${auc24}, peak ${peak}, trough ${trough}; numeric fields are ${expected.auc24}, ${expected.peak}, ${expected.trough}`,
    );
  }
  c.expect(statements > 0, `${label}: no "AUC24 …; peak …; trough …" statement found`);
}

const MODEL_LABEL_PATTERNS = [
  /\(([^()]+?) renal covariate\)/g,
  /[Aa]dult prior model(?: explicit in code)?: ([^;.]+?) two-compartment/g,
  /direct ([^()]+?) covariate/g,
  /using the ([^;.]+?) two-compartment adult population prior/g,
];

function modelLabelsIn(text: string): string[] {
  const labels: string[] = [];
  for (const source of MODEL_LABEL_PATTERNS) {
    const pattern = new RegExp(source.source, "g");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) labels.push(match[1].trim());
  }
  return labels;
}

function expectModelLabels(c: CheckContext, label: string, texts: string[], modelId: string | undefined): string[] {
  const expected = modelShortName(modelId);
  const labels = texts.map(modelLabelsIn).reduce((all, found) => all.concat(found), [] as string[]);
  c.expect(modelId === "colin_2019", `${label}: pk model id is ${modelId}, expected colin_2019`);
  c.expect(labels.length > 0, `${label}: no model label found in the notes`);
  const wrong = labels.filter((found) => found !== expected);
  c.expect(wrong.length === 0, `${label}: notes name ${JSON.stringify(wrong)}, expected "${expected}"`);
  return labels;
}

function expectCurveMatchesExposure(
  c: CheckContext,
  label: string,
  curve: CurvePoint[],
  tau: number,
  peak: number,
  trough: number,
): { max: number; min: number } | null {
  if (!Array.isArray(curve) || curve.length === 0) {
    c.expect(false, `${label}: curve is missing`);
    return null;
  }
  const end = curve[curve.length - 1].time_hours;
  const finalInterval = curve.filter((point) => point.time_hours >= end - tau - 1e-9);
  const max = Math.max(...finalInterval.map((point) => point.concentration));
  const min = Math.min(...finalInterval.map((point) => point.concentration));
  c.expect(within(max, peak, 0.05), `${label}: curve max over the final interval ${n(max, 2)} vs peak ${peak} (${signedPct(max / peak - 1, 1)})`);
  c.expect(within(min, trough, 0.05), `${label}: curve min over the final interval ${n(min, 2)} vs trough ${trough} (${signedPct(min / trough - 1, 1)})`);
  return { max, min };
}

/** Text that belonged to the retired custom obesity branch and must not reach any output. */
const RETIRED_MODEL_MARKERS = [
  "Smit 2020 + Zhang",
  "Obesity Model (Smit",
  "(0.83/SCr)^0.80",
  "Vancomyzer Obesity Model",
  "custom obesity model",
  "scaled to FFM",
];

// ---------------------------------------------------------------------------
// REQUIRED checks
// ---------------------------------------------------------------------------

const REQUIRED_CHECKS: CheckDefinition[] = [
  {
    id: "a",
    ref: "§10 Published anchor",
    title: "Colin 2019 anchor: 35 y, 70 kg, SCr 0.83 mg/dL",
    status: "REQUIRED",
    run: (c) => {
      const pk = prior(patient(35, 70, 0.83));
      c.expect(pk.model_name === "colin_2019", `model_name ${pk.model_name}, expected colin_2019`);
      c.expect(within(pk.CL, 4.1, 0.005), `CL ${n(pk.CL, 4)} L/h is not within 0.5% of 4.10`);
      c.expect(within(pk.V1, 42.9, 0.001), `V1 ${n(pk.V1, 4)} L is not within 0.1% of 42.9`);
      c.expect(within(pk.V2, 41.7, 0.001), `V2 ${n(pk.V2, 4)} L is not within 0.1% of 41.7`);
      c.expect(within(pk.Q, 3.22, 0.001), `Q ${n(pk.Q, 4)} L/h is not within 0.1% of 3.22`);
      const ss = computeExposure({ ...pkOf(pk), dose_mg: 1000, tau: 12, T_inf: 1 });
      c.expect(within(ss.auc24, 2000 / pk.CL, 1e-9), `steady-state AUC24 ${n(ss.auc24, 4)} differs from 2000/CL = ${n(2000 / pk.CL, 4)}`);
      c.expect(within(ss.auc24, 487.8, 0.005), `steady-state AUC24 ${n(ss.auc24, 2)} is not within 0.5% of 487.8`);
      const viaEngine = computeInitialRegimen(patient(35, 70, 0.83));
      c.expect(
        viaEngine.pk_parameters.pk_model_name === "colin_2019" && within(viaEngine.pk_parameters.CL, pk.CL, 1e-12),
        `computeInitialRegimen reports ${viaEngine.pk_parameters.pk_model_name} CL ${n(viaEngine.pk_parameters.CL, 4)}, expected colin_2019 CL ${n(pk.CL, 4)}`,
      );
      c.detail(
        `CL ${n(pk.CL, 4)} L/h (${signedPct(pk.CL / 4.1 - 1, 3)} vs 4.10), V1 ${n(pk.V1, 2)} L, V2 ${n(pk.V2, 2)} L, Q ${n(pk.Q, 3)} L/h; ` +
          `AUC24 1000 mg q12h = ${n(ss.auc24, 2)} (${signedPct(ss.auc24 / 487.8 - 1, 3)} vs 487.8)`,
      );
    },
  },
  {
    id: "b",
    ref: "§10 Second anchor",
    title: "60 y, 65 kg, SCr 0.97 anchor and independent Colin 2019 re-implementation",
    status: "REQUIRED",
    run: (c) => {
      const pk = prior(patient(60, 65, 0.97));
      c.expect(pk.model_name === "colin_2019", `model_name ${pk.model_name}, expected colin_2019`);
      c.expect(within(pk.CL, 2.551, 0.005), `CL ${n(pk.CL, 4)} L/h is not within 0.5% of 2.551`);
      const ss = computeExposure({ ...pkOf(pk), dose_mg: 750, tau: 12, T_inf: 1 });
      c.expect(within(ss.auc24, 587.9, 0.005), `steady-state AUC24 750 mg q12h ${n(ss.auc24, 2)} is not within 0.5% of 587.9`);

      const ages = [18, 25, 35, 45, 55, 61.6, 70, 80, 88, 95];
      const weights = [40, 55, 70, 85, 100, 130, 160, 200, 250];
      const scrs = [0.4, 0.5, 0.7, 0.83, 1, 1.3, 2, 3, 4.5, 6];
      const heights = [0, 150, 172, 198];
      const sexes: Sex[] = ["", "male", "female"];
      let points = 0;
      let mismatches = 0;
      let worst = 0;
      let worstAt = "none";
      for (const age of ages) {
        for (const weight of weights) {
          for (const scr of scrs) {
            for (const height of heights) {
              for (const sex of sexes) {
                const engine = prior(patient(age, weight, scr, height, sex));
                const reference = colin2019Reference(age, weight, scr);
                const difference = Math.max(
                  relDiff(engine.CL, reference.CL),
                  relDiff(engine.V1, reference.V1),
                  relDiff(engine.V2, reference.V2),
                  relDiff(engine.Q, reference.Q),
                );
                points++;
                if (difference > worst) {
                  worst = difference;
                  worstAt = `age ${age}, ${weight} kg, SCr ${scr}, height ${height}, sex "${sex}"`;
                }
                if (!(difference <= 1e-9) || engine.model_name !== "colin_2019") mismatches++;
              }
            }
          }
        }
      }
      c.expect(
        mismatches === 0,
        `${mismatches}/${points} grid points differ from the independent Colin 2019 implementation by more than 1e-9 relative or used another model (worst ${worst.toExponential(2)} at ${worstAt})`,
      );
      c.detail(
        `CL ${n(pk.CL, 4)} L/h (${signedPct(pk.CL / 2.551 - 1, 3)} vs 2.551); AUC24 750 mg q12h = ${n(ss.auc24, 2)} (${signedPct(ss.auc24 / 587.9 - 1, 3)} vs 587.9)`,
      );
      c.detail(`independent re-implementation: ${points} grid points (age 18–95, 40–250 kg, SCr 0.4–6, heights and sexes varied), max relative difference ${worst.toExponential(1)}`);
    },
  },
  {
    id: "c",
    ref: "§10 Registry consistency",
    title: "Registry parameters, equation strings and labels agree",
    status: "REQUIRED",
    run: (c) => {
      type ParamKey = keyof typeof COLIN_2019_PARAMETERS;
      type EquationKey = keyof typeof COLIN_2019.equations;
      const equations = COLIN_2019.equations;
      const placements: Array<[ParamKey, EquationKey]> = [
        ["thetaCL", "CL"],
        ["thetaV1", "V1"],
        ["thetaV2", "V2"],
        ["thetaQ", "Q"],
        ["pma50Weeks", "FMat"],
        ["hillMaturation", "FMat"],
        ["age50DeclineYears", "FDecline"],
        ["hillDecline", "FDecline"],
        ["thetaSCr", "FSCR"],
      ];
      for (const [param, equation] of placements) {
        const value = String(COLIN_2019_PARAMETERS[param]);
        c.expect(equations[equation].includes(value), `${param} = ${value} does not appear verbatim in COLIN_2019.equations.${equation}: "${equations[equation]}"`);
      }
      const allEquations = (Object.keys(equations) as EquationKey[]).map((key) => equations[key]).join("\n");
      const published = PUBLISHED_COLIN_2019 as Record<string, number>;
      for (const param of Object.keys(COLIN_2019_PARAMETERS) as ParamKey[]) {
        const value = COLIN_2019_PARAMETERS[param];
        c.expect(allEquations.includes(String(value)), `${param} = ${value} does not appear in any COLIN_2019 equation string`);
        c.expect(published[param] === value, `${param} = ${value} differs from the published Colin 2019 Table 3 value ${published[param]}`);
      }
      const shortName = modelShortName("colin_2019");
      c.expect(shortName === "Colin 2019", `modelShortName("colin_2019") = "${shortName}", expected "Colin 2019"`);
      const renal = renalCovariateDescription("colin_2019");
      c.expect(renal.includes("exp("), `renalCovariateDescription("colin_2019") does not contain "exp(": "${renal}"`);
      const referenceCheck = COLIN_2019.referenceCheck;
      const anchor = prior(patient(35, 70, 0.83));
      c.expect(
        within(anchor.CL, referenceCheck.expectedCL_L_h, 0.005) &&
          within(anchor.V1, referenceCheck.expectedV1_L, 0.001) &&
          within(anchor.V2, referenceCheck.expectedV2_L, 0.001) &&
          within(anchor.Q, referenceCheck.expectedQ_L_h, 0.001),
        `COLIN_2019.referenceCheck (${referenceCheck.input}) disagrees with buildPriorParameters (CL ${n(anchor.CL, 4)}, V1 ${n(anchor.V1, 2)}, V2 ${n(anchor.V2, 2)}, Q ${n(anchor.Q, 3)})`,
      );
      c.detail(`${placements.length} parameter placements verbatim; all parameters equal published Table 3; modelShortName "${shortName}"; renal covariate text uses exp(); referenceCheck matches the engine`);
    },
  },
  {
    id: "d",
    ref: "§10 BMI boundary / no model switch",
    title: "BMI 39.9 → 40.0 keeps Colin 2019 with allometric CL and linear V1; BMI 35–70 sweep is continuous",
    status: "REQUIRED",
    run: (c) => {
      const pairs = [
        { label: "60 y M 170 cm SCr 1.0", age: 60, height: 170, scr: 1.0, w1: 115.311, w2: 115.6 },
        { label: "35 y M 175 cm SCr 0.83", age: 35, height: 175, scr: 0.83, w1: 122.2, w2: 122.5 },
      ];
      for (const pair of pairs) {
        const below = patient(pair.age, pair.w1, pair.scr, pair.height, "male");
        const above = patient(pair.age, pair.w2, pair.scr, pair.height, "male");
        const pBelow = prior(below);
        const pAbove = prior(above);
        const bmiBelow = computeBmi(pair.w1, pair.height) ?? Number.NaN;
        const bmiAbove = computeBmi(pair.w2, pair.height) ?? Number.NaN;
        c.expect(bmiBelow < 40 && bmiAbove >= 40, `${pair.label}: fixture does not straddle BMI 40 (${n(bmiBelow)} → ${n(bmiAbove)})`);
        c.expect(
          pBelow.model_name === "colin_2019" && pAbove.model_name === "colin_2019",
          `${pair.label}: model_name ${pBelow.model_name} → ${pAbove.model_name}, expected colin_2019 for both`,
        );
        const clRatio = pAbove.CL / pBelow.CL;
        const allometric = Math.pow(pair.w2 / pair.w1, 0.75);
        const v1Ratio = pAbove.V1 / pBelow.V1;
        const weightRatio = pair.w2 / pair.w1;
        c.expect(within(clRatio, allometric, 0.01), `${pair.label}: CL ratio ${n(clRatio, 5)} is not within 1% of (w2/w1)^0.75 = ${n(allometric, 5)}`);
        c.expect(within(v1Ratio, weightRatio, 0.01), `${pair.label}: V1 ratio ${n(v1Ratio, 5)} is not within 1% of w2/w1 = ${n(weightRatio, 5)}`);
        const initialBelow = computeInitialRegimen(below);
        const initialAbove = computeInitialRegimen(above);
        c.expect(
          initialBelow.pk_parameters.pk_model_name === "colin_2019" && initialAbove.pk_parameters.pk_model_name === "colin_2019",
          `${pair.label}: computeInitialRegimen model ${initialBelow.pk_parameters.pk_model_name} → ${initialAbove.pk_parameters.pk_model_name}`,
        );
        const initialRatio = initialAbove.pk_parameters.CL / initialBelow.pk_parameters.CL;
        c.expect(within(initialRatio, allometric, 0.01), `${pair.label}: computeInitialRegimen CL ratio ${n(initialRatio, 5)} is not within 1% of ${n(allometric, 5)}`);
        const existing = mustAccept(c, runExisting(above, TWO_LEVEL_REGIMEN, TWO_LEVELS), `${pair.label} existing regimen at BMI ${n(bmiAbove, 1)}`);
        if (existing) {
          c.expect(existing.pk_parameters.pk_model_name === "colin_2019", `${pair.label}: existing-regimen model ${existing.pk_parameters.pk_model_name}, expected colin_2019`);
        }
        c.detail(
          `${pair.label}: BMI ${n(bmiBelow, 3)} → ${n(bmiAbove, 3)}; CL ${n(pBelow.CL, 4)} → ${n(pAbove.CL, 4)} L/h (ratio ${n(clRatio, 5)}, allometric ${n(allometric, 5)}); ` +
            `V1 ${n(pBelow.V1, 2)} → ${n(pAbove.V1, 2)} L (ratio ${n(v1Ratio, 5)}, weight ${n(weightRatio, 5)}); model colin_2019 → colin_2019`,
        );
      }

      const sweep: Array<{ age: number; height: number; sex: Sex; scr: number }> = [
        { age: 60, height: 170, sex: "male", scr: 1.0 },
        { age: 35, height: 175, sex: "male", scr: 0.83 },
        { age: 80, height: 155, sex: "female", scr: 1.4 },
        { age: 45, height: 190, sex: "female", scr: 0.6 },
        { age: 25, height: 162, sex: "male", scr: 2.5 },
      ];
      let points = 0;
      let otherModel = 0;
      let maxClStep = 0;
      let maxV1Step = 0;
      let covariateLeaks = 0;
      let firstLeak = "";
      for (const s of sweep) {
        const heightSquared = Math.pow(s.height / 100, 2);
        const firstTenth = Math.ceil(35 * heightSquared * 10);
        const lastTenth = Math.floor(70 * heightSquared * 10);
        let previous: PriorParameters | null = null;
        for (let tenth = firstTenth; tenth <= lastTenth; tenth++) {
          const weight = tenth / 10;
          const full = prior(patient(s.age, weight, s.scr, s.height, s.sex));
          points++;
          if (full.model_name !== "colin_2019") otherModel++;
          if (previous !== null) {
            maxClStep = Math.max(maxClStep, Math.abs(full.CL / previous.CL - 1));
            maxV1Step = Math.max(maxV1Step, Math.abs(full.V1 / previous.V1 - 1));
          }
          previous = full;
          const withoutCovariates = [
            patient(s.age, weight, s.scr, 0, s.sex),
            patient(s.age, weight, s.scr, s.height, ""),
            patient(s.age, weight, s.scr, 0, ""),
          ];
          for (const variant of withoutCovariates) {
            const pv = prior(variant);
            if (!within(pv.CL, full.CL, 1e-12) || !within(pv.V1, full.V1, 1e-12) || pv.model_name !== full.model_name) {
              covariateLeaks++;
              if (!firstLeak) firstLeak = `${s.age} y ${weight} kg height ${variant.height_cm} sex "${variant.sex}": CL ${n(pv.CL, 4)} vs ${n(full.CL, 4)}`;
            }
          }
        }
      }
      c.expect(otherModel === 0, `${otherModel}/${points} sweep points used a model other than colin_2019`);
      c.expect(maxClStep <= 0.01, `largest CL change for +0.1 kg is ${signedPct(maxClStep, 3)} (limit 1%)`);
      c.expect(maxV1Step <= 0.01, `largest V1 change for +0.1 kg is ${signedPct(maxV1Step, 3)} (limit 1%)`);
      c.expect(covariateLeaks === 0, `${covariateLeaks} sweep points changed CL, V1 or model when height or sex was removed (first: ${firstLeak})`);

      const withHeightAndSex = computeInitialRegimen(patient(35, 140, 0.83, 175, "male"));
      const withoutHeightAndSex = computeInitialRegimen(patient(35, 140, 0.83, 0, ""));
      c.expect(
        within(withoutHeightAndSex.pk_parameters.CL, withHeightAndSex.pk_parameters.CL, 1e-12) &&
          withHeightAndSex.recommended_dose === withoutHeightAndSex.recommended_dose &&
          withHeightAndSex.recommended_interval_hours === withoutHeightAndSex.recommended_interval_hours,
        `computeInitialRegimen at BMI 45.7: CL ${n(withHeightAndSex.pk_parameters.CL, 4)} with height and sex vs ${n(withoutHeightAndSex.pk_parameters.CL, 4)} without`,
      );
      c.detail(
        `sweep BMI 35–70 in 0.1 kg steps: ${sweep.length} patients, ${points} weights, all colin_2019; max step CL ${signedPct(maxClStep, 3)}, V1 ${signedPct(maxV1Step, 3)}; removing height and/or sex changed nothing`,
      );
    },
  },
  {
    id: "e",
    ref: "§10 High-BMI advisory",
    title: "Advisory at BMI ≥ 40 and for ≥ 120 kg without height, in both engines' limitations",
    status: "REQUIRED",
    run: (c) => {
      const bmi40 = patient(35, 122.5, 0.83, 175, "male");
      const bmi399 = patient(35, 122.2, 0.83, 175, "male");
      const noHeight = patient(35, 125, 0.83, 0, "");
      const noHeightLighter = patient(35, 119.9, 0.83, 0, "");
      const advisory40 = highBmiAdvisory(bmi40);
      const advisoryNoHeight = highBmiAdvisory(noHeight);
      c.expect(advisory40 !== null && advisory40.includes("Colin 2019"), `highBmiAdvisory at BMI 40.0 returned ${JSON.stringify(advisory40)}`);
      c.expect(highBmiAdvisory(bmi399) === null, "highBmiAdvisory at BMI 39.9 must return null");
      c.expect(advisoryNoHeight !== null && advisoryNoHeight.includes("Height was not entered"), `highBmiAdvisory for 125 kg without height returned ${JSON.stringify(advisoryNoHeight)}`);
      c.expect(highBmiAdvisory(noHeightLighter) === null, "highBmiAdvisory for 119.9 kg without height must return null");

      const isBodySizeAdvisory = (text: string) => text.includes("(40 or more)") || text.includes("Height was not entered");
      const surfaces: Array<{ label: string; limitations: (p: NormalizedPatient) => string[] | null }> = [
        { label: "computeInitialRegimen", limitations: (p) => computeInitialRegimen(p).limitations },
        {
          label: "runExistingRegimenPipeline",
          limitations: (p) => {
            const response = mustAccept(c, runExisting(p, TWO_LEVEL_REGIMEN, TWO_LEVELS), `existing regimen ${p.weight_kg} kg`);
            return response ? response.limitations : null;
          },
        },
      ];
      for (const surface of surfaces) {
        const at40 = surface.limitations(bmi40);
        if (at40) c.expect(advisory40 !== null && at40.includes(advisory40), `${surface.label}: limitations at BMI 40.0 do not include the highBmiAdvisory text`);
        const at399 = surface.limitations(bmi399);
        if (at399) c.expect(!at399.some(isBodySizeAdvisory), `${surface.label}: limitations at BMI 39.9 include a body-size advisory`);
        const withoutHeight = surface.limitations(noHeight);
        if (withoutHeight) c.expect(withoutHeight.some((text) => text.includes("Height was not entered")), `${surface.label}: 125 kg without height lacks the "Height was not entered" advisory`);
        const lighter = surface.limitations(noHeightLighter);
        if (lighter) c.expect(!lighter.some(isBodySizeAdvisory), `${surface.label}: 119.9 kg without height got a body-size advisory`);
      }
      c.detail("BMI 40.0 and 125 kg without height: advisory present; BMI 39.9 and 119.9 kg without height: absent (initial and existing-regimen limitations)");
    },
  },
  {
    id: "f",
    ref: "§10 Older adult / low SCr",
    title: "80 y, 60 kg: SCr 0.6 vs 1.0 changes CL by exp(0.649 × 0.4); entered SCr ≥ 0.4 is used unchanged",
    status: "REQUIRED",
    run: (c) => {
      const expectedRatio = Math.exp(0.649 * 0.4);
      const lowScr = patient(80, 60, 0.6);
      const referenceScr = patient(80, 60, 1.0);
      const priorRatio = prior(lowScr).CL / prior(referenceScr).CL;
      c.expect(within(priorRatio, expectedRatio, 0.005), `prior CL ratio ${n(priorRatio, 5)} is not within 0.5% of exp(0.649 × 0.4) = ${n(expectedRatio, 5)}`);
      const initialLow = computeInitialRegimen(lowScr);
      const initialReference = computeInitialRegimen(referenceScr);
      const initialRatio = initialLow.pk_parameters.CL / initialReference.pk_parameters.CL;
      c.expect(within(initialRatio, expectedRatio, 0.005), `computeInitialRegimen CL ratio ${n(initialRatio, 5)} is not within 0.5% of ${n(expectedRatio, 5)}`);
      c.expect(initialLow.pk_parameters.scr === 0.6, `computeInitialRegimen reports SCr ${initialLow.pk_parameters.scr} for an entered 0.6`);
      c.expect(initialLow.documentation_preview.clinical_note.includes("SCr: 0.6 mg/dL"), "initial clinical_note does not state the entered SCr 0.6 mg/dL");
      const existing = mustAccept(c, runExisting(lowScr, { dose_mg: 750, interval_hours: 24, infusion_duration_hours: 1 }, [level(10, 23)]), "80 y SCr 0.6 existing regimen");
      if (existing) c.expect(existing.pk_parameters.scr === 0.6, `existing-regimen pipeline reports SCr ${existing.pk_parameters.scr} for an entered 0.6`);

      let checked = 0;
      const altered: string[] = [];
      for (const age of [65, 72, 80, 88, 95]) {
        for (const weight of [45, 60, 90]) {
          for (const scr of [0.4, 0.45, 0.5, 0.55, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.6, 2.4]) {
            const used = prior(patient(age, weight, scr)).scr;
            checked++;
            if (used !== scr) altered.push(`prior age ${age} SCr ${scr} → ${used}`);
          }
        }
      }
      for (const age of [65, 80, 95]) {
        for (const scr of [0.4, 0.5, 0.6, 0.7]) {
          const used = computeInitialRegimen(patient(age, 60, scr)).pk_parameters.scr;
          checked++;
          if (used !== scr) altered.push(`computeInitialRegimen age ${age} SCr ${scr} → ${used}`);
        }
      }
      c.expect(altered.length === 0, `entered SCr ≥ 0.4 was altered: ${altered.slice(0, 5).join("; ")}`);
      c.detail(
        `CL ratio SCr 0.6/1.0 = ${n(priorRatio, 5)} (exp(0.649 × 0.4) = ${n(expectedRatio, 5)}); computeInitialRegimen ratio ${n(initialRatio, 5)}; ` +
          `${checked} SCr values ≥ 0.4 at ages 65–95 used unchanged (note: SCr 0.3 is floored to ${prior(patient(80, 60, 0.3)).scr} by buildPriorParameters)`,
      );
    },
  },
  {
    id: "g",
    ref: "§10 Exposure invariants",
    title: "Dose linearity, daily-AUC equivalence, AUC24 = dose × 24/τ ÷ CL, model self-checks",
    status: "REQUIRED",
    run: (c) => {
      const sets: Array<{ label: string; pk: TwoCompartmentParameters }> = [
        { label: "35 y/70 kg/SCr 0.83", pk: pkOf(prior(patient(35, 70, 0.83))) },
        { label: "60 y/65 kg/SCr 0.97", pk: pkOf(prior(patient(60, 65, 0.97))) },
        { label: "85 y/79 kg/SCr 4.53", pk: pkOf(prior(patient(85, 79, 4.53))) },
        { label: "25 y/140 kg/SCr 0.5", pk: pkOf(prior(patient(25, 140, 0.5))) },
      ];
      let worstLinearity = 0;
      let worstDailyAuc = 0;
      let worstFormula = 0;
      let worstIntegral = 0;
      let worstSuperposition = 0;
      let worstOde = 0;
      let minPeakGap = Number.POSITIVE_INFINITY;
      for (const { label, pk } of sets) {
        const base = computeExposure({ ...pk, dose_mg: 1000, tau: 12, T_inf: 1 });
        const doubled = computeExposure({ ...pk, dose_mg: 2000, tau: 12, T_inf: 1 });
        for (const key of ["auc24", "peak", "trough"] as const) {
          const difference = relDiff(doubled[key], 2 * base[key]);
          worstLinearity = Math.max(worstLinearity, difference);
          c.expect(difference <= 1e-9, `${label}: doubling the dose scaled ${key} by ${n(doubled[key] / base[key], 12)}, expected exactly 2`);
        }

        const q12 = simulateCandidateExposure(pk.CL, pk.V1, pk.Q, pk.V2, { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 });
        const q24 = simulateCandidateExposure(pk.CL, pk.V1, pk.Q, pk.V2, { dose_mg: 2000, interval_hours: 24, infusion_duration_hours: 2 });
        const dailyDifference = relDiff(q24.auc24, q12.auc24);
        worstDailyAuc = Math.max(worstDailyAuc, dailyDifference);
        c.expect(dailyDifference <= 1e-6, `${label}: 1 g q12h AUC24 ${n(q12.auc24, 4)} vs 2 g q24h ${n(q24.auc24, 4)}`);
        // Same daily dose given less often: higher peak and lower trough, however long the half-life.
        c.expect(
          q24.peak > q12.peak * (1 + 1e-6) && q24.trough < q12.trough * (1 - 1e-6),
          `${label}: 2 g q24h should have a higher peak and lower trough than 1 g q12h (peak ${n(q12.peak, 2)} vs ${n(q24.peak, 2)}, trough ${n(q12.trough, 2)} vs ${n(q24.trough, 2)})`,
        );
        minPeakGap = Math.min(minPeakGap, q24.peak / q12.peak - 1);

        for (const tau of [36, 48]) {
          const dose = 1500;
          const T_inf = 1.5;
          const exposure = computeExposure({ ...pk, dose_mg: dose, tau, T_inf });
          const formula = (dose * 24) / tau / pk.CL;
          const formulaDifference = relDiff(exposure.auc24, formula);
          worstFormula = Math.max(worstFormula, formulaDifference);
          c.expect(formulaDifference <= 1e-9, `${label} q${tau}h: AUC24 ${n(exposure.auc24, 4)} vs dose × 24/τ ÷ CL = ${n(formula, 4)}`);
          const f = (t: number) => concentrationAtTime({ ...pk, dose_mg: dose, tau, T_inf, t });
          const dailyFromCurve = ((simpson(f, 0, T_inf) + simpson(f, T_inf, tau)) * 24) / tau;
          const integralDifference = relDiff(dailyFromCurve, exposure.auc24);
          worstIntegral = Math.max(worstIntegral, integralDifference);
          c.expect(integralDifference <= 1e-6, `${label} q${tau}h: area under the steady-state curve × 24/τ = ${n(dailyFromCurve, 4)} vs AUC24 ${n(exposure.auc24, 4)}`);
        }

        // Self-checks for the reference functions the PENDING checks use as ground truth.
        const dose = 1000;
        const tau = 12;
        const T_inf = 1;
        const terminalHalfLife = Math.LN2 / hybridRates(pk).beta;
        const doses = Math.ceil((60 * terminalHalfLife) / tau) + 1;
        for (const t of [0.5, 1, 4, 11.5, 12]) {
          let superposed = 0;
          for (let k = 0; k < doses; k++) superposed += singleDoseConcentration(pk, dose, T_inf, t + k * tau);
          const steadyState = concentrationAtTime({ ...pk, dose_mg: dose, tau, T_inf, t });
          const difference = relDiff(superposed, steadyState);
          worstSuperposition = Math.max(worstSuperposition, difference);
          c.expect(difference <= 1e-9, `${label}: superposed single doses at t = ${t} h give ${n(superposed, 6)} vs steady-state ${n(steadyState, 6)}`);
        }
        for (const t of [0.5, 1, 6, 24]) {
          const ode = odeSingleDoseConcentration(pk, dose, T_inf, t);
          const closedForm = singleDoseConcentration(pk, dose, T_inf, t);
          const difference = relDiff(closedForm, ode);
          worstOde = Math.max(worstOde, difference);
          c.expect(difference <= 1e-6, `${label}: closed-form single dose at t = ${t} h ${n(closedForm, 6)} vs ODE ${n(ode, 6)}`);
        }
      }
      c.detail(
        `${sets.length} parameter sets: dose doubling max deviation ${worstLinearity.toExponential(1)}; 1 g q12h vs 2 g q24h AUC24 ${worstDailyAuc.toExponential(1)} (q24h peak higher by at least ${signedPct(minPeakGap, 1)}); ` +
          `q36h/q48h formula ${worstFormula.toExponential(1)}, curve area ${worstIntegral.toExponential(1)}; self-checks: superposition ${worstSuperposition.toExponential(1)}, RK4 ODE ${worstOde.toExponential(1)}`,
      );
    },
  },
  {
    id: "h",
    ref: "§10 Invalid / extreme inputs",
    title: "Age < 18, non-positive level and during-infusion level rejected; severe renal impairment refuses empiric dosing",
    status: "REQUIRED",
    run: (c) => {
      const base = patient(55, 70, 1.0, 175, "male");
      const regimen: NormalizedRegimen = { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 };
      const baseline = validateExistingRegimenRequest(base, regimen, [level(10, 6)]);
      c.expect(baseline.ok, `baseline request was rejected, so the rejections below prove nothing: ${JSON.stringify(baseline)}`);
      const invalid: Array<{ label: string; patient: NormalizedPatient; levels: NormalizedLevel[]; field: string }> = [
        { label: "age 17", patient: { ...base, age: 17 }, levels: [level(10, 6)], field: "patient.age" },
        { label: "level 0 mcg/mL", patient: base, levels: [level(0, 6)], field: "levels[0].value_mcg_ml" },
        { label: "level −5 mcg/mL", patient: base, levels: [level(-5, 6)], field: "levels[0].value_mcg_ml" },
        { label: "level 0.5 h into a 1 h infusion", patient: base, levels: [level(30, 0.5)], field: "levels[0].time_since_last_dose_hours" },
      ];
      for (const item of invalid) {
        const validation = validateExistingRegimenRequest(item.patient, regimen, item.levels);
        c.expect(
          !validation.ok && validation.field_errors?.[item.field] !== undefined,
          `validateExistingRegimenRequest did not reject ${item.label} on ${item.field}: ${JSON.stringify(validation)}`,
        );
        const viaPipeline = runExisting(item.patient, regimen, item.levels);
        c.expect(
          viaPipeline.rejected && viaPipeline.fieldErrors[item.field] !== undefined,
          `runExistingRegimenPipeline did not reject ${item.label} on ${item.field}`,
        );
      }
      const severe = computeInitialRegimen(patient(85, 79, 4.53, 150, "female"));
      c.expect(severe.empiric_dosing_blocked != null, "85 y F 79 kg SCr 4.53: empiric_dosing_blocked is not set");
      c.expect(
        severe.auc24 === 0 && severe.peak === 0 && severe.trough === 0 && severe.recommended_interval_hours === 0 && severe.recommended_infusion_duration_hours === 0,
        `85 y F 79 kg SCr 4.53: sentinel values not zero (AUC24 ${severe.auc24}, peak ${severe.peak}, trough ${severe.trough}, interval ${severe.recommended_interval_hours}, infusion ${severe.recommended_infusion_duration_hours})`,
      );
      c.expect(severe.frequency_options.length === 0 && severe.curve.length === 0, "85 y F 79 kg SCr 4.53: refusal still carries regimen options or a curve");
      c.detail(
        `validator and pipeline reject: ${invalid.map((item) => item.label).join(", ")}; ` +
          `85 y F 79 kg SCr 4.53 → empiric_dosing_blocked (estimated CL ${severe.empiric_dosing_blocked?.estimated_cl_l_h} L/h), AUC24/peak/trough/interval all 0`,
      );
    },
  },
  {
    id: "i",
    ref: "§10 Interface consistency",
    title: "Notes repeat the numeric fields, curves match peak/trough, model label matches, no retired-model text",
    status: "REQUIRED",
    run: (c) => {
      const anchorPatient = patient(35, 70, 0.83, 175, "male");

      const initial = computeInitialRegimen(anchorPatient);
      const initialView = viewOf(initial);
      expectExposureText(c, "initial quick_summary", initial.documentation_preview.quick_summary, initial);
      expectExposureText(c, "initial clinical_note", initial.documentation_preview.clinical_note, initial);
      expectExposureText(c, "initial interpretation_summary", initial.interpretation_summary, initial);
      for (const option of initialView.frequency_options) {
        expectExposureText(c, `initial option ${option.dose_mg} mg q${option.interval_hours}h`, option.interpretation_summary, option);
      }
      const recommended = initialView.frequency_options.filter((option) => option.is_recommended);
      c.expect(recommended.length === 1, `initial regimen flags ${recommended.length} frequency options as recommended, expected 1`);
      if (recommended.length === 1) {
        const option = recommended[0];
        c.expect(
          `${option.dose_mg} mg` === initial.recommended_dose &&
            option.interval_hours === initial.recommended_interval_hours &&
            option.auc24 === initial.auc24 &&
            option.peak === initial.peak &&
            option.trough === initial.trough,
          `recommended option ${option.dose_mg} mg q${option.interval_hours}h (${option.auc24}/${option.peak}/${option.trough}) differs from the headline ${initial.recommended_dose} q${initial.recommended_interval_hours}h (${initial.auc24}/${initial.peak}/${initial.trough})`,
        );
      }
      const initialCurve = expectCurveMatchesExposure(c, "initial regimen", initial.curve, initial.recommended_interval_hours, initial.peak, initial.trough);
      const initialLabels = expectModelLabels(
        c,
        "initial regimen",
        [initial.documentation_preview.quick_summary, initial.documentation_preview.clinical_note, initial.interpretation_summary],
        initial.pk_parameters.pk_model_name,
      );
      c.detail(
        `initial ${initial.recommended_dose} q${initial.recommended_interval_hours}h: AUC24 ${initial.auc24}, peak ${initial.peak}, trough ${initial.trough}; ` +
          `final-interval curve max ${n(initialCurve?.max, 2)}, min ${n(initialCurve?.min, 2)}; labels ${JSON.stringify(Array.from(new Set(initialLabels)))}`,
      );

      const existing = mustAccept(c, runExisting(anchorPatient, TWO_LEVEL_REGIMEN, TWO_LEVELS), "existing-regimen 2-level case");
      if (existing) {
        expectExposureText(c, "existing quick_summary", existing.documentation_preview.quick_summary, existing);
        expectExposureText(c, "existing clinical_note", existing.documentation_preview.clinical_note, existing);
        expectExposureText(c, "existing interpretation_summary", existing.interpretation_summary, existing);
        for (const option of existing.frequency_options) {
          const label = `existing option ${option.dose_mg} mg q${option.interval_hours}h`;
          expectExposureText(c, `${label} quick_summary`, option.quick_summary, option);
          expectExposureText(c, `${label} clinical_note`, option.clinical_note, option);
          expectExposureText(c, `${label} interpretation_summary`, option.interpretation_summary, option);
        }
        const existingCurve = expectCurveMatchesExposure(c, "existing regimen", existing.curve, TWO_LEVEL_REGIMEN.interval_hours, existing.peak, existing.trough);
        const existingLabels = expectModelLabels(
          c,
          "existing regimen",
          [existing.documentation_preview.quick_summary, existing.documentation_preview.clinical_note, existing.interpretation_summary],
          existing.pk_parameters.pk_model_name,
        );
        c.detail(
          `existing 1000 mg q12h, 2 levels: AUC24 ${existing.auc24}, peak ${existing.peak}, trough ${existing.trough}; ` +
            `final-interval curve max ${n(existingCurve?.max, 2)}, min ${n(existingCurve?.min, 2)}; ${existing.frequency_options.length} options consistent; labels ${JSON.stringify(Array.from(new Set(existingLabels)))}`,
        );
      }

      const geriatricObese = patient(70, 127.27, 1.65, 165, "female");
      const scanned: Array<{ label: string; value: unknown }> = [
        { label: "initial anchor", value: initial },
        { label: "initial BMI 40.0", value: computeInitialRegimen(patient(35, 122.5, 0.83, 175, "male")) },
        { label: "initial BMI 46.7", value: computeInitialRegimen(geriatricObese) },
        { label: "initial 140 kg without height", value: computeInitialRegimen(patient(35, 140, 0.83, 0, "")) },
        { label: "initial severe renal refusal", value: computeInitialRegimen(patient(85, 79, 4.53, 150, "female")) },
        { label: "existing anchor", value: existing },
        { label: "existing BMI 46.7", value: runExisting(geriatricObese, TWO_LEVEL_REGIMEN, TWO_LEVELS).raw },
        { label: "existing pulse dose BMI 46.7", value: runExisting(geriatricObese, { dose_mg: 1500, interval_hours: 12, infusion_duration_hours: 1, doses_given: 1 }, [level(16, 4)]).raw },
        { label: "existing doses_given 3", value: runExisting(anchorPatient, { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1, doses_given: 3 }, [level(8, 11.5)]).raw },
      ];
      let strings = 0;
      const hits: string[] = [];
      for (const response of scanned) {
        for (const text of collectStrings(response.value)) {
          strings++;
          for (const marker of RETIRED_MODEL_MARKERS) {
            if (text.includes(marker)) hits.push(`${response.label}: "${marker}" in "${text.slice(0, 90)}"`);
          }
        }
      }
      c.expect(hits.length === 0, `retired-model text in engine output: ${hits.slice(0, 3).join(" | ")}`);
      c.detail(`retired-model text scan: ${strings} strings from ${scanned.length} responses (normal, BMI 40–46.7, no height, refusal, pulse dose, doses_given 3): ${hits.length} hits`);
    },
  },
  {
    id: "j",
    ref: "§10 Decimal parsing",
    title: "parseClinicalNumber cases; SCr 88.4 (µmol/L typed as mg/dL) rejected by the existing-regimen validator",
    status: "REQUIRED",
    run: (c) => {
      const cases: Array<[string | number, number | null]> = [
        ["1.2", 1.2],
        ["1,2", 1.2],
        [" 0,83 ", 0.83],
        [",5", 0.5],
        ["12.", 12],
        ["-3", -3],
        [1.5, 1.5],
        ["1,234.5", null],
        ["1.234,5", null],
        ["1e3", null],
        ["+1", null],
        ["1 2", null],
        ["abc", null],
        ["", null],
        [Number.NaN, null],
      ];
      const wrong: string[] = [];
      for (const [input, expected] of cases) {
        const actual = parseClinicalNumber(input);
        if (actual !== expected) wrong.push(`${show(input)} → ${show(actual)} (expected ${show(expected)})`);
      }
      c.expect(wrong.length === 0, `parseClinicalNumber: ${wrong.join("; ")}`);

      const unitError = patient(55, 70, 88.4, 175, "male");
      const regimen: NormalizedRegimen = { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1 };
      const validation = validateExistingRegimenRequest(unitError, regimen, [level(10, 6)]);
      const scrError = validation.ok ? undefined : validation.field_errors?.["patient.serum_creatinine_mg_dl"];
      c.expect(scrError !== undefined, `validateExistingRegimenRequest accepted SCr 88.4 mg/dL: ${JSON.stringify(validation)}`);
      const viaPipeline = runExisting(unitError, regimen, [level(10, 6)]);
      c.expect(
        viaPipeline.rejected && viaPipeline.fieldErrors["patient.serum_creatinine_mg_dl"] !== undefined,
        "runExistingRegimenPipeline accepted SCr 88.4 mg/dL",
      );
      c.expect(parseClinicalNumber("88,4") === 88.4, `"88,4" parses to ${show(parseClinicalNumber("88,4"))}, so the unit check would see a different value`);
      c.detail(`${cases.length} parser cases as specified; SCr 88.4 rejected by validateExistingRegimenRequest ("${scrError}") and by runExistingRegimenPipeline (initial path: see j2)`);
    },
  },
];

// ---------------------------------------------------------------------------
// PENDING checks: desired behavior for open engine issues. They run but never fail the suite.
// ---------------------------------------------------------------------------

const PENDING_CHECKS: CheckDefinition[] = [
  {
    id: "j2",
    ref: "§10 Decimal parsing (unit errors)",
    title: "Initial-regimen inputs are validated below the route: SCr 88.4 and age 17 rejected",
    status: "PENDING",
    owner: ENGINE_SESSION,
    reason:
      "Nothing importable validates initial_regimen inputs: only the non-exported validateRequest in src/app/api/calculate/route.ts rejects SCr > 10 mg/dL or age < 18.",
    run: (c) => {
      const inputs: Array<[string, NormalizedPatient]> = [
        ["SCr 88.4 mg/dL (µmol/L typed as mg/dL)", patient(55, 70, 88.4, 175, "male")],
        ["age 17", patient(17, 70, 1.0, 175, "male")],
      ];
      for (const [label, input] of inputs) {
        let rejected = false;
        let outcome: string;
        try {
          const result = computeInitialRegimen(input) as unknown as InitialRegimenResult & { ok?: unknown; error_type?: unknown };
          rejected = result.ok === false || result.error_type === "validation_error";
          outcome = rejected
            ? "validation_error"
            : result.empiric_dosing_blocked
              ? `empiric-dosing refusal for "severe renal impairment" (CL ${result.pk_parameters.CL.toPrecision(3)} L/h)`
              : `regimen ${result.recommended_dose} q${result.recommended_interval_hours}h (CL ${n(result.pk_parameters.CL, 3)} L/h; age-18 prior CL ${n(prior({ ...input, age: 18 }).CL, 3)})`;
        } catch (error) {
          rejected = true;
          outcome = `threw ${error instanceof Error ? error.message : String(error)}`;
        }
        c.expect(rejected, `computeInitialRegimen did not reject ${label}: returned ${outcome}`);
        c.detail(`${label}: ${outcome}`);
      }
    },
  },
  {
    id: "p1",
    ref: "§10 Non-steady-state fit",
    title: "doses_given = 2 trough simulated from known PK: posterior steady-state AUC24 within 15% of truth",
    status: "PENDING",
    owner: ENGINE_SESSION,
    reason:
      "Doses 2–4 are fitted with steady-state equations (normalizeObservations and fitPosteriorParameters apply the τ accumulation factor), which biases CL for pre-steady-state levels.",
    run: (c) => {
      // A correctly specified MAP fit (superposition of the doses actually given, with the
      // engine's own prior and residual SDs) lands within 10% of truth in all three scenarios,
      // so the 15% limit leaves margin for shrinkage toward the prior.
      const scenarios = [
        { label: "55 y/80 kg/SCr 1.0, truth = prior", input: patient(55, 80, 1.0), clFactor: 1.0 },
        { label: "70 y/70 kg/SCr 1.2, truth CL = 0.8 × prior", input: patient(70, 70, 1.2), clFactor: 0.8 },
        { label: "45 y/90 kg/SCr 0.9, truth CL = 1.25 × prior", input: patient(45, 90, 0.9), clFactor: 1.25 },
      ];
      const dose = 1000;
      const tau = 12;
      const T_inf = 1;
      const hoursAfterDose2 = 11.5;
      for (const scenario of scenarios) {
        const population = prior(scenario.input);
        const truth: TwoCompartmentParameters = { CL: population.CL * scenario.clFactor, V1: population.V1, Q: population.Q, V2: population.V2 };
        // Trough before dose 3 = dose 1 at τ + 11.5 h plus dose 2 at 11.5 h (superposition).
        const simulated =
          singleDoseConcentration(truth, dose, T_inf, tau + hoursAfterDose2) + singleDoseConcentration(truth, dose, T_inf, hoursAfterDose2);
        const measured = Math.round(simulated * 10) / 10;
        const truthAuc24 = (dose * 24) / tau / truth.CL;
        const outcome = runExisting(scenario.input, { dose_mg: dose, interval_hours: tau, infusion_duration_hours: T_inf, doses_given: 2 }, [level(measured, hoursAfterDose2)]);
        if (outcome.rejected) {
          c.expect(false, `${scenario.label}: rejected ${JSON.stringify(outcome.fieldErrors)}`);
          continue;
        }
        const posteriorAuc24 = (dose * 24) / tau / outcome.response.pk_parameters.CL;
        const error = posteriorAuc24 / truthAuc24 - 1;
        c.expect(Math.abs(error) <= 0.15, `${scenario.label}: posterior AUC24 ${n(posteriorAuc24, 1)} vs truth ${n(truthAuc24, 1)} (${signedPct(error, 1)})`);
        c.detail(
          `${scenario.label}: trough ${measured} mcg/mL → posterior AUC24 ${n(posteriorAuc24, 1)} (response auc24 ${outcome.response.auc24}) vs truth ${n(truthAuc24, 1)} (${signedPct(error, 1)})`,
        );
      }
    },
  },
  {
    id: "p2",
    ref: "§10 Single-dose AUC window",
    title: "doses_given = 1: first-dose AUC24 is AUC0–24 of the dose given, distinct from the steady-state projection",
    status: "PENDING",
    owner: ENGINE_SESSION,
    reason:
      "existingRegimenEngine reports 'first-dose AUC24' as the area over 0–τ × 24/τ, which for τ ≠ 24 h is neither AUC0–24 nor the steady-state projection.",
    run: (c) => {
      // Pass when auc24 equals the single-dose AUC0–24 (computed from the response's own
      // pk_parameters), or when auc24 is the steady-state projection AND another AUC field
      // carries AUC0–24.
      const dose = 1500;
      const T_inf = 1;
      for (const tau of [8, 12]) {
        const outcome = runExisting(patient(55, 70, 1.0), { dose_mg: dose, interval_hours: tau, infusion_duration_hours: T_inf, doses_given: 1 }, [level(16, 6)]);
        if (outcome.rejected) {
          c.expect(false, `q${tau}h: rejected ${JSON.stringify(outcome.fieldErrors)}`);
          continue;
        }
        const response = outcome.response;
        const pk = pkOf(response.pk_parameters);
        const auc0to24 = singleDoseAuc(pk, dose, T_inf, 0, 24);
        const intervalExtrapolated = (singleDoseAuc(pk, dose, T_inf, 0, tau) * 24) / tau;
        const steadyState = (dose * 24) / tau / pk.CL;
        c.expect(relDiff(intervalExtrapolated, auc0to24) > 0.1, `q${tau}h: fixture does not separate AUC0–τ × 24/τ from AUC0–24`);
        const separateField = aucFields(outcome.raw).find((field) => within(field.value, auc0to24, 0.02));
        const headlineIsAuc0to24 = within(response.auc24, auc0to24, 0.02);
        const projectionWithSeparateField = within(response.auc24, steadyState, 0.02) && separateField !== undefined;
        c.expect(
          headlineIsAuc0to24 || projectionWithSeparateField,
          `q${tau}h: auc24 ${response.auc24} is not the single-dose AUC0–24 ${n(auc0to24, 1)} (${signedPct(response.auc24 / auc0to24 - 1, 1)}) ` +
            `and no separate AUC0–24 field accompanies a steady-state projection (${n(steadyState, 1)}); AUC0–τ × 24/τ = ${n(intervalExtrapolated, 1)}`,
        );
        c.detail(
          `1500 mg q${tau}h, level 16 mcg/mL at 6 h: auc24 ${response.auc24}; AUC0–24 ${n(auc0to24, 1)}; AUC0–τ × 24/τ ${n(intervalExtrapolated, 1)}; steady-state projection ${n(steadyState, 1)}` +
            (separateField ? `; ${separateField.path} = ${separateField.value}` : ""),
        );
      }
    },
  },
  {
    id: "p3",
    ref: "§10 Extreme weight",
    title: "350 kg in the existing-regimen path is rejected or used as entered, never computed as 300 kg",
    status: "PENDING",
    owner: ENGINE_SESSION,
    reason:
      "normalizePatient clamps weight to 20–300 kg before validateExistingRegimenRequest (which allows up to 400 kg), so 300–400 kg is silently computed as 300 kg.",
    run: (c) => {
      const heavy = patient(45, 350, 1.0, 180, "male");
      const regimen = { dose_mg: 1500, interval_hours: 12, infusion_duration_hours: 2 };
      const outcome = runExisting(heavy, regimen, [level(15, 11)]);
      if (outcome.rejected) {
        c.expect(outcome.fieldErrors["patient.weight_kg"] !== undefined, `rejected, but not on patient.weight_kg: ${JSON.stringify(outcome.fieldErrors)}`);
        c.detail(`rejected: ${JSON.stringify(outcome.fieldErrors)}`);
        return;
      }
      const response = outcome.response;
      const expectedPriorCl = prior(heavy).CL;
      const priorCl = response.fit_diagnostic?.prior_CL;
      const at300 = runExisting(patient(45, 300, 1.0, 180, "male"), regimen, [level(15, 11)]);
      const identicalTo300 = !at300.rejected && at300.response.auc24 === response.auc24 && at300.response.pk_parameters.CL === response.pk_parameters.CL;
      c.expect(response.pk_parameters.weight_kg === 350, `accepted with pk_parameters.weight_kg = ${response.pk_parameters.weight_kg} for an entered 350 kg`);
      c.expect(
        priorCl === undefined || within(priorCl, expectedPriorCl, 1e-9),
        `prior CL ${n(priorCl, 3)} L/h, but the Colin 2019 prior for 350 kg is ${n(expectedPriorCl, 3)} L/h (300 kg: ${n(prior(patient(45, 300, 1.0, 180, "male")).CL, 3)} L/h)`,
      );
      c.expect(!identicalTo300, "output is identical to the same request at 300 kg");
      c.detail(`accepted; weight used ${response.pk_parameters.weight_kg} kg; prior CL ${n(priorCl, 3)} L/h (350 kg prior ${n(expectedPriorCl, 3)}); AUC24 ${response.auc24}${identicalTo300 ? ", identical to the 300 kg request" : ""}`);
    },
  },
  {
    id: "p4",
    ref: "§10 Late draw / missed dose",
    title: "Level 23.5 h after the last dose on q12h is rejected, or flagged and not fitted as an on-time trough",
    status: "PENDING",
    owner: ENGINE_SESSION,
    reason:
      "For doses_given 2–4 the validator only warns and normalizeObservations clamps the sample time to τ, so a late level is fitted as an on-time trough (the steady-state path rejects it).",
    run: (c) => {
      const input = patient(60, 80, 1.1, 178, "male");
      const variants: Array<{ label: string; doses_given: number | undefined }> = [
        { label: "steady state (doses_given unset)", doses_given: undefined },
        { label: "doses_given = 3", doses_given: 3 },
      ];
      for (const variant of variants) {
        const regimen = { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1, doses_given: variant.doses_given };
        const late = runExisting(input, regimen, [level(9, 23.5)]);
        if (late.rejected) {
          c.detail(`${variant.label}: rejected (${Object.keys(late.fieldErrors).join(", ")})`);
          continue;
        }
        const onTime = runExisting(input, regimen, [level(9, 12)]);
        const onTimeCl = onTime.rejected ? Number.NaN : onTime.response.pk_parameters.CL;
        const lateCl = late.response.pk_parameters.CL;
        const flagged = (late.response.timing_warnings ?? []).length > 0;
        const fittedAsOnTime = within(lateCl, onTimeCl, 1e-6);
        c.expect(
          flagged && !fittedAsOnTime,
          `${variant.label}: accepted ${flagged ? "with a timing warning" : "without a warning"}; posterior CL ${n(lateCl, 4)} L/h ${fittedAsOnTime ? "is identical to" : "differs from"} the fit of the same level at 12 h (${n(onTimeCl, 4)} L/h)`,
        );
        c.detail(`${variant.label}: accepted, warning: ${flagged ? `"${(late.response.timing_warnings ?? [])[0].slice(0, 70)}…"` : "none"}; CL late ${n(lateCl, 4)} vs on-time ${n(onTimeCl, 4)} L/h`);
      }
    },
  },
  {
    id: "p5",
    ref: "§10 Administration history",
    title: "Loading dose then maintenance change gets an explicit unsupported/abstention message",
    status: "PENDING",
    owner: ENGINE_SESSION,
    reason:
      "The API has no administration-history input: loading doses, regimen changes, missed or held doses and actual infusion end times are silently ignored and a uniform regimen is assumed.",
    run: (c) => {
      // Field names for the history are provisional; align them with the contract the engine session defines.
      const input = patient(62, 85, 1.1, 180, "male");
      const regimen = { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1, doses_given: 3 };
      const levels = [level(14, 11.5, "2026-03-15T19:30:00Z")];
      const history = [
        { dose_mg: 2000, start_time: "2026-03-14T08:00:00Z", infusion_duration_hours: 2 },
        { dose_mg: 1000, start_time: "2026-03-14T20:00:00Z", infusion_duration_hours: 1 },
        { dose_mg: 1000, start_time: "2026-03-15T08:00:00Z", infusion_duration_hours: 1 },
      ];
      const withHistory = runExisting(input, { ...regimen, loading_dose_mg: 2000, administration_history: history }, levels, {
        administration_history: history,
        dose_history: history,
      });
      const withoutHistory = runExisting(input, regimen, levels);
      const mentionsHistory = /(dose|dosing|administration) history|loading dose|regimen change/i;
      const saysUnsupported = /not supported|unsupported|not modell?ed|cannot model|cannot be modell?ed|not accounted|abstain|ignored/i;
      const explicit = (texts: string[]) => texts.filter((text) => mentionsHistory.test(text) && saysUnsupported.test(text));
      if (withHistory.rejected) {
        const messages = [withHistory.message, ...Object.keys(withHistory.fieldErrors).map((key) => withHistory.fieldErrors[key])];
        const found = explicit(messages);
        c.expect(found.length > 0, `rejected, but no message says the administration history is unsupported: ${JSON.stringify(messages).slice(0, 240)}`);
        c.detail(`rejected: "${(found[0] ?? withHistory.message).slice(0, 100)}"`);
        return;
      }
      const found = explicit(collectStrings(withHistory.raw));
      const historyChangedFit = !withoutHistory.rejected && !within(withHistory.response.pk_parameters.CL, withoutHistory.response.pk_parameters.CL, 1e-9);
      c.expect(
        found.length > 0,
        historyChangedFit
          ? "accepted and the history changed the fit, but no text states how it was handled; if histories are now modelled, update this check to verify the modelled result"
          : `accepted; posterior CL ${n(withHistory.response.pk_parameters.CL, 4)} L/h and AUC24 ${withHistory.response.auc24} are identical to the request without the history, and no text says the history was not modelled`,
      );
      c.detail(
        found.length > 0
          ? `explicit message: "${found[0].slice(0, 100)}"`
          : historyChangedFit
            ? "the administration history changed the fit"
            : "2000 mg loading dose and history fields silently ignored",
      );
    },
  },
  {
    id: "p6",
    ref: "§10 Dialysis / RRT",
    title: "Dialysis/RRT status is part of the API input contract",
    status: "PENDING",
    owner: ENGINE_SESSION,
    reason:
      "Neither CalculateRequestPatient (src/types/calculator.ts) nor validateRequest (src/app/api/calculate/route.ts) has a dialysis/RRT field, although Colin 2019 scope excludes renal replacement therapy.",
    run: (c) => {
      const rrtField = /dialysis|renal_replacement|\brrt\b|\bcrrt\b/i;
      const contract = readFileSync(resolve(__dirname, "../../../types/calculator.ts"), "utf8");
      const patientContract = /export interface CalculateRequestPatient\s*\{([^}]*)\}/.exec(contract)?.[1] ?? "";
      c.expect(patientContract !== "", "CalculateRequestPatient not found in src/types/calculator.ts");
      c.expect(rrtField.test(patientContract), `CalculateRequestPatient has no dialysis/RRT field: {${patientContract.replace(/\s+/g, " ").trim()}}`);
      const route = readFileSync(resolve(__dirname, "../../../app/api/calculate/route.ts"), "utf8");
      const validator = /function validateRequest\([\s\S]*?\n\}/.exec(route)?.[0] ?? "";
      c.expect(validator !== "", "validateRequest not found in src/app/api/calculate/route.ts");
      c.expect(rrtField.test(validator), "validateRequest in src/app/api/calculate/route.ts does not read a dialysis/RRT field");
      c.detail(`CalculateRequestPatient RRT field: ${rrtField.test(patientContract) ? "present" : "absent"}; route validateRequest RRT handling: ${rrtField.test(validator) ? "present" : "absent"}`);
    },
  },
  {
    id: "p7",
    ref: "§10 Level-pair chronology",
    title: "Trough before dose N+1 then peak after dose N+1, entered in that order, is accepted",
    status: "PENDING",
    owner: ENGINE_SESSION,
    reason:
      "validateExistingRegimenRequest compares level pairs in entry order, so a later level with a shorter time since dose is read as inconsistent (the same pair entered peak-first is accepted).",
    run: (c) => {
      const input = patient(55, 70, 1.0, 175, "male");
      const regimen: NormalizedRegimen = { dose_mg: 1000, interval_hours: 12, infusion_duration_hours: 1, doses_given: 6 };
      // Dose N at 08:00 and dose N+1 at 20:00 (1 h infusions): trough 19:30 (11.5 h after dose N), peak 22:00 (2 h after dose N+1).
      const trough = level(12, 11.5, "2026-03-15T19:30:00Z");
      const peak = level(30, 2, "2026-03-15T22:00:00Z");
      const inOrder = validateExistingRegimenRequest(input, regimen, [trough, peak]);
      const peakFirst = validateExistingRegimenRequest(input, regimen, [peak, trough]);
      c.expect(inOrder.ok, `trough-then-peak rejected: ${JSON.stringify(inOrder.ok ? {} : inOrder.field_errors)}`);
      c.detail(`trough 19:30 then peak 22:00: ${inOrder.ok ? "accepted" : "rejected"}; same pair entered peak-first: ${peakFirst.ok ? "accepted" : "rejected"}`);
    },
  },
];

export const CHECKS: CheckDefinition[] = [...REQUIRED_CHECKS, ...PENDING_CHECKS];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function runReportVerificationSuite(): CheckOutcome[] {
  return CHECKS.map((check) => {
    const context = new CheckContext();
    try {
      check.run(context);
    } catch (error) {
      context.failures.push(`threw: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    }
    const passed = context.failures.length === 0;
    const result =
      check.status === "REQUIRED"
        ? passed
          ? "PASS"
          : "FAIL"
        : passed
          ? "PENDING → NOW PASSING (promote to REQUIRED)"
          : "PENDING (still failing)";
    return {
      id: check.id,
      ref: check.ref,
      title: check.title,
      status: check.status,
      owner: check.owner,
      reason: check.reason,
      passed,
      result,
      failures: context.failures,
      details: context.details,
    };
  });
}

function printReport(outcomes: CheckOutcome[]): void {
  console.log("Vancomyzer report verification suite (§10 cases the next release should survive)");
  for (const outcome of outcomes) {
    console.log(`\n[${outcome.result}] ${outcome.id}  ${outcome.ref}: ${outcome.title}`);
    if (outcome.status === "PENDING") console.log(`  owner: ${outcome.owner}. Reason: ${outcome.reason}`);
    for (const detail of outcome.details) console.log(`  · ${detail}`);
    for (const failure of outcome.failures) console.log(`  ✗ ${failure}`);
  }

  const header = ["ID", "Report reference", "Status", "Result"];
  const rows = outcomes.map((outcome) => [outcome.id, outcome.ref, outcome.status, outcome.result]);
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map((row) => row[column].length)));
  const format = (cells: string[]) => cells.map((cell, column) => cell.padEnd(widths[column])).join(" | ");
  console.log("\nSummary");
  console.log(format(header));
  console.log(widths.map((width) => "-".repeat(width)).join("-|-"));
  for (const row of rows) console.log(format(row));

  const required = outcomes.filter((outcome) => outcome.status === "REQUIRED");
  const pending = outcomes.filter((outcome) => outcome.status === "PENDING");
  console.log(
    `\nREQUIRED: ${required.filter((outcome) => outcome.passed).length}/${required.length} passed. ` +
      `PENDING: ${pending.filter((outcome) => !outcome.passed).length} still failing, ${pending.filter((outcome) => outcome.passed).length} now passing (promote to REQUIRED).`,
  );
}

if (typeof process !== "undefined" && process.argv[1]?.includes("reportVerificationSuite.test")) {
  const outcomes = runReportVerificationSuite();
  printReport(outcomes);
  const requiredFailures = outcomes.filter((outcome) => outcome.status === "REQUIRED" && !outcome.passed);
  if (requiredFailures.length > 0) {
    console.error(`\n${requiredFailures.length} REQUIRED check(s) failed: ${requiredFailures.map((outcome) => outcome.id).join(", ")}`);
    process.exitCode = 1;
  }
}
