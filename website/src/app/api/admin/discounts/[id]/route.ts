/**
 * POST /api/admin/discounts/[id]
 * Body: { action: 'approve' | 'deny', reason?: string, expires_at?: string }
 *
 * Superadmin approves or denies a pending discount application. Approval
 * stamps verified_at + verified_by; denial stamps verified_at, verified_by,
 * denied_reason and the user can re-apply later.
 *
 * Emails the user with the outcome (and the next-step message: how the
 * discount auto-applies at Pro checkout if approved).
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  approveDiscountApplication,
  denyDiscountApplication,
  findUserById,
  findUserByLogin,
  getDiscountById,
  logSecurityEvent,
} from "@/lib/db";
import { sendDiscountDecisionEmail } from "@/lib/email";

interface Ctx { params: { id: string } }

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const role = (session.user as Record<string, unknown>).role;
  if (role !== "admin") return NextResponse.json({ error: "Superadmin only." }, { status: 403 });
  const admin = findUserByLogin(session.user.email);
  if (!admin) return NextResponse.json({ error: "Admin user not found." }, { status: 404 });

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  let body: { action?: string; reason?: string; expires_at?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Load the discount row + the target user (for email + audit)
  const discount = getDiscountById(id);
  if (!discount) return NextResponse.json({ error: "Discount not found." }, { status: 404 });
  if (discount.status !== "pending") {
    return NextResponse.json(
      { error: `Discount is already ${discount.status}; cannot re-decide.` },
      { status: 409 },
    );
  }
  const target = findUserById(discount.user_id);
  if (!target) return NextResponse.json({ error: "Target user not found." }, { status: 404 });

  if (body.action === "approve") {
    approveDiscountApplication(id, admin.username, body.expires_at);
    logSecurityEvent({
      user_id: admin.id,
      username: admin.username,
      action: "DISCOUNT_APPROVED",
      details: JSON.stringify({
        discount_id: id,
        target_user_id: target.id,
        target_email: target.email,
        discount_type: discount.discount_type,
        expires_at: body.expires_at ?? null,
      }),
      severity: "info",
    });
    void sendDiscountDecisionEmail({
      to_email: target.email,
      to_name: target.full_name,
      approved: true,
      discount_type: discount.discount_type,
    }).catch(() => {/* logged inside helper */});
    return NextResponse.json({ ok: true, message: `Approved ${discount.discount_type} discount for ${target.email}.` });
  }

  if (body.action === "deny") {
    const reason = body.reason?.trim() || "Application did not meet verification criteria.";
    denyDiscountApplication(id, admin.username, reason);
    logSecurityEvent({
      user_id: admin.id,
      username: admin.username,
      action: "DISCOUNT_DENIED",
      details: JSON.stringify({
        discount_id: id,
        target_user_id: target.id,
        target_email: target.email,
        reason,
      }),
      severity: "info",
    });
    void sendDiscountDecisionEmail({
      to_email: target.email,
      to_name: target.full_name,
      approved: false,
      discount_type: discount.discount_type,
      denied_reason: reason,
    }).catch(() => {/* logged inside helper */});
    return NextResponse.json({ ok: true, message: `Denied ${discount.discount_type} discount for ${target.email}.` });
  }

  return NextResponse.json({ error: "action must be 'approve' or 'deny'." }, { status: 400 });
}
