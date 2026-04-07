import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { listAllUsers, listPendingUsers, listActiveUsers, getSecuritySummary, getSecurityEvents } from "@/lib/db";

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

  // User counts
  const allUsers = listAllUsers();
  const pendingUsers = listPendingUsers();
  const activeUsers = listActiveUsers();
  const disabledCount = allUsers.filter((u) => u.status === "disabled").length;
  const mfaEnabledCount = allUsers.filter((u) => u.mfa_enabled === 1).length;

  // Security summary
  const security = getSecuritySummary();

  // Research summary (may not be available)
  let research = null;
  try {
    const { getResearchSummary } = require("@/lib/research/db");
    research = getResearchSummary();
  } catch {
    // Research module not available
  }

  // Health check (inline)
  let health = null;
  try {
    const db = require("@/lib/db").default;
    db.prepare("SELECT 1").get();
    health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "0.1.0",
      db: "connected",
      uptime_seconds: Math.floor(process.uptime()),
    };
  } catch {
    health = {
      status: "degraded",
      timestamp: new Date().toISOString(),
      version: "0.1.0",
      db: "error",
      uptime_seconds: Math.floor(process.uptime()),
    };
  }

  // Security events for audit log
  const securityEvents = getSecurityEvents(200);

  // MFA user status for admins
  const mfaUsers = allUsers
    .filter((u) => u.role === "admin" || u.mfa_enabled === 1)
    .map((u) => ({ id: u.id, username: u.username, role: u.role, mfa_enabled: u.mfa_enabled }));

  return NextResponse.json({
    users: {
      total: allUsers.length,
      pending: pendingUsers.length,
      active: activeUsers.length,
      disabled: disabledCount,
      mfaEnabled: mfaEnabledCount,
    },
    security: {
      total: security.total,
      failedLogins24h: security.failedLogins24h,
      lockedAccounts: security.lockedAccounts,
    },
    securityEvents,
    mfaUsers,
    research,
    health,
  });
}
