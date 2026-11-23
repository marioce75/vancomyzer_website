import { validateRawInput } from "@/lib/pk/validate/validateRawInput";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { computeInitialRegimen, InitialRegimenInputError } from "@/lib/initialRegimen";
import { getSettingsForUser } from "@/lib/institutionalSettings";
import { dosePolicyFromSettings } from "@/lib/pk/dosePolicy";
import { runExistingRegimenPipeline } from "@/lib/pk/runExistingRegimenPipeline";
import { logCalculation } from "@/lib/auditLog";
import { findUserByLogin } from "@/lib/db";
import { authOptions } from "@/lib/authOptions";
import { checkRateLimit, getCalculateRateLimitConfig, getClientIp } from "@/lib/rateLimit";
import { MODEL_MANIFEST_VERSION } from "@/lib/pk/modelRegistry";
import { createHash } from "node:crypto";

/**
 * Immutable snapshot attached to every result so the client can bind a
 * rendered result and an export to exactly the inputs and model
 * version that produced it (an out-of-order response can then be detected and
 * discarded by comparing digests — see CalculatorWorkspace).
 */
function buildResultSnapshot(mode: Mode, data: RequestBody): { model_manifest_version: string; mode: Mode; input_digest: string; computed_at: string; source_revision: string | null } {
  const canonical = JSON.stringify({ mode, patient: data.patient ?? null, regimen: data.regimen ?? null, levels: data.levels ?? null });
  return {
    model_manifest_version: MODEL_MANIFEST_VERSION,
    mode,
    input_digest: createHash("sha256").update(canonical).digest("hex").slice(0, 32),
    computed_at: new Date().toISOString(),
    source_revision: process.env.RENDER_GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  };
}

type Mode = "initial_regimen" | "existing_regimen";

interface RequestBody {
  mode?: unknown;
  patient?: unknown;
  regimen?: unknown;
  levels?: unknown;
}

function validateRequest(body: unknown): { ok: true; data: RequestBody; mode: Mode } | { ok: false; error: { error_type: "validation_error"; message: string; field_errors?: Record<string, string> } } {
  if (body == null || typeof body !== "object") {
    return { ok: false, error: { error_type: "validation_error", message: "Request body must be a JSON object." } };
  }

  const o = body as RequestBody;
  const rawErrors = validateRawInput(body, o.mode !== "initial_regimen");
  if (Object.keys(rawErrors).length) return { ok: false, error: { error_type: "validation_error", message: "Invalid or unsupported inputs.", field_errors: rawErrors } };
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
    // height_cm and sex are optional — used only for the high-BMI advisory and the
    // informational CrCl comparison; they never switch the PK model.
    if (p.height_cm !== undefined && p.height_cm !== 0 && (typeof p.height_cm !== "number" || p.height_cm < 100 || p.height_cm > 250)) field_errors["patient.height_cm"] = "Height must be 100-250 cm.";
    if (p.sex !== undefined && p.sex !== "" && p.sex !== "male" && p.sex !== "female") field_errors["patient.sex"] = "Sex must be 'male' or 'female'.";
    if (typeof p.serum_creatinine_mg_dl !== "number" || Number.isNaN(p.serum_creatinine_mg_dl) || p.serum_creatinine_mg_dl < 0.1 || p.serum_creatinine_mg_dl > 10) field_errors["patient.serum_creatinine_mg_dl"] = "Scr must be 0.1-10 mg/dL. For SCr >10, consult nephrology — PK model reliability is limited.";
    // Dialysis / renal replacement therapy is outside the Colin 2019 population
    // and outside this calculator's stated scope. The workspace collected an RRT
    // toggle but never sent it, so the API could not keep the withholding the
    // site promises; it is part of the request contract now and refuses here.
    const dialysisOrRrt = p.dialysis_or_rrt;
    if (dialysisOrRrt !== undefined && typeof dialysisOrRrt !== "boolean") {
      field_errors["patient.dialysis_or_rrt"] = "Must be true or false.";
    } else if (dialysisOrRrt === true) {
      field_errors["patient.dialysis_or_rrt"] =
        "Vancomycin dosing during dialysis or other renal replacement therapy is outside this calculator's validated scope — the Colin 2019 population excludes RRT, so its clearance estimate does not describe a patient on dialysis. Dose per your institution's RRT protocol with nephrology input.";
    }
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
  doses_given?: number; loading_dose_mg?: number; level_count: number;
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
      ...(typeof r.loading_dose_mg === "number" ? { loading_dose_mg: r.loading_dose_mg } : {}),
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

const calculationResponse = (body: unknown, init?: ResponseInit) => {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(body, { ...init, headers });
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Identity comes from the verified session, never from request headers:
  // a client can send any x-user-* header it likes, and middleware is not
  // guaranteed to have run. Same pattern as lib/featureGate.ts.
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email ?? "anonymous";
  const isAnonymous = !session?.user?.email;

  // Anonymous abuse guard — open-access mode lets requests through without a
  // session. Checked before the body is read so rejected requests stay cheap.
  // Limits are generous on purpose (see lib/rateLimit.ts): the calculator
  // recalculates automatically during data entry and many clinicians can
  // share one hospital network address. Signed-in users are not limited.
  if (isAnonymous) {
    const { max, windowMs } = getCalculateRateLimitConfig();
    const limit = checkRateLimit(`calculate:${getClientIp(request.headers)}`, max, windowMs);
    if (!limit.allowed) {
      return calculationResponse(
        {
          error_type: "rate_limited",
          message: "Too many calculations from your network in a short time. Please wait a few minutes and try again.",
        },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return calculationResponse(
      { error_type: "validation_error", message: "Invalid JSON body." },
      { status: 400 }
    );
  }

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
    return calculationResponse(validated.error, { status: 400 });
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
    // validateRequest above already bounds these, so this is defence in depth:
    // the engine now enforces its own scope, and a miss here must surface as a
    // 400 naming the field rather than a 500.
    // Institutional dose ceilings, if this user's department configured any.
    // /settings validated and persisted these and the engine then never read
    // them, so a department that set a 500 mg single-dose limit still received
    // 1500 mg recommendations. Anonymous and unaffiliated users get the
    // guideline defaults, and a configured value can only tighten a ceiling,
    // never raise one (dosePolicyFromSettings clamps).
    const policyUser = userEmail !== "anonymous" ? findUserByLogin(userEmail) : undefined;
    const dosePolicy = dosePolicyFromSettings(getSettingsForUser(policyUser?.institution ?? ""));

    let result: Record<string, unknown>;
    try {
      result = computeInitialRegimen(patient, dosePolicy) as unknown as Record<string, unknown>;
    } catch (error) {
      if (!(error instanceof InitialRegimenInputError)) throw error;
      logCalculation({
        mode: "initial_regimen",
        duration_ms: Date.now() - startTime,
        status: "error",
        user_email: userEmail,
        inputs,
        error: {
          type: error.error_type,
          message: error.message,
          field_errors: error.field_errors,
        },
      });
      return calculationResponse(
        { error_type: error.error_type, message: error.message, field_errors: error.field_errors },
        { status: 400 },
      );
    }

    logCalculation({
      mode: "initial_regimen",
      duration_ms: Date.now() - startTime,
      status: "success",
      user_email: userEmail,
      inputs,
      outputs: extractOutputs(result),
      pk_parameters: extractPKParams(result),
    });

    result.result_snapshot = buildResultSnapshot("initial_regimen", validated.data);
    return calculationResponse(result);
  }

  // Same institutional ceilings as the empiric path above. Recomputed here
  // because that block returns before reaching this point.
  const existingPolicyUser = userEmail !== "anonymous" ? findUserByLogin(userEmail) : undefined;
  const result = runExistingRegimenPipeline({
    patient: validated.data.patient as Record<string, unknown>,
    regimen: validated.data.regimen as Record<string, unknown>,
    levels: (validated.data.levels as Array<Record<string, unknown>>) ?? [],
    policy: dosePolicyFromSettings(getSettingsForUser(existingPolicyUser?.institution ?? "")),
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
    return calculationResponse(
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

  // Clinical fit diagnostics are returned to the caller, never written to
  // security logs. A research workflow needs its own approved data store.

  resultObj.result_snapshot = buildResultSnapshot("existing_regimen", validated.data);
  return calculationResponse(result);
}
