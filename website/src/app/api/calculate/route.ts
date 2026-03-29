import { NextRequest, NextResponse } from "next/server";
import { computeInitialRegimen } from "@/lib/initialRegimen";
import { runExistingRegimenPipeline } from "@/lib/pk/runExistingRegimenPipeline";

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

    if (!Array.isArray(o.levels) || o.levels.length === 0) {
      field_errors["levels"] = "At least one level is required for existing regimen evaluation.";
    } else {
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

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error_type: "validation_error", message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const validated = validateRequest(body);
  if (!validated.ok) {
    return NextResponse.json(validated.error, { status: 400 });
  }

  if (validated.mode === "initial_regimen") {
    const p = validated.data.patient as Record<string, unknown>;
    const patient = {
      age: p.age as number,
      weight_kg: p.weight_kg as number,
      serum_creatinine_mg_dl: p.serum_creatinine_mg_dl as number,
    };
    return NextResponse.json(computeInitialRegimen(patient));
  }

  const result = runExistingRegimenPipeline({
    patient: validated.data.patient as Record<string, unknown>,
    regimen: validated.data.regimen as Record<string, unknown>,
    levels: (validated.data.levels as Array<Record<string, unknown>>) ?? [],
  });
  if ("ok" in result && result.ok === false) {
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
  return NextResponse.json(result);
}
