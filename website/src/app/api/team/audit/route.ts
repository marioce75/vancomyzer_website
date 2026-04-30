/**
 * GET /api/team/audit?limit=&offset=
 *
 * Institution-scoped calculation audit feed. Joins user info; never
 * returns PHI. Gated by requireInstitutionalAdmin() — only team admins
 * see other members' calc activity.
 */

import { NextResponse } from "next/server";
import { listInstitutionAuditFeed, purgeOldCalculationsIfNeeded } from "@/lib/db";
import { requireInstitutionalAdmin } from "@/lib/team";

export async function GET(req: Request) {
  const gate = await requireInstitutionalAdmin();
  if (!gate.ok) return gate.response;

  // 90-day retention is shared with the user-facing history feature.
  purgeOldCalculationsIfNeeded();

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const rows = listInstitutionAuditFeed(gate.account.id, {
    limit: Number.isFinite(limit) ? limit : 100,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  return NextResponse.json({ rows, institution_name: gate.account.institution_name });
}
