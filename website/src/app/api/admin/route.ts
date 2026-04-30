import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  listAllUsers,
  approveUser,
  disableUser,
  reactivateUser,
  deleteUser,
  setUserRole,
  setUserTier,
  findUserById,
  unlockAccount,
  logSecurityEvent,
} from "@/lib/db";
import { sendApprovalNotification, sendRejectionNotification } from "@/lib/email";
import { normalizeTier } from "@/lib/tiers";

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

  // Return ALL users (pending + active + disabled) in one flat array so the
  // UI count and the table can never disagree.
  const users = listAllUsers().map(u => ({
    id: u.id,
    full_name: u.full_name,
    username: u.username,
    email: u.email,
    credentials: u.credentials,
    institution: u.institution,
    role: u.role,
    status: u.status,
    last_login: u.last_login,
    created_at: u.created_at,
    mfa_enabled: u.mfa_enabled,
    failed_login_attempts: u.failed_login_attempts,
    locked_until: u.locked_until,
    subscription_tier: u.subscription_tier,
    institutional_account_id: u.institutional_account_id,
    institutional_role: u.institutional_role,
    agreed_disclaimer: u.agreed_disclaimer,
    agreed_terms: u.agreed_terms,
    confirmed_hcp: u.confirmed_hcp,
  }));

  return NextResponse.json({
    users,
    // Back-compat: keep the old shape so any other consumer doesn't break.
    pending: users.filter(u => u.status === "pending"),
    active: users.filter(u => u.status === "active"),
    disabled: users.filter(u => u.status === "disabled"),
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  let body: { action: string; userId: number; role?: string; tier?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { action, userId } = body;
  const user = findUserById(userId);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const adminUsername = (admin as Record<string, unknown>).username as string ?? "admin";
  const adminId = Number((admin as Record<string, unknown>).id ?? 0);

  // Guard: superadmin cannot mutate their own account in destructive ways
  // (delete, disable, demote). Forces them to ask another superadmin.
  const isSelf = adminId === userId;
  const destructive = ["delete", "disable", "set_role"];
  if (isSelf && destructive.includes(action)) {
    return NextResponse.json(
      { error: "You can't perform this action on your own account. Ask another superadmin." },
      { status: 400 },
    );
  }

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

  if (action === "resend_approval") {
    await sendApprovalNotification({ full_name: user.full_name, email: user.email, username: user.username });
    console.log(`[ADMIN] Approval email resent to ${user.email} by ${adminUsername}`);
    return NextResponse.json({ ok: true, message: `Approval email resent to ${user.email}.` });
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

  if (action === "reactivate") {
    reactivateUser(userId);
    logSecurityEvent({
      user_id: userId,
      username: user.username,
      action: "ACCOUNT_REACTIVATED",
      details: JSON.stringify({ reactivated_by: adminUsername }),
      severity: "info",
    });
    console.log(`[ADMIN] User ${user.username} reactivated by ${adminUsername}`);
    return NextResponse.json({ ok: true, message: `${user.username} reactivated.` });
  }

  if (action === "delete") {
    // Final lockout safeguard: never delete the last system superadmin.
    if (user.role === "admin") {
      const allUsers = listAllUsers();
      const remainingAdmins = allUsers.filter(u => u.role === "admin" && u.id !== userId);
      if (remainingAdmins.length === 0) {
        return NextResponse.json(
          { error: "Cannot delete the last system superadmin." },
          { status: 400 },
        );
      }
    }
    deleteUser(userId);
    logSecurityEvent({
      user_id: adminId,
      username: adminUsername,
      action: "USER_DELETED",
      details: JSON.stringify({
        deleted_user_id: userId,
        deleted_email: user.email,
        deleted_username: user.username,
      }),
      severity: "critical",
    });
    console.log(`[ADMIN] User ${user.username} (id ${userId}) DELETED by ${adminUsername}`);
    return NextResponse.json({ ok: true, message: `${user.username} permanently deleted.` });
  }

  if (action === "set_role") {
    const role = body.role;
    if (role !== "admin" && role !== "pharmacist") {
      return NextResponse.json({ error: "role must be 'admin' or 'pharmacist'." }, { status: 400 });
    }
    // Guard: never demote the last system superadmin.
    if (user.role === "admin" && role === "pharmacist") {
      const allUsers = listAllUsers();
      const remainingAdmins = allUsers.filter(u => u.role === "admin" && u.id !== userId);
      if (remainingAdmins.length === 0) {
        return NextResponse.json(
          { error: "Cannot demote the last system superadmin." },
          { status: 400 },
        );
      }
    }
    setUserRole(userId, role);
    logSecurityEvent({
      user_id: adminId,
      username: adminUsername,
      action: "USER_ROLE_CHANGED",
      details: JSON.stringify({
        target_user_id: userId,
        old_role: user.role,
        new_role: role,
      }),
      severity: "warn",
    });
    console.log(`[ADMIN] User ${user.username} role: ${user.role} → ${role} by ${adminUsername}`);
    return NextResponse.json({ ok: true, message: `${user.username} role set to ${role}.` });
  }

  if (action === "set_tier") {
    const tier = normalizeTier(body.tier);
    setUserTier(userId, tier);
    logSecurityEvent({
      user_id: adminId,
      username: adminUsername,
      action: "USER_TIER_CHANGED",
      details: JSON.stringify({
        target_user_id: userId,
        old_tier: user.subscription_tier,
        new_tier: tier,
      }),
      severity: "info",
    });
    console.log(`[ADMIN] User ${user.username} tier: ${user.subscription_tier} → ${tier} by ${adminUsername}`);
    return NextResponse.json({ ok: true, message: `${user.username} tier set to ${tier}.` });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
