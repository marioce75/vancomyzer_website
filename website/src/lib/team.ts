/**
 * Server-side helpers for the institutional (Department+) admin panel.
 *
 * "Institutional admin" = a user bound to an institutional_account_id
 * with institutional_role='admin' and a tier that grants the
 * org.admin_panel feature. This is a per-tenant role, distinct from
 * the system superadmin role (users.role='admin') that gates
 * /admin/dashboard/*.
 *
 * Email invite flow reuses magic-link sign-in:
 *   1. Inst admin calls POST /api/team/members { email }
 *   2. Server creates user row: status=active, institutional_account_id
 *      = inviter's, institutional_role='user', subscription_tier =
 *      inviter's tier, random temp password (unused unless they later
 *      reset via /reset-password)
 *   3. Server seat count is recomputed
 *   4. Magic-link sign-in email is sent — invitee clicks, signs in,
 *      lands on /calculator with full institution access
 *
 * No new token type, no new email template required for Phase 7.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  findUserByLogin,
  getUserTier,
  getInstitutionalAccount,
  type UserRow,
  type InstitutionalAccountRow,
} from "@/lib/db";
import { hasFeature, normalizeTier, type TierId } from "@/lib/tiers";

export type AdminGateResult =
  | {
      ok: true;
      user: UserRow;
      tier: TierId;
      account: InstitutionalAccountRow;
    }
  | {
      ok: false;
      response: NextResponse;
    };

/**
 * Gate a /api/team/* request. Caller pattern:
 *
 *   const gate = await requireInstitutionalAdmin();
 *   if (!gate.ok) return gate.response;
 *   const { user, tier, account } = gate;
 */
export async function requireInstitutionalAdmin(): Promise<AdminGateResult> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  const user = findUserByLogin(email);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "User not found." }, { status: 404 }),
    };
  }

  if (user.institutional_role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You are not an admin for this team." },
        { status: 403 },
      ),
    };
  }

  if (!user.institutional_account_id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Your account is not bound to an institution." },
        { status: 403 },
      ),
    };
  }

  const tier = normalizeTier(getUserTier(user.id));
  if (!hasFeature(tier, "org.admin_panel")) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Team management requires a Department or higher plan.",
          required_tier: "department",
          current_tier: tier,
        },
        { status: 403 },
      ),
    };
  }

  const account = getInstitutionalAccount(user.institutional_account_id);
  if (!account) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Institutional account not found." },
        { status: 404 },
      ),
    };
  }

  return { ok: true, user, tier, account };
}

/** Defensive client-side email shape check. Server still validates. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}
