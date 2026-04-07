import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { listPendingUsers, listActiveUsers, approveUser, disableUser, findUserById, unlockAccount, logSecurityEvent } from "@/lib/db";
import { sendApprovalNotification, sendRejectionNotification } from "@/lib/email";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const role = (session.user as Record<string, unknown>).role;
  if (role !== "admin") return null;
  return session.user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  return NextResponse.json({
    pending: listPendingUsers().map(u => ({
      id: u.id, full_name: u.full_name, credentials: u.credentials,
      institution: u.institution, email: u.email, username: u.username,
      created_at: u.created_at, agreed_disclaimer: u.agreed_disclaimer,
      agreed_terms: u.agreed_terms, confirmed_hcp: u.confirmed_hcp,
    })),
    active: listActiveUsers().map(u => ({
      id: u.id, full_name: u.full_name, username: u.username, email: u.email,
      credentials: u.credentials, institution: u.institution, last_login: u.last_login,
      role: u.role, mfa_enabled: u.mfa_enabled, failed_login_attempts: u.failed_login_attempts,
      locked_until: u.locked_until,
    })),
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  let body: { action: string; userId: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { action, userId } = body;
  const user = findUserById(userId);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const adminUsername = (admin as Record<string, unknown>).username as string ?? "admin";

  if (action === "approve") {
    approveUser(userId, adminUsername);
    console.log(`[ADMIN] User ${user.username} approved by ${adminUsername}`);
    await sendApprovalNotification({ full_name: user.full_name, email: user.email, username: user.username });
    return NextResponse.json({ ok: true, message: `${user.username} approved. Notification email sent.` });
  }

  if (action === "disable") {
    disableUser(userId);
    console.log(`[ADMIN] User ${user.username} disabled by ${adminUsername}`);
    await sendRejectionNotification({ full_name: user.full_name, email: user.email, username: user.username });
    return NextResponse.json({ ok: true, message: `${user.username} disabled. Notification email sent.` });
  }

  if (action === "unlock") {
    unlockAccount(userId);
    logSecurityEvent({
      user_id: userId,
      username: user.username,
      action: "ACCOUNT_UNLOCKED",
      details: JSON.stringify({ unlocked_by: adminUsername }),
      severity: "info",
    });
    console.log(`[ADMIN] User ${user.username} unlocked by ${adminUsername}`);
    return NextResponse.json({ ok: true, message: `${user.username} account unlocked.` });
  }

  if (action === "force_reset") {
    // Generate a reset token and send password reset email
    const crypto = require("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000).toISOString(); // 1 hour
    const { setResetToken } = require("@/lib/db");
    setResetToken(userId, token, expires);
    logSecurityEvent({
      user_id: userId,
      username: user.username,
      action: "FORCE_PASSWORD_RESET",
      details: JSON.stringify({ initiated_by: adminUsername }),
      severity: "warn",
    });
    console.log(`[ADMIN] Password reset forced for ${user.username} by ${adminUsername}`);
    return NextResponse.json({ ok: true, message: `Password reset initiated for ${user.username}.` });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
