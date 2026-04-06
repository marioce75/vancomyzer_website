import { NextRequest, NextResponse } from "next/server";
import { requireResearchAdmin } from "@/lib/research/requireAdmin";
import {
  insertDosingRecord,
  getDosingRecords,
  getLevelRecords,
  getResearchPatient,
  updateResearchPatient,
  logResearchAction,
} from "@/lib/research/db";
import { evaluateEligibility } from "@/lib/research/eligibility";

// POST: add a dosing record
export async function POST(
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

  const dose_mg = Number(body.dose_mg);
  const infusion_duration_min = Number(body.infusion_duration_min);
  const time_hours = Number(body.time_hours);
  const is_loading_dose = body.is_loading_dose ? 1 : 0;

  if (!dose_mg || dose_mg <= 0) {
    return NextResponse.json({ error: "dose_mg must be positive." }, { status: 400 });
  }
  if (!infusion_duration_min || infusion_duration_min <= 0) {
    return NextResponse.json({ error: "infusion_duration_min must be positive." }, { status: 400 });
  }
  if (time_hours == null || isNaN(time_hours) || time_hours < 0) {
    return NextResponse.json({ error: "time_hours must be ≥ 0." }, { status: 400 });
  }

  // Auto-calculate infusion rate
  const infusion_rate_mg_h = dose_mg / (infusion_duration_min / 60);

  try {
    insertDosingRecord({
      study_id: id,
      dose_mg,
      infusion_duration_min,
      infusion_rate_mg_h: Math.round(infusion_rate_mg_h * 100) / 100,
      time_hours,
      is_loading_dose,
    });

    // Re-run eligibility
    const doses = getDosingRecords(id);
    const levels = getLevelRecords(id);
    const eligibility = evaluateEligibility(patient, doses, levels);

    updateResearchPatient(id, {
      meets_inclusion: eligibility.eligible ? 1 : 0,
      exclusion_reasons: JSON.stringify(eligibility.exclusion_reasons),
    });

    logResearchAction(
      admin.username,
      "dosing_record_added",
      id,
      JSON.stringify({ dose_mg, infusion_duration_min, time_hours, is_loading_dose })
    );

    return NextResponse.json({ ok: true, study_id: id, eligibility });
  } catch (err) {
    console.error("[RESEARCH] Insert dosing failed:", err);
    return NextResponse.json({ error: "Failed to add dosing record." }, { status: 500 });
  }
}
