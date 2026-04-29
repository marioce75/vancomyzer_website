/**
 * Server-side feature gate for API routes.
 *
 * Use in any route handler that exposes Pro+ functionality:
 *
 *   const gate = await requireFeature("history.calculation");
 *   if (!gate.allowed) return gate.response;
 *
 * Always re-reads the tier from the database (not the JWT) so Stripe
 * webhook updates take effect on the next request.
 *
 * Returns a discriminated union so the call site can either branch on
 * `.allowed` or pull the typed `userId` out without any cast.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { findUserByLogin, getUserTier } from "@/lib/db";
import { hasFeature, upgradeTargetFor, type FeatureId } from "@/lib/tiers";

export type FeatureGateResult =
  | {
      allowed: true;
      userId: number;
      tier: ReturnType<typeof getUserTier>;
    }
  | {
      allowed: false;
      response: NextResponse;
    };

export async function requireFeature(feature: FeatureId): Promise<FeatureGateResult> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "Authentication required.", feature },
        { status: 401 },
      ),
    };
  }

  const dbUser = findUserByLogin(email);
  if (!dbUser) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "User not found.", feature },
        { status: 404 },
      ),
    };
  }

  const tier = getUserTier(dbUser.id);

  if (!hasFeature(tier, feature)) {
    const upgrade = upgradeTargetFor(feature);
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: `This feature requires the ${upgrade.name} plan or higher.`,
          feature,
          required_tier: upgrade.id,
          current_tier: tier,
          upgrade_url: upgrade.cta.href,
        },
        { status: 403 },
      ),
    };
  }

  return { allowed: true, userId: dbUser.id, tier };
}
