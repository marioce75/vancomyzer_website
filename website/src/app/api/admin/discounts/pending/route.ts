/**
 * GET /api/admin/discounts/pending
 *
 * Returns the queue of submitted (status='pending') student/resident
 * discount applications for superadmin review.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { listPendingDiscountApplications } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as Record<string, unknown> | undefined)?.role;
  if (role !== "admin") return NextResponse.json({ error: "Superadmin only." }, { status: 403 });
  return NextResponse.json({ pending: listPendingDiscountApplications() });
}
