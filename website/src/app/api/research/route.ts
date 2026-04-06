import { NextRequest, NextResponse } from "next/server";
import { requireResearchAdmin } from "@/lib/research/requireAdmin";
import {
  generateStudyId,
  insertResearchPatient,
  listResearchPatients,
  getResearchSummary,
  getDosingRecords,
  getLevelRecords,
  logResearchAction,
} from "@/lib/research/db";
import { enrichPatientFields } from "@/lib/research/enrichPatient";
import { assertNoIdentifiers, capAge, capFreeText } from "@/lib/research/deidentify";
import { evaluateEligibility } from "@/lib/research/eligibility";

// GET: list all patients + summary stats
export async function GET() {
  const admin = await requireResearchAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const patients = listResearchPatients();
  const summary = getResearchSummary();

  return NextResponse.json({ patients, summary });
}

// POST: create new research patient
export async function POST(request: NextRequest) {
  const admin = await requireResearchAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

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

  // Validate required fields
  const age = Number(body.age);
  const weight_kg = Number(body.weight_kg);
  const height_cm = Number(body.height_cm);
  const sex = body.sex as string;
  const scr_baseline = Number(body.scr_baseline);
  const enrollment_date = String(body.enrollment_date ?? "");

  if (!age || age < 18) return NextResponse.json({ error: "Age must be ≥ 18." }, { status: 400 });
  if (!weight_kg || weight_kg < 30) return NextResponse.json({ error: "Weight must be ≥ 30 kg." }, { status: 400 });
  if (!height_cm || height_cm < 100) return NextResponse.json({ error: "Height must be ≥ 100 cm." }, { status: 400 });
  if (sex !== "male" && sex !== "female") return NextResponse.json({ error: "Sex must be 'male' or 'female'." }, { status: 400 });
  if (!scr_baseline || scr_baseline <= 0) return NextResponse.json({ error: "SCr baseline required." }, { status: 400 });
  if (!enrollment_date) return NextResponse.json({ error: "Enrollment date required." }, { status: 400 });

  const study_id = generateStudyId();
  const enriched = enrichPatientFields(age, weight_kg, height_cm, sex as "male" | "female", scr_baseline);

  const patient = {
    study_id,
    site_id: String(body.site_id ?? "HCA-GC-01"),
    age: enriched.age,
    sex: sex as "male" | "female",
    ethnicity: (body.ethnicity as string) || "unknown",
    weight_kg,
    height_cm,
    bmi: enriched.bmi,
    ffm_kg: enriched.ffm_kg,
    ibw_kg: enriched.ibw_kg,
    adjbw_kg: enriched.adjbw_kg,
    scr_baseline,
    crcl_baseline: enriched.crcl_baseline,
    icu_admission: body.icu_admission ? 1 : 0,
    indication: (body.indication as string) || "empiric",
    bedbound: body.bedbound ? 1 : 0,
    rrt: body.rrt ? 1 : 0,
    enrollment_date,
    meets_inclusion: 0,
    exclusion_reasons: "[]",
    created_by: admin.username,
  };

  // Run eligibility (with empty doses/levels for initial creation)
  const eligibility = evaluateEligibility(
    patient as Parameters<typeof evaluateEligibility>[0],
    getDosingRecords(study_id),
    getLevelRecords(study_id)
  );
  patient.meets_inclusion = eligibility.eligible ? 1 : 0;
  patient.exclusion_reasons = JSON.stringify(eligibility.exclusion_reasons);

  try {
    insertResearchPatient(patient as Parameters<typeof insertResearchPatient>[0]);
    logResearchAction(admin.username, "patient_created", study_id, JSON.stringify({ age: enriched.age, sex, weight_kg, bmi: enriched.bmi }));
  } catch (err) {
    console.error("[RESEARCH] Insert failed:", err);
    return NextResponse.json({ error: "Failed to create research record." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, study_id, eligibility });
}
