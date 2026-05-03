import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  listPilotApplications,
  getPilotApplicationById,
  updatePilotApplicationStatus,
  logSecurityEvent,
  type PilotApplicationStatus,
} from "@/lib/db";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const role = (session.user as Record<string, unknown>).role;
  if (role !== "admin") return null;
  return session.user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const applications = listPilotApplications();
  return NextResponse.json({ applications });
}

const ALLOWED_STATUSES: PilotApplicationStatus[] = [
  "pending",
  "approved",
  "rejected",
  "archived",
];

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  let body: { id?: number; status?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.id || typeof body.id !== "number") {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }
  if (!body.status || !ALLOWED_STATUSES.includes(body.status as PilotApplicationStatus)) {
    return NextResponse.json(
      { error: `status must be one of ${ALLOWED_STATUSES.join(", ")}.` },
      { status: 400 },
    );
  }

  const application = getPilotApplicationById(body.id);
  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  const adminId = Number((admin as Record<string, unknown>).id ?? 0);
  const adminUsername = ((admin as Record<string, unknown>).username as string) ?? "admin";

  updatePilotApplicationStatus({
    id: body.id,
    status: body.status as PilotApplicationStatus,
    reviewed_by: adminId,
    review_notes: body.notes ?? null,
  });

  logSecurityEvent({
    user_id: adminId,
    username: adminUsername,
    action: "PILOT_APPLICATION_REVIEWED",
    details: JSON.stringify({
      application_id: body.id,
      hospital: application.hospital_name,
      new_status: body.status,
      notes: body.notes ?? null,
    }),
    severity: "info",
  });

  return NextResponse.json({
    ok: true,
    message: `Application #${body.id} marked ${body.status}.`,
  });
}
