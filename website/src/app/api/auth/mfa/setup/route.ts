import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { generateMfaSecret, generateQrCode } from "@/lib/mfa";
import { setMfaSecret, findUserById, logSecurityEvent } from "@/lib/db";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const user = session.user as Record<string, unknown>;
  if (user.role !== "admin") return NextResponse.json({ error: "Admin only." }, { status: 403 });

  const userId = Number(user.id);
  const username = String(user.username);

  const { secret, otpauthUrl } = generateMfaSecret(username);
  const qrCode = await generateQrCode(otpauthUrl);

  // Store secret (not yet enabled — user must verify first)
  setMfaSecret(userId, secret);

  logSecurityEvent({
    user_id: userId,
    username,
    action: "MFA_SETUP_INITIATED",
    severity: "info",
  });

  return NextResponse.json({ qrCode, secret });
}
