import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getAuditLog, getAuditSummary } from "@/lib/auditLog";

/**
 * GET /api/audit — Returns the calculation audit log. ADMIN ONLY.
 *
 * Entries contain operational status, timing and model version only. The
 * admin-role check remains at the handler boundary.
 *
 * Query params:
 *   ?summary=true  — Returns summary statistics only
 *   ?last=N        — Returns only the last N entries (default: all, max 500)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const role = (session.user as Record<string, unknown>).role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Superadmin only." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  if (searchParams.get("summary") === "true") {
    return NextResponse.json(getAuditSummary());
  }

  const last = parseInt(searchParams.get("last") ?? "0", 10);
  const log = getAuditLog();

  if (last > 0) {
    return NextResponse.json(log.slice(-last));
  }

  return NextResponse.json(log);
}
