import { validateRawInput } from "../pk/validate/validateRawInput";
import { validateExistingRegimenRequest } from "../pk/validate/validateExistingRegimenRequest";
import { runPosteriorEngine } from "../pk/posterior/posteriorEngine";
import {
  concentrationAtTime,
  finiteHistoryConcentration,
  singleDoseConcentration,
} from "../pk/steadyStateTwoCompartment";
import { MODEL_MANIFEST_VERSION } from "../pk/modelRegistry";
import type { NormalizedPatient, NormalizedRegimen } from "../pk/types";

export interface StudyCase {
  case_id: string;
  site_id: string;
  patient: NormalizedPatient & { dialysis_or_rrt: boolean; ecmo: boolean };
  covariates_available_hour: number;
  regimen: NormalizedRegimen;
  history_verified_uniform: boolean;
  steady_state_justification: string;
  cutoff_hour: number;
  forecast_hour: number;
  forecast_basis: "operational" | "dose_conditional";
  plan_available_hour: number;
  samples: {
    value_mcg_ml: number;
    collected_hour: number;
    available_hour: number;
  }[];
  future_doses: {
    start_hour: number;
    dose_mg: number;
    infusion_duration_hours: number;
  }[];
}

export type ForecastResult = {
  case_id: string;
  site_id: string;
  model_manifest: string;
  status:
    | "forecast"
    | "invalid_input"
    | "unsupported_history"
    | "fit_abstention";
  reasons: string[];
  forecast_mg_l?: number;
  forecast_hour?: number;
  cutoff_hour?: number;
  forecast_basis?: StudyCase["forecast_basis"];
  final_parameters?: { CL: number; V1: number; Q: number; V2: number };
  diagnostics?: ReturnType<typeof runPosteriorEngine>["diagnostics"];
};
const isObject = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const finite = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);
const code = (x: unknown): x is string =>
  typeof x === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(x);
function unknownKeys(o: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(o).some((k) => !allowed.includes(k));
}

/** Pure, network-free one/two-level future-concentration runner. No outcomes accepted. */
export function forecastCase(raw: unknown): ForecastResult {
  const r = isObject(raw) ? raw : {};
  const base = {
    case_id: code(r.case_id) ? r.case_id : "invalid",
    site_id: code(r.site_id) ? r.site_id : "invalid",
    model_manifest: MODEL_MANIFEST_VERSION,
  };
  const reject = (
    reason: string,
    status: ForecastResult["status"] = "invalid_input",
  ): ForecastResult => ({ ...base, status, reasons: [reason] });
  if (!code(r.case_id) || !code(r.site_id))
    return reject(
      "Coded case/site identifiers are required; do not use direct identifiers.",
    );
  if (
    unknownKeys(r, [
      "case_id",
      "site_id",
      "patient",
      "covariates_available_hour",
      "regimen",
      "history_verified_uniform",
      "steady_state_justification",
      "cutoff_hour",
      "forecast_hour",
      "forecast_basis",
      "plan_available_hour",
      "samples",
      "future_doses",
    ])
  )
    return reject(
      "Unexpected fields: outcome values and unapproved data are not accepted by the forecast runner.",
    );
  if (!isObject(r.patient) || !isObject(r.regimen))
    return reject("Patient and regimen objects are required.");
  if (
    unknownKeys(r.patient, [
      "age",
      "weight_kg",
      "height_cm",
      "sex",
      "serum_creatinine_mg_dl",
      "dialysis_or_rrt",
      "ecmo",
    ]) ||
    unknownKeys(r.regimen, [
      "dose_mg",
      "interval_hours",
      "infusion_duration_hours",
      "doses_given",
      "steady_state_confirmed",
    ])
  )
    return reject(
      "Unrecognized patient/regimen fields or unsupported dose history.",
    );
  if (r.patient.dialysis_or_rrt !== false || r.patient.ecmo !== false)
    return reject("RRT and ECMO exclusions must be explicitly assessed.");
  if (r.history_verified_uniform !== true)
    return reject(
      "Actual prior administrations must be verified as uniform; no missing, changed or interrupted doses.",
      "unsupported_history",
    );
  if (
    typeof r.regimen.steady_state_confirmed !== "boolean" ||
    !Number.isInteger(r.regimen.doses_given)
  )
    return reject(
      "Explicit horizon and known integer dose count required; no legacy steady-state inference.",
    );
  if (
    typeof r.steady_state_justification !== "string" ||
    r.steady_state_justification.length > 500 ||
    (r.regimen.steady_state_confirmed &&
      r.steady_state_justification.trim().length < 10)
  )
    return reject(
      "Document the steady-state rationale using a protocol code/explanation without identifiers.",
    );
  for (const key of [
    "covariates_available_hour",
    "cutoff_hour",
    "forecast_hour",
    "plan_available_hour",
  ])
    if (!finite(r[key])) return reject("Finite relative times are required.");
  const c = r as unknown as StudyCase;
  if (
    c.cutoff_hour < 0 ||
    c.forecast_hour <= c.cutoff_hour ||
    c.forecast_hour > 720 ||
    c.covariates_available_hour > c.cutoff_hour
  )
    return reject(
      "Forecast must follow cutoff; future renal/covariate data are forbidden.",
    );
  if (!["operational", "dose_conditional"].includes(c.forecast_basis))
    return reject("Declare operational or dose-conditional forecasting.");
  if (
    c.forecast_basis === "operational" &&
    c.plan_available_hour > c.cutoff_hour
  )
    return reject(
      "An operational forecast can only use the plan available at cutoff.",
    );
  if (!Array.isArray(c.samples) || c.samples.length < 1 || c.samples.length > 2)
    return reject(
      "This runner accepts one or two earlier fitted samples only.",
    );
  for (const s of c.samples) {
    if (
      !isObject(s) ||
      unknownKeys(s, ["value_mcg_ml", "collected_hour", "available_hour"]) ||
      !finite(s.collected_hour) ||
      !finite(s.available_hour) ||
      s.collected_hour < 0 ||
      s.available_hour < s.collected_hour ||
      s.available_hour > c.cutoff_hour ||
      s.collected_hour >= c.forecast_hour
    )
      return reject(
        "Every fitted result must be available by cutoff and collected before the outcome time.",
      );
  }
  const levels = c.samples.map((s) => ({
    value_mcg_ml: s.value_mcg_ml,
    time_since_last_dose_hours: s.collected_hour,
    collection_time: new Date(
      Date.UTC(2000, 0, 1) + s.collected_hour * 3600000,
    ).toISOString(),
  }));
  const errors = validateRawInput({
    patient: c.patient,
    regimen: c.regimen,
    levels,
  });
  if (Object.keys(errors).length)
    return reject(Object.values(errors).join(" "));
  // Every fitted sample is after the same latest administered dose at t=0.
  if (c.samples.some((s) => s.collected_hour > c.regimen.interval_hours))
    return reject(
      "Study samples must be within the same regular dosing interval; late/held-dose histories need separate eligibility.",
      "unsupported_history",
    );
  const validation = validateExistingRegimenRequest(
    c.patient,
    c.regimen,
    levels,
  );
  if (!validation.ok)
    return reject(Object.values(validation.field_errors ?? {}).join(" "));
  if (!Array.isArray(c.future_doses) || c.future_doses.length > 1000)
    return reject(
      "A bounded explicit future administration schedule is required.",
    );
  const expectedCount = Math.floor(
    (c.forecast_hour + 1e-9) / c.regimen.interval_hours,
  );
  if (c.future_doses.length !== expectedCount)
    return reject(
      "Future schedule is incomplete or irregular for this study release.",
      "unsupported_history",
    );
  for (let i = 0; i < c.future_doses.length; i++) {
    const d = c.future_doses[i];
    if (
      !isObject(d) ||
      unknownKeys(d, ["start_hour", "dose_mg", "infusion_duration_hours"]) ||
      !finite(d.start_hour) ||
      Math.abs(d.start_hour - (i + 1) * c.regimen.interval_hours) > 1e-8 ||
      d.dose_mg !== c.regimen.dose_mg ||
      d.infusion_duration_hours !== c.regimen.infusion_duration_hours
    )
      return reject(
        "Changed, held or irregular future doses are not representable in this release.",
        "unsupported_history",
      );
  }
  // T0 cannot occur after another dose while calling t=0 the latest known dose.
  if (c.cutoff_hour >= c.regimen.interval_hours)
    return reject(
      "Cutoff must precede the next dose in the declared same-cycle input window.",
      "unsupported_history",
    );
  const fit = runPosteriorEngine({
    patient: c.patient,
    regimen: c.regimen,
    levels,
  });
  if (
    !fit.success ||
    fit.diagnostics.convergence?.converged !== true ||
    (fit.diagnostics.observation_conflicts?.length ?? 0) > 0
  )
    return reject(
      "Posterior fit failed, did not converge or contains discordant duplicate samples.",
      "fit_abstention",
    );
  const params = { CL: fit.CL, V1: fit.V1, Q: fit.Q, V2: fit.V2 };
  const pk = {
    ...params,
    dose_mg: c.regimen.dose_mg,
    tau: c.regimen.interval_hours,
    T_inf: c.regimen.infusion_duration_hours,
  };
  let prediction =
    c.regimen.steady_state_confirmed && c.regimen.doses_given !== 1
      ? concentrationAtTime({ ...pk, t: c.forecast_hour })
      : finiteHistoryConcentration(pk, c.regimen.doses_given!, c.forecast_hour);
  for (const d of c.future_doses)
    prediction += singleDoseConcentration(pk, c.forecast_hour - d.start_hour);
  if (!Number.isFinite(prediction) || prediction <= 0)
    return reject("Nonfinite or nonpositive prediction.", "fit_abstention");
  return {
    ...base,
    status: "forecast",
    reasons: [],
    forecast_mg_l: prediction,
    forecast_hour: c.forecast_hour,
    cutoff_hour: c.cutoff_hour,
    forecast_basis: c.forecast_basis,
    final_parameters: params,
    diagnostics: fit.diagnostics,
  };
}
