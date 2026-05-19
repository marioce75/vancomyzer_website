/**
 * GET /api/admin/baa/pending
 *
 * Superadmin queue endpoint: returns institutions whose BAA is awaiting
 * Dōsys countersign. Fuels the /admin/dashboard/baa page.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { listPendingBaaInstitutions } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const role = (session.user as Record<string, unknown>).role;
  if (role !== "admin") return NextResponse.json({ error: "Superadmin only." }, { status: 403 });

  const rows = listPendingBaaInstitutions();
  return NextResponse.json({
    pending: rows.map((r) => ({
      id: r.id,
      institution_name: r.institution_name,
      billing_email: r.billing_email,
      plan_tier: r.plan_tier,
      signer_name: r.baa_signer_name,
      signer_title: r.baa_signer_title,
      signer_email: r.baa_signer_email,
      submitted_at: r.baa_signed_at,
      template_version: r.baa_template_version,
    })),
  });
}
