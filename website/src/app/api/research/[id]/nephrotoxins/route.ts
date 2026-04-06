import { NextRequest, NextResponse } from "next/server";
import { requireResearchAdmin } from "@/lib/research/requireAdmin";
import {
  insertNephrotoxin,
  getNephrotoxins,
  deleteNephrotoxin,
  getResearchPatient,
  logResearchAction,
} from "@/lib/research/db";

// POST: add a nephrotoxin
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

  const drug_name = String(body.drug_name ?? "").trim();
  const vasopressor_use = body.vasopressor_use ? 1 : 0;

  if (!drug_name) {
    return NextResponse.json({ error: "drug_name is required." }, { status: 400 });
  }

  try {
    insertNephrotoxin({
      study_id: id,
      drug_name,
      vasopressor_use,
    });

    const nephrotoxins = getNephrotoxins(id);

    logResearchAction(
      admin.username,
      "nephrotoxin_added",
      id,
      JSON.stringify({ drug_name, vasopressor_use })
    );

    return NextResponse.json({ ok: true, study_id: id, nephrotoxins });
  } catch (err) {
    console.error("[RESEARCH] Insert nephrotoxin failed:", err);
    return NextResponse.json({ error: "Failed to add nephrotoxin." }, { status: 500 });
  }
}

// DELETE: remove nephrotoxin by id (query param)
export async function DELETE(
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

  const nephrotoxinId = request.nextUrl.searchParams.get("nephrotoxin_id");
  if (!nephrotoxinId) {
    return NextResponse.json({ error: "nephrotoxin_id query param is required." }, { status: 400 });
  }

  try {
    deleteNephrotoxin(Number(nephrotoxinId));

    const nephrotoxins = getNephrotoxins(id);

    logResearchAction(
      admin.username,
      "nephrotoxin_deleted",
      id,
      JSON.stringify({ nephrotoxin_id: Number(nephrotoxinId) })
    );

    return NextResponse.json({ ok: true, study_id: id, nephrotoxins });
  } catch (err) {
    console.error("[RESEARCH] Delete nephrotoxin failed:", err);
    return NextResponse.json({ error: "Failed to delete nephrotoxin." }, { status: 500 });
  }
}
