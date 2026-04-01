import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserByResetToken, updatePassword } from "@/lib/db";

export async function POST(request: NextRequest) {
  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { token, password } = body;

  if (!token || !password) {
    return NextResponse.json({ error: "Token and password required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({ error: "Password must contain uppercase, lowercase, and number." }, { status: 400 });
  }

  const user = findUserByResetToken(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired reset link. Please request a new one." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  updatePassword(user.id, passwordHash);

  console.log(`[AUTH] Password reset completed for ${user.username} (${user.email})`);

  return NextResponse.json({ ok: true, message: "Password reset successfully. You can now sign in." });
}
