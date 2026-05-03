import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  listPilotApplications,
  getPilotApplicationById,
  updatePilotApplicationStatus,
  logSecurityEvent,
  disableInstitutionUsers,
  setInstitutionExpiry,
  type PilotApplicationStatus,
} from "@/lib/db";
import { provisionPilot, buildMagicLinkUrl } from "@/lib/pilotApplication/provision";
import {
  sendPilotWelcomeEmail,
  sendPilotDeclineEmail,
  sendPilotRevokedEmail,
} from "@/lib/email";

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

const DEFAULT_SEATS = 10;
const DEFAULT_DURATION_DAYS = 90;
const MIN_SEATS = 1;
const MAX_SEATS = 500;
const MIN_DAYS = 1;
const MAX_DAYS = 365;

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  let body: {
    id?: number;
    status?: string;
    notes?: string;
    action?: string;
    seats?: number;
    durationDays?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.id || typeof body.id !== "number") {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const application = getPilotApplicationById(body.id);
  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  const adminId = Number((admin as Record<string, unknown>).id ?? 0);
  const adminUsername = ((admin as Record<string, unknown>).username as string) ?? "admin";

  // ── REVOKE: end an active pilot mid-cycle ──────────────────────────────
  if (body.action === "revoke") {
    if (application.status !== "approved" || !application.tenant_id) {
      return NextResponse.json(
        { error: "Only an approved application with a tenant can be revoked." },
        { status: 400 },
      );
    }
    const now = new Date().toISOString();
    setInstitutionExpiry(application.tenant_id, now);
    const disabled = disableInstitutionUsers(application.tenant_id);
    updatePilotApplicationStatus({
      id: application.id,
      status: "archived",
      reviewed_by: adminId,
      review_notes: body.notes ?? "Revoked",
    });

    logSecurityEvent({
      user_id: adminId,
      username: adminUsername,
      action: "PILOT_REVOKED",
      details: JSON.stringify({
        application_id: application.id,
        tenant_id: application.tenant_id,
        users_disabled: disabled,
        notes: body.notes ?? null,
      }),
      severity: "warn",
    });

    try {
      await sendPilotRevokedEmail({
        applicantName: application.contact_name,
        applicantEmail: application.email,
        hospitalName: application.hospital_name,
      });
    } catch (err) {
      console.error("[PILOT] Revocation email failed (non-fatal):", err);
    }

    return NextResponse.json({
      ok: true,
      message: `Pilot for ${application.hospital_name} revoked. ${disabled} user${disabled === 1 ? "" : "s"} disabled.`,
    });
  }

  // ── Status transitions (approve / reject / archive / pending) ──────────
  if (!body.status || !ALLOWED_STATUSES.includes(body.status as PilotApplicationStatus)) {
    return NextResponse.json(
      { error: `status must be one of ${ALLOWED_STATUSES.join(", ")}.` },
      { status: 400 },
    );
  }
  const newStatus = body.status as PilotApplicationStatus;

  // APPROVE — provision tenant + send welcome email (idempotent: skip if already provisioned)
  if (newStatus === "approved") {
    if (application.tenant_id) {
      // Already provisioned — only update status and notes, don't double-provision.
      updatePilotApplicationStatus({
        id: application.id,
        status: "approved",
        reviewed_by: adminId,
        review_notes: body.notes ?? application.review_notes,
      });
      return NextResponse.json({
        ok: true,
        message: `Application #${application.id} already provisioned (tenant ${application.tenant_id}).`,
      });
    }

    const seats = clampInt(body.seats, MIN_SEATS, MAX_SEATS, DEFAULT_SEATS);
    const durationDays = clampInt(body.durationDays, MIN_DAYS, MAX_DAYS, DEFAULT_DURATION_DAYS);

    let result;
    try {
      result = provisionPilot(application, { seats, durationDays });
    } catch (err) {
      console.error("[PILOT] Provisioning failed:", err);
      logSecurityEvent({
        user_id: adminId,
        username: adminUsername,
        action: "PILOT_PROVISIONING_FAILED",
        details: JSON.stringify({
          application_id: application.id,
          hospital: application.hospital_name,
          error: err instanceof Error ? err.message : String(err),
        }),
        severity: "error",
      });
      return NextResponse.json({ error: "Provisioning failed. Application not approved." }, { status: 500 });
    }

    updatePilotApplicationStatus({
      id: application.id,
      status: "approved",
      reviewed_by: adminId,
      review_notes: body.notes ?? null,
    });

    logSecurityEvent({
      user_id: adminId,
      username: adminUsername,
      action: "PILOT_PROVISIONED",
      details: JSON.stringify({
        application_id: application.id,
        hospital: application.hospital_name,
        tenant_id: result.institutionalAccountId,
        user_id: result.userId,
        is_new_user: result.isNewUser,
        seats,
        duration_days: durationDays,
      }),
      severity: "info",
    });

    try {
      await sendPilotWelcomeEmail({
        applicantName: application.contact_name,
        applicantEmail: application.email,
        hospitalName: application.hospital_name,
        magicLinkUrl: buildMagicLinkUrl(result.magicLinkToken),
        pilotEndsAt: result.pilotEndsAt,
        isNewUser: result.isNewUser,
      });
    } catch (err) {
      console.error("[PILOT] Welcome email failed (non-fatal — pilot is provisioned):", err);
    }

    return NextResponse.json({
      ok: true,
      message: `Approved ${application.hospital_name}. ${result.isNewUser ? "New user created" : "Existing user upgraded"}, ${seats} seats, ends ${new Date(result.pilotEndsAt).toLocaleDateString()}.`,
      tenant_id: result.institutionalAccountId,
      user_id: result.userId,
    });
  }

  // REJECT — send polite decline email
  if (newStatus === "rejected") {
    updatePilotApplicationStatus({
      id: application.id,
      status: "rejected",
      reviewed_by: adminId,
      review_notes: body.notes ?? null,
    });

    logSecurityEvent({
      user_id: adminId,
      username: adminUsername,
      action: "PILOT_APPLICATION_REVIEWED",
      details: JSON.stringify({
        application_id: application.id,
        hospital: application.hospital_name,
        new_status: "rejected",
        notes: body.notes ?? null,
      }),
      severity: "info",
    });

    try {
      await sendPilotDeclineEmail({
        applicantName: application.contact_name,
        applicantEmail: application.email,
        hospitalName: application.hospital_name,
      });
    } catch (err) {
      console.error("[PILOT] Decline email failed (non-fatal):", err);
    }

    return NextResponse.json({
      ok: true,
      message: `Application #${body.id} rejected. Decline email sent.`,
    });
  }

  // ARCHIVE / re-PENDING — quiet status updates, no provisioning, no email
  updatePilotApplicationStatus({
    id: application.id,
    status: newStatus,
    reviewed_by: adminId,
    review_notes: body.notes ?? null,
  });

  logSecurityEvent({
    user_id: adminId,
    username: adminUsername,
    action: "PILOT_APPLICATION_REVIEWED",
    details: JSON.stringify({
      application_id: application.id,
      hospital: application.hospital_name,
      new_status: newStatus,
      notes: body.notes ?? null,
    }),
    severity: "info",
  });

  return NextResponse.json({
    ok: true,
    message: `Application #${body.id} marked ${newStatus}.`,
  });
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const n = Math.floor(value);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
