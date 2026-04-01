import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { findUserByEmail, setResetToken } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { email } = body;
  if (!email) {
    return NextResponse.json({ error: "Email required." }, { status: 400 });
  }

  // Always return success to prevent email enumeration
  const successMsg = "If an account with that email exists, a password reset link has been sent.";

  const user = findUserByEmail(email.trim().toLowerCase());
  if (!user || user.status !== "active") {
    // Don't reveal whether the email exists
    return NextResponse.json({ ok: true, message: successMsg });
  }

  // Generate token — 64 hex chars, expires in 1 hour
  const resetToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  setResetToken(user.id, resetToken, expiresAt);

  await sendPasswordResetEmail({
    full_name: user.full_name,
    email: user.email,
    resetToken,
  });

  return NextResponse.json({ ok: true, message: successMsg });
}
