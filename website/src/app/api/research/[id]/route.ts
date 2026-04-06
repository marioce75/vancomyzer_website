import { NextRequest, NextResponse } from "next/server";
import { requireResearchAdmin } from "@/lib/research/requireAdmin";
import {
  getResearchPatient,
  updateResearchPatient,
  deleteResearchPatient,
  getDosingRecords,
  getLevelRecords,
  getScrTrajectory,
  getClinicalOutcome,
  getNephrotoxins,
  logResearchAction,
} from "@/lib/research/db";
import { evaluateEligibility } from "@/lib/research/eligibility";
import { enrichPatientFields } from "@/lib/research/enrichPatient";
import { assertNoIdentifiers } from "@/lib/research/deidentify";

// GET: return full patient record with all sub-resources
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireResearchAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { id } = params;
  const patient = getResearchPatient(id);
  if (!patient) {
    return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  }

  const dosing = getDosingRecords(id);
  const levels = getLevelRecords(id);
  const scr = getScrTrajectory(id);
  const outcomes = getClinicalOutcome(id);
  const nephrotoxins = getNephrotoxins(id);

  const eligibility = evaluateEligibility(patient, dosing, levels);

  return NextResponse.json({
    patient,
    dosing,
    levels,
    scr,
    outcomes: outcomes ?? null,
    nephrotoxins,
    eligibility,
  });
}

// PUT: update patient fields, re-run eligibility
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

  // De-identification check
  try {
    assertNoIdentifiers(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  // Re-enrich derived fields if anthropometrics changed
  const age = Number(body.age ?? patient.age);
  const weight_kg = Number(body.weight_kg ?? patient.weight_kg);
  const height_cm = Number(body.height_cm ?? patient.height_cm);
  const sex = (body.sex as string) ?? patient.sex;
  const scr_baseline = Number(body.scr_baseline ?? patient.scr_baseline);

  const enriched = enrichPatientFields(
    age,
    weight_kg,
    height_cm,
    sex as "male" | "female",
    scr_baseline
  );

  const updates = {
    ...body,
    age: enriched.age,
    bmi: enriched.bmi,
    ffm_kg: enriched.ffm_kg,
    ibw_kg: enriched.ibw_kg,
    adjbw_kg: enriched.adjbw_kg,
    crcl_baseline: enriched.crcl_baseline,
  };

  // Re-run eligibility
  const merged = { ...patient, ...updates } as Parameters<typeof evaluateEligibility>[0];
  const dosing = getDosingRecords(id);
  const levels = getLevelRecords(id);
  const eligibility = evaluateEligibility(merged, dosing, levels);

  (updates as Record<string, unknown>).meets_inclusion = eligibility.eligible ? 1 : 0;
  (updates as Record<string, unknown>).exclusion_reasons = JSON.stringify(eligibility.exclusion_reasons);

  try {
    updateResearchPatient(id, updates);
    logResearchAction(
      admin.username,
      "patient_updated",
      id,
      JSON.stringify(Object.keys(body))
    );
  } catch (err) {
    console.error("[RESEARCH] Update failed:", err);
    return NextResponse.json({ error: "Failed to update patient." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, study_id: id, eligibility });
}

// DELETE: delete patient and all sub-resources
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireResearchAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { id } = params;
  const patient = getResearchPatient(id);
  if (!patient) {
    return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  }

  try {
    deleteResearchPatient(id);
    logResearchAction(admin.username, "patient_deleted", id, "{}");
  } catch (err) {
    console.error("[RESEARCH] Delete failed:", err);
    return NextResponse.json({ error: "Failed to delete patient." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, study_id: id });
}
