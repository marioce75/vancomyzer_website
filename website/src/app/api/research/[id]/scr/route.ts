import { NextRequest, NextResponse } from "next/server";
import { requireResearchAdmin } from "@/lib/research/requireAdmin";
import {
  insertScrPoint,
  getScrTrajectory,
  getResearchPatient,
  upsertClinicalOutcome,
  getClinicalOutcome,
  logResearchAction,
} from "@/lib/research/db";
import { detectKdigoAKI } from "@/lib/research/kdigo";
import { calculateCrCl } from "@/lib/pk/obesityModel";

// POST: add SCr trajectory point
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

  const scr_mg_dl = Number(body.scr_mg_dl);
  const time_hours = Number(body.time_hours);

  if (!scr_mg_dl || scr_mg_dl <= 0) {
    return NextResponse.json({ error: "scr_mg_dl must be positive." }, { status: 400 });
  }
  if (time_hours == null || isNaN(time_hours) || time_hours < 0) {
    return NextResponse.json({ error: "time_hours must be ≥ 0." }, { status: 400 });
  }

  // Auto-calculate CrCl using patient demographics and this SCr value
  const crcl_ml_min = calculateCrCl(
    patient.age,
    patient.weight_kg,
    scr_mg_dl,
    patient.sex as "male" | "female"
  );

  try {
    insertScrPoint({
      study_id: id,
      scr_mg_dl,
      time_hours,
      crcl_ml_min: Math.round(crcl_ml_min * 10) / 10,
    });

    // Run KDIGO AKI detection on updated trajectory
    const trajectory = getScrTrajectory(id);
    const kdigo = detectKdigoAKI(trajectory, patient.scr_baseline);

    // Update clinical outcomes with AKI findings
    const existing = getClinicalOutcome(id);
    upsertClinicalOutcome({
      study_id: id,
      aki_detected: kdigo.detected ? 1 : 0,
      aki_stage: kdigo.stage,
      aki_onset_day: kdigo.onset_day,
      hospital_los_days: existing?.hospital_los_days ?? null,
      vanc_discontinued_early: existing?.vanc_discontinued_early ?? 0,
      discontinuation_reason: existing?.discontinuation_reason ?? null,
      microbiological_outcome: existing?.microbiological_outcome ?? null,
    });

    logResearchAction(
      admin.username,
      "scr_point_added",
      id,
      JSON.stringify({ scr_mg_dl, time_hours, crcl_ml_min: Math.round(crcl_ml_min * 10) / 10, kdigo })
    );

    return NextResponse.json({ ok: true, study_id: id, crcl_ml_min: Math.round(crcl_ml_min * 10) / 10, kdigo });
  } catch (err) {
    console.error("[RESEARCH] Insert SCr failed:", err);
    return NextResponse.json({ error: "Failed to add SCr point." }, { status: 500 });
  }
}
