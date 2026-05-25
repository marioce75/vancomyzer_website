/**
 * GET  /api/discounts/me  → current discount status for the logged-in user
 * POST /api/discounts/me  → submit a manual application
 *                            (students whose email wasn't auto-detected,
 *                             OR residents)
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  findUserByLogin,
  getUserDiscount,
  submitDiscountApplication,
  logSecurityEvent,
  type DiscountApplicationInput,
} from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const user = findUserByLogin(session.user.email);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const discount = getUserDiscount(user.id);
  return NextResponse.json({ discount: discount ?? null });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const user = findUserByLogin(session.user.email);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const existing = getUserDiscount(user.id);
  if (existing && existing.status !== "denied") {
    return NextResponse.json(
      {
        error: `You already have a discount application with status '${existing.status}'. Contact support if this is wrong.`,
      },
      { status: 409 },
    );
  }

  let body: Partial<DiscountApplicationInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Validation
  if (body.discount_type !== "student" && body.discount_type !== "resident") {
    return NextResponse.json({ error: "discount_type must be 'student' or 'resident'." }, { status: 400 });
  }
  const required: Array<keyof DiscountApplicationInput> = [
    "program_name",
    "institution_name",
    "supervisor_name",
    "supervisor_email",
    "expected_completion",
  ];
  for (const field of required) {
    const val = body[field];
    if (typeof val !== "string" || val.trim().length < 2) {
      return NextResponse.json({ error: `${field} is required.` }, { status: 400 });
    }
  }

  const input: DiscountApplicationInput = {
    discount_type: body.discount_type,
    program_name: body.program_name!.trim(),
    institution_name: body.institution_name!.trim(),
    supervisor_name: body.supervisor_name!.trim(),
    supervisor_email: body.supervisor_email!.trim().toLowerCase(),
    expected_completion: body.expected_completion!.trim(),
    notes: body.notes?.trim() ?? undefined,
  };

  const row = submitDiscountApplication(user.id, input);

  logSecurityEvent({
    user_id: user.id,
    username: user.username,
    action: "DISCOUNT_APPLICATION_SUBMITTED",
    details: JSON.stringify({ discount_id: row.id, discount_type: input.discount_type, institution: input.institution_name }),
    severity: "info",
  });

  return NextResponse.json({
    ok: true,
    discount: row,
    message: "Your application has been submitted. We'll review within 1-2 business days and email you at " + user.email + ".",
  });
}
