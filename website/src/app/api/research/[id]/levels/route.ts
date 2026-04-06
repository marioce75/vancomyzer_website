import { NextRequest, NextResponse } from "next/server";
import { requireResearchAdmin } from "@/lib/research/requireAdmin";
import {
  insertLevelRecord,
  getLevelRecords,
  getDosingRecords,
  getResearchPatient,
  updateResearchPatient,
  logResearchAction,
} from "@/lib/research/db";
import { flagLevelTiming } from "@/lib/research/enrichPatient";
import { evaluateEligibility } from "@/lib/research/eligibility";

// POST: add a level record
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

  const concentration_mcg_ml = Number(body.concentration_mcg_ml);
  const time_hours = Number(body.time_hours);

  if (!concentration_mcg_ml || concentration_mcg_ml <= 0) {
    return NextResponse.json({ error: "concentration_mcg_ml must be positive." }, { status: 400 });
  }
  if (time_hours == null || isNaN(time_hours) || time_hours < 0) {
    return NextResponse.json({ error: "time_hours must be ≥ 0." }, { status: 400 });
  }

  // Auto-flag timing issues relative to existing doses
  const doses = getDosingRecords(id);
  const timing = flagLevelTiming(time_hours, doses);

  try {
    insertLevelRecord({
      study_id: id,
      concentration_mcg_ml,
      time_hours,
      during_infusion: timing.during_infusion ? 1 : 0,
      in_distribution_phase: timing.in_distribution_phase ? 1 : 0,
      time_since_infusion_end_h: timing.time_since_infusion_end_h,
    });

    // Re-run eligibility
    const levels = getLevelRecords(id);
    const eligibility = evaluateEligibility(patient, doses, levels);

    updateResearchPatient(id, {
      meets_inclusion: eligibility.eligible ? 1 : 0,
      exclusion_reasons: JSON.stringify(eligibility.exclusion_reasons),
    });

    logResearchAction(
      admin.username,
      "level_record_added",
      id,
      JSON.stringify({ concentration_mcg_ml, time_hours, ...timing })
    );

    return NextResponse.json({ ok: true, study_id: id, timing, eligibility });
  } catch (err) {
    console.error("[RESEARCH] Insert level failed:", err);
    return NextResponse.json({ error: "Failed to add level record." }, { status: 500 });
  }
}
