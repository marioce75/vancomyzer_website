/**
 * GET /api/admin/calculations
 *
 * System-wide calculation feed for system superadmins (users.role
 * === 'admin'). Distinct from /api/team/audit (which is scoped to a
 * single institution and gated by institutional_role).
 *
 * Query params:
 *   institutional_account_id  scope to one institution
 *   user_email                substring search
 *   workflow_type             "empiric" | "existing"
 *   pk_model                  "colin_2019" | "vancomyzer_obesity"
 *   start_date / end_date     ISO timestamps
 *   limit / offset            pagination
 *
 * Middleware already enforces role === 'admin' for /admin and /api/admin
 * paths, so a defensive re-check here is belt-and-braces only.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  listSuperadminCalcFeed,
  countSuperadminCalcFeed,
  purgeOldCalculationsIfNeeded,
} from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as Record<string, unknown> | undefined)?.role as string | undefined;
  if (role !== "admin") {
    return NextResponse.json({ error: "Superadmin access required." }, { status: 403 });
  }

  purgeOldCalculationsIfNeeded();

  const url = new URL(req.url);
  const filters = {
    institutional_account_id: url.searchParams.get("institutional_account_id")
      ? Number(url.searchParams.get("institutional_account_id"))
      : undefined,
    user_email: url.searchParams.get("user_email") ?? undefined,
    workflow_type: url.searchParams.get("workflow_type") ?? undefined,
    pk_model: url.searchParams.get("pk_model") ?? undefined,
    start_date: url.searchParams.get("start_date") ?? undefined,
    end_date: url.searchParams.get("end_date") ?? undefined,
    limit: Number(url.searchParams.get("limit") ?? 100),
    offset: Number(url.searchParams.get("offset") ?? 0),
  };

  const rows = listSuperadminCalcFeed(filters);
  const total = countSuperadminCalcFeed({
    institutional_account_id: filters.institutional_account_id,
    user_email: filters.user_email,
    workflow_type: filters.workflow_type,
    pk_model: filters.pk_model,
    start_date: filters.start_date,
    end_date: filters.end_date,
  });

  return NextResponse.json({ rows, total });
}
