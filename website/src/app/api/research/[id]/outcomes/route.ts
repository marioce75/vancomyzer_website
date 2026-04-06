import { NextRequest, NextResponse } from "next/server";
import { requireResearchAdmin } from "@/lib/research/requireAdmin";
import {
  upsertClinicalOutcome,
  getClinicalOutcome,
  getResearchPatient,
  logResearchAction,
} from "@/lib/research/db";

// PUT: update clinical outcomes
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireResearchAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { id } = params;
  const patient = getResearchPatient(id);
  if (!patient) {
    return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Merge with existing outcome (if any)
  const existing = getClinicalOutcome(id);

  const outcome = {
    study_id: id,
    aki_detected: body.aki_detected != null ? (body.aki_detected ? 1 : 0) : (existing?.aki_detected ?? 0),
    aki_stage: (body.aki_stage as number | null) ?? existing?.aki_stage ?? null,
    aki_onset_day: (body.aki_onset_day as number | null) ?? existing?.aki_onset_day ?? null,
    hospital_los_days: (body.hospital_los_days as number | null) ?? existing?.hospital_los_days ?? null,
    vanc_discontinued_early: body.vanc_discontinued_early != null
      ? (body.vanc_discontinued_early ? 1 : 0)
      : (existing?.vanc_discontinued_early ?? 0),
    discontinuation_reason: (body.discontinuation_reason as string | null) ?? existing?.discontinuation_reason ?? null,
    microbiological_outcome: (body.microbiological_outcome as "eradicated" | "persistent" | "unknown" | null) ?? existing?.microbiological_outcome ?? null,
  };

  try {
    upsertClinicalOutcome(outcome);

    logResearchAction(
      admin.username,
      "outcomes_updated",
      id,
      JSON.stringify(Object.keys(body))
    );

    return NextResponse.json({ ok: true, study_id: id, outcome });
  } catch (err) {
    console.error("[RESEARCH] Upsert outcome failed:", err);
    return NextResponse.json({ error: "Failed to update outcomes." }, { status: 500 });
  }
}
