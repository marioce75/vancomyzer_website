import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { findUserById, getInstitutionalAccount } from "@/lib/db";

/**
 * GET /api/subscription — Returns the current user's subscription tier info.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number((session.user as Record<string, unknown>).id);
  const user = findUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const institutionalAccount = user.institutional_account_id
    ? getInstitutionalAccount(user.institutional_account_id)
    : null;

  return NextResponse.json({
    tier: user.subscription_tier ?? "free",
    expiry: user.subscription_expiry ?? null,
    institutionalAccount: institutionalAccount
      ? {
          id: institutionalAccount.id,
          name: institutionalAccount.institution_name,
          plan: institutionalAccount.plan_tier,
          baaStatus: institutionalAccount.baa_status,
          seatsAllocated: institutionalAccount.seats_allocated,
          seatsUsed: institutionalAccount.seats_used,
        }
      : null,
  });
}
