import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { verifyMfaToken } from "@/lib/mfa";
import { findUserById, enableMfa, setMfaVerifiedAt, logSecurityEvent } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const user = session.user as Record<string, unknown>;
  const userId = Number(user.id);
  const username = String(user.username);
  if (!process.env.NEXTAUTH_SECRET) return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  const jwt = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (jwt?.id !== String(userId) || typeof jwt.sessionToken !== "string" || !jwt.sessionToken) return NextResponse.json({ error: "Current sign-in required." }, { status: 401 });

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const code = body.token?.trim();
  if (!code || code.length !== 6) {
    return NextResponse.json({ error: "Enter a 6-digit code." }, { status: 400 });
  }

  const dbUser = findUserById(userId);
  if (!dbUser?.mfa_secret) {
    return NextResponse.json({ error: "MFA not configured. Run setup first." }, { status: 400 });
  }

  const valid = verifyMfaToken(dbUser.mfa_secret, code);
  if (!valid) {
    logSecurityEvent({
      user_id: userId,
      username,
      action: "MFA_FAILED",
      severity: "warn",
    });
    return NextResponse.json({ error: "Invalid code. Try again." }, { status: 401 });
  }

  // Compare-and-set binds proof to the session that submitted the valid code.
  if (!setMfaVerifiedAt(userId, jwt.sessionToken)) return NextResponse.json({ error: "Session changed; sign in again." }, { status: 401 });

  // If MFA is not yet enabled, this is the first verification — enable it
  if (!dbUser.mfa_enabled) {
    enableMfa(userId);
    logSecurityEvent({
      user_id: userId,
      username,
      action: "MFA_SETUP_COMPLETE",
      severity: "info",
    });
  }

  logSecurityEvent({
    user_id: userId,
    username,
    action: "MFA_VERIFIED",
    severity: "info",
  });

  return NextResponse.json({ ok: true, verified: true });
}
