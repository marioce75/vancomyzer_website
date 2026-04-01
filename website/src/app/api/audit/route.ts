import { NextRequest, NextResponse } from "next/server";
import { getAuditLog, getAuditSummary } from "@/lib/auditLog";

/**
 * GET /api/audit — Returns the audit log.
 *
 * Query params:
 *   ?summary=true  — Returns summary statistics only
 *   ?last=N        — Returns only the last N entries (default: all, max 500)
 */
export async function GET(request: NextRequest) {
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
