/**
 * GET /api/admin/users-v2/segments
 *
 * Returns the per-segment counts (status, tier, country, institution_type,
 * top orgs, health buckets, growth windows) that fuel the sidebar and
 * top-of-page widgets on the User Management dashboard.
 *
 * Auth: system superadmin only.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getUserSegmentCounts } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as Record<string, unknown> | undefined)?.role;
  if (role !== "admin") return NextResponse.json({ error: "Superadmin only." }, { status: 403 });
  return NextResponse.json(getUserSegmentCounts());
}
