import { NextRequest, NextResponse } from "next/server";
import { computeInitialRegimen } from "@/lib/initialRegimen";
import { runExistingRegimenPipeline } from "@/lib/pk/runExistingRegimenPipeline";
import { logCalculation } from "@/lib/auditLog";
import { logCalculationEntry, getUserTier, findUserByLogin, logSecurityEvent } from "@/lib/db";
import { hasFeature } from "@/lib/tiers";
import { validateCaseId } from "@/lib/calculationHistory";

type Mode = "initial_regimen" | "existing_regimen";

interface RequestBody {
  mode?: unknown;
  patient?: unknown;
  regimen?: unknown;
  levels?: unknown;
  case_id?: unknown;
  intent?: unknown;
}

function validateRequest(body: unknown): { ok: true; data: RequestBody; mode: Mode } | { ok: false; error: { error_type: "validation_error"; message: string; field_errors?: Record<string, string> } } {
  if (body == null || typeof body !== "object") {
    return { ok: false, error: { error_type: "validation_error", message: "Request body must be a JSON object." } };
  }

  const o = body as RequestBody;
  const field_errors: Record<string, string> = {};

  const mode = o.mode as string | undefined;
  if (mode !== "initial_regimen" && mode !== "existing_regimen") {
    field_errors["mode"] = "Must be 'initial_regimen' or 'existing_regimen'.";
  }
  const resolvedMode = (mode === "initial_regimen" || mode === "existing_regimen" ? mode : "initial_regimen") as Mode;

  if (!o.patient || typeof o.patient !== "object") {
    field_errors["patient"] = "Required.";
  } else {
    const p = o.patient as Record<string, unknown>;
    if (typeof p.age !== "number" || Number.isNaN(p.age) || p.age < 18 || p.age > 120) field_errors["patient.age"] = "Adult calculator requires age 18-120.";
    if (typeof p.weight_kg !== "number" || Number.isNaN(p.weight_kg) || p.weight_kg < 30 || p.weight_kg > 400) field_errors["patient.weight_kg"] = "Weight must be 30-400 kg.";
    // height_cm and sex are optional — needed for obesity model (BMI ≥ 40)
    if (p.height_cm !== undefined && p.height_cm !== 0 && (typeof p.height_cm !== "number" || p.height_cm < 100 || p.height_cm > 250)) field_errors["patient.height_cm"] = "Height must be 100-250 cm.";
    if (p.sex !== undefined && p.sex !== "" && p.sex !== "male" && p.sex !== "female") field_errors["patient.sex"] = "Sex must be 'male' or 'female'.";
    if (typeof p.serum_creatinine_mg_dl !== "number" || Number.isNaN(p.serum_creatinine_mg_dl) || p.serum_creatinine_mg_dl < 0.1 || p.serum_creatinine_mg_dl > 10) field_errors["patient.serum_creatinine_mg_dl"] = "Scr must be 0.1-10 mg/dL. For SCr >10, consult nephrology — PK model reliability is limited.";
  }

  if (resolvedMode === "existing_regimen") {
    if (!o.regimen || typeof o.regimen !== "object") {
      field_errors["regimen"] = "Required for existing regimen evaluation.";
    } else {
      const r = o.regimen as Record<string, unknown>;
      if (typeof r.dose_mg !== "number" || Number.isNaN(r.dose_mg) || r.dose_mg <= 0) field_errors["regimen.dose_mg"] = "Must be a positive number.";
      if (typeof r.interval_hours !== "number" || Number.isNaN(r.interval_hours) || r.interval_hours <= 0) field_errors["regimen.interval_hours"] = "Must be a positive number.";
      if (typeof r.infusion_duration_hours !== "number" || Number.isNaN(r.infusion_duration_hours) || r.infusion_duration_hours <= 0) field_errors["regimen.infusion_duration_hours"] = "Must be a positive number greater than 0.";
    }

    // Loading dose simulation (doses_given=1) does not require measured levels
    const isPulseDoseSimulation = o.regimen && typeof o.regimen === "object" && (o.regimen as Record<string, unknown>).doses_given === 1;
    if (!isPulseDoseSimulation && (!Array.isArray(o.levels) || o.levels.length === 0)) {
      field_errors["levels"] = "At least one level is required for existing regimen evaluation.";
    } else if (Array.isArray(o.levels) && o.levels.length > 0) {
      o.levels.forEach((lev: unknown, i: number) => {
        if (lev == null || typeof lev !== "object") {
          field_errors[`levels[${i}]`] = "Invalid level object.";
        } else {
          const l = lev as Record<string, unknown>;
          if (typeof l.value_mcg_ml !== "number" || Number.isNaN(l.value_mcg_ml) || l.value_mcg_ml <= 0) field_errors[`levels[${i}].value_mcg_ml`] = "Must be a positive measured concentration.";
          if (Array.isArray(o.levels) && o.levels.length > 1 && (typeof l.collection_time !== "string" || !l.collection_time.trim())) field_errors[`levels[${i}].collection_time`] = "Collection time is required when more than one level is entered so timing semantics can be checked across the same dosing interval.";
          if (typeof l.time_since_last_dose_hours !== "number" || Number.isNaN(l.time_since_last_dose_hours) || l.time_since_last_dose_hours < 0) field_errors[`levels[${i}].time_since_last_dose_hours`] = "Must be a non-negative number.";
        }
      });
    }
  }

  if (Object.keys(field_errors).length > 0) {
    return {
      ok: false,
      error: {
        error_type: "validation_error",
        message: "Validation failed.",
        field_errors,
      },
    };
  }

  return { ok: true, data: body as RequestBody, mode: resolvedMode };
}

// ---------------------------------------------------------------------------
// Helpers to extract audit-safe input/output data
// ---------------------------------------------------------------------------

function extractInputs(data: RequestBody, mode: Mode): {
  age: number; weight_kg: number; serum_creatinine_mg_dl: number;
  dose_mg?: number; interval_hours?: number; infusion_duration_hours?: number;
  doses_given?: number; level_count: number;
} {
  const p = (data.patient ?? {}) as Record<string, unknown>;
  const r = (data.regimen ?? {}) as Record<string, unknown>;
  const levels = Array.isArray(data.levels) ? data.levels : [];

  return {
    age: (p.age as number) ?? 0,
    weight_kg: (p.weight_kg as number) ?? 0,
    serum_creatinine_mg_dl: (p.serum_creatinine_mg_dl as number) ?? 0,
    ...(mode === "existing_regimen" ? {
      dose_mg: (r.dose_mg as number) ?? undefined,
      interval_hours: (r.interval_hours as number) ?? undefined,
      infusion_duration_hours: (r.infusion_duration_hours as number) ?? undefined,
      doses_given: (r.doses_given as number) ?? undefined,
    } : {}),
    level_count: levels.filter((l: unknown) => l && typeof l === "object" && (l as Record<string, unknown>).value_mcg_ml).length,
  };
}

function extractOutputs(result: Record<string, unknown>): {
  auc24: number; peak: number; trough: number;
  recommended_dose: string; recommended_interval_hours: number;
  frequency_options_count: number; used_posterior_refinement: boolean;
  evidence_strength?: string;
} {
  const details = result.calculation_details as Record<string, unknown> | undefined;
  const freqOpts = result.frequency_options as unknown[] | undefined;
  const pkParams = result.pk_parameters as Record<string, unknown> | undefined;

  return {
    auc24: (result.auc24 as number) ?? 0,
    peak: (result.peak as number) ?? 0,
    trough: (result.trough as number) ?? 0,
    recommended_dose: (result.recommended_dose as string) ?? "",
    recommended_interval_hours: (result.recommended_interval_hours as number) ?? 0,
    frequency_options_count: freqOpts?.length ?? 0,
    used_posterior_refinement: (pkParams?.used_posterior_refinement as boolean) ?? false,
    evidence_strength: (details?.evidence_strength as string) ?? undefined,
  };
}

function extractPKParams(result: Record<string, unknown>): { CL: number; V1: number; Q: number; V2: number } | undefined {
  const pk = result.pk_parameters as Record<string, unknown> | undefined;
  if (!pk) return undefined;
  return {
    CL: Math.round(((pk.CL as number) ?? 0) * 100) / 100,
    V1: Math.round(((pk.V1 as number) ?? 0) * 100) / 100,
    Q: Math.round(((pk.Q as number) ?? 0) * 100) / 100,
    V2: Math.round(((pk.V2 as number) ?? 0) * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const userEmail = request.headers.get("x-user-email") ?? "anonymous";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error_type: "validation_error", message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  // Validate optional case_id BEFORE doing any PK work — reject PHI-shaped
  // input early so it never enters our processing pipeline.
  const caseIdResult = validateCaseId((body as RequestBody | null | undefined)?.case_id);
  if (!caseIdResult.ok) {
    return NextResponse.json(
      { error_type: "validation_error", message: caseIdResult.reason, field_errors: { case_id: caseIdResult.reason } },
      { status: 400 },
    );
  }
  const caseId = caseIdResult.value;

  // History persistence is gated on explicit intent. Auto-debounced recalcs
  // fired during data entry are not user-confirmed clinical actions, so we
  // don't pollute history with them. Defaults to "explicit" when absent so
  // older clients (or curl) still get logged.
  const intent = (body as RequestBody | null | undefined)?.intent === "auto" ? "auto" : "explicit";

  const validated = validateRequest(body);

  // Log validation errors
  if (!validated.ok) {
    logCalculation({
      mode: "initial_regimen",
      duration_ms: Date.now() - startTime,
      status: "validation_error",
      user_email: userEmail,
      inputs: {
        age: 0, weight_kg: 0, serum_creatinine_mg_dl: 0, level_count: 0,
      },
      error: {
        type: validated.error.error_type,
        message: validated.error.message,
        field_errors: validated.error.field_errors,
      },
    });
    return NextResponse.json(validated.error, { status: 400 });
  }

  const inputs = extractInputs(validated.data, validated.mode);

  if (validated.mode === "initial_regimen") {
    const p = validated.data.patient as Record<string, unknown>;
    const patient = {
      age: p.age as number,
      weight_kg: p.weight_kg as number,
      height_cm: (p.height_cm as number) ?? 0,
      sex: ((p.sex as string) === "male" || (p.sex as string) === "female" ? p.sex : "") as "male" | "female" | "",
      serum_creatinine_mg_dl: p.serum_creatinine_mg_dl as number,
    };
    const result = computeInitialRegimen(patient) as unknown as Record<string, unknown>;

    logCalculation({
      mode: "initial_regimen",
      duration_ms: Date.now() - startTime,
      status: "success",
      user_email: userEmail,
      inputs,
      outputs: extractOutputs(result),
      pk_parameters: extractPKParams(result),
    });

    // Calculation history — gated on history.calculation feature
    // (Pro+, no patient identifiers, includes optional case_id).
    // Auto-recalc never persists; only explicit user action does.
    if (intent === "explicit") {
      persistCalculation(userEmail, "empiric", result, caseId);
    }

    return NextResponse.json(result);
  }

  const result = runExistingRegimenPipeline({
    patient: validated.data.patient as Record<string, unknown>,
    regimen: validated.data.regimen as Record<string, unknown>,
    levels: (validated.data.levels as Array<Record<string, unknown>>) ?? [],
  });

  if ("ok" in result && result.ok === false) {
    logCalculation({
      mode: "existing_regimen",
      duration_ms: Date.now() - startTime,
      status: "error",
      user_email: userEmail,
      inputs,
      error: {
        type: result.error_type as string,
        message: result.message as string,
        field_errors: result.field_errors as Record<string, string> | undefined,
      },
    });
    return NextResponse.json(
      {
        error_type: result.error_type,
        message: result.message,
        field_errors: result.field_errors,
        recovery_guidance: result.recovery_guidance,
        fallback_workflow: result.fallback_workflow,
      },
      { status: 400 }
    );
  }

  const resultObj = result as Record<string, unknown>;
  logCalculation({
    mode: "existing_regimen",
    duration_ms: Date.now() - startTime,
    status: "success",
    user_email: userEmail,
    inputs,
    outputs: extractOutputs(resultObj),
    pk_parameters: extractPKParams(resultObj),
  });

  // Bayesian fit diagnostic — log prior↔posterior shifts and per-level
  // residuals so we can quantify fit quality across real cases. No PHI;
  // PK parameters and residuals only.
  const fitDiag = resultObj.fit_diagnostic as Record<string, unknown> | undefined;
  if (fitDiag) {
    try {
      const dbUser = userEmail !== "anonymous" ? findUserByLogin(userEmail) : undefined;
      logSecurityEvent({
        user_id: dbUser?.id ?? null,
        username: dbUser?.username ?? userEmail,
        action: "BAYESIAN_FIT_DIAGNOSTIC",
        details: JSON.stringify({
          prior_CL: round2(fitDiag.prior_CL),
          prior_V1: round2(fitDiag.prior_V1),
          posterior_CL: round2(fitDiag.posterior_CL),
          posterior_V1: round2(fitDiag.posterior_V1),
          posterior_shift_cl_pct: round2(fitDiag.posterior_shift_cl_pct),
          posterior_shift_v1_pct: round2(fitDiag.posterior_shift_v1_pct),
          max_relative_error: round2(fitDiag.max_relative_error),
          per_level: fitDiag.posterior_predicted_at_levels,
          doses_given: inputs.doses_given,
          level_count: inputs.level_count,
        }),
        severity: "info",
      });
    } catch (err) {
      console.warn("[bayesian-fit-diagnostic] log failed:", err);
    }
  }

  // Calculation history — gated on history.calculation feature.
  // Auto-recalc never persists; only explicit user action does.
  if (intent === "explicit") {
    persistCalculation(userEmail, "existing", resultObj, caseId);
  }

  return NextResponse.json(result);
}

function round2(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
}

/**
 * Persist a single calculation to calculation_log for users with the
 * history.calculation feature (Individual Pro and above). Non-blocking —
 * errors are swallowed so a DB issue never breaks the calc response.
 * Stores derived fields only; no patient identifiers.
 */
function persistCalculation(
  userEmail: string,
  workflowType: string,
  result: Record<string, unknown>,
  caseId: string | null,
) {
  try {
    if (userEmail === "anonymous") return;
    const dbUser = findUserByLogin(userEmail);
    if (!dbUser) return;
    const tier = getUserTier(dbUser.id);
    if (!hasFeature(tier, "history.calculation")) return;

    const pk = result.pk_parameters as Record<string, unknown> | undefined;
    const auc24 = result.auc24 as number | undefined;
    const dose = parseInt(String(result.recommended_dose ?? "0"));
    logCalculationEntry({
      user_id: dbUser.id,
      institutional_account_id: dbUser.institutional_account_id,
      workflow_type: workflowType,
      pk_model: (pk?.pk_model_name as string) ?? "colin_2019",
      obesity_model_active: pk?.pk_model_name === "vancomyzer_obesity" ? 1 : 0,
      bmi_above_40: pk?.pk_model_name === "vancomyzer_obesity" ? 1 : 0,
      dose_mg: Number.isFinite(dose) ? dose : null,
      interval_hours: (result.recommended_interval_hours as number) ?? null,
      auc24: typeof auc24 === "number" ? auc24 : null,
      peak: (result.peak as number) ?? null,
      trough: (result.trough as number) ?? null,
      auc_in_range: typeof auc24 === "number" && auc24 >= 400 && auc24 <= 600 ? 1 : 0,
      case_id: caseId,
      tier_at_time: tier,
    });
  } catch (err) {
    console.warn("[calculation-history] persist failed:", err);
  }
}
