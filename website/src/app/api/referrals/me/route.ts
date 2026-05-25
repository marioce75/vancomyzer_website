/**
 * GET /api/referrals/me
 *
 * Returns the logged-in user's referral link + stats. The settings page
 * uses this to render the "invite a colleague, get 1 month free" card.
 *
 * Referral code is lazy-generated on first call so existing users (who
 * signed up before the feature shipped) get a code the first time they
 * visit the settings page.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { findUserByLogin, getOrCreateReferralCode, getReferralStats } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const user = findUserByLogin(session.user.email);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const code = getOrCreateReferralCode(user.id);
  const stats = getReferralStats(user.id);
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://vancomyzer.com";
  const referralUrl = `${baseUrl.replace(/\/$/, "")}/register?ref=${code}`;

  return NextResponse.json({
    code,
    url: referralUrl,
    stats,
  });
}
