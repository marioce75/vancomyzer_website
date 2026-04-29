/**
 * GET /api/history
 *
 * Returns the authenticated user's recent calculation history (90-day
 * retention). Gated on the history.calculation feature (Individual Pro
 * and above).
 *
 * Query params:
 *   limit         (1-500, default 50)
 *   offset        (default 0)
 *   workflow_type "empiric" | "existing" (optional)
 *   case_id       substring search (optional)
 *
 * Response:
 *   { rows: CalcLogEntry[], total: number }
 */

import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/featureGate";
import {
  listCalculationHistory,
  countCalculationHistory,
  purgeOldCalculationsIfNeeded,
} from "@/lib/db";

export async function GET(req: Request) {
  const gate = await requireFeature("history.calculation");
  if (!gate.allowed) return gate.response;

  // Lazy 90-day retention enforcement (cheap, runs at most once per 24h)
  purgeOldCalculationsIfNeeded();

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? 50);
  const offsetParam = Number(url.searchParams.get("offset") ?? 0);
  const workflowType = url.searchParams.get("workflow_type") ?? undefined;
  const caseIdSearch = url.searchParams.get("case_id") ?? undefined;

  const opts = {
    limit: Number.isFinite(limitParam) ? limitParam : 50,
    offset: Number.isFinite(offsetParam) ? offsetParam : 0,
    workflow_type: workflowType,
    case_id_search: caseIdSearch,
  };

  const rows = listCalculationHistory(gate.userId, opts);
  const total = countCalculationHistory(gate.userId, {
    workflow_type: workflowType,
    case_id_search: caseIdSearch,
  });

  return NextResponse.json({ rows, total });
}
