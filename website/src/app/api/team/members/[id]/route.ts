/**
 * DELETE /api/team/members/[id] → remove user from this institution
 * PATCH  /api/team/members/[id] { institutional_role: "user" | "admin" }
 *                                → toggle the per-seat admin role
 *
 * Both gated by requireInstitutionalAdmin().
 * Both prevent admin self-demotion / self-removal — the inviter cannot
 * lock themselves out by mistake. (System superadmin can intervene.)
 * The institution must always retain at least one admin.
 */

import { NextResponse } from "next/server";
import {
  findTeamMember,
  listTeamMembers,
  recountSeats,
  removeFromInstitution,
  setInstitutionalRole,
  logSecurityEvent,
} from "@/lib/db";
import { requireInstitutionalAdmin } from "@/lib/team";

interface Ctx {
  params: { id: string };
}

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const gate = await requireInstitutionalAdmin();
  if (!gate.ok) return gate.response;

  const memberId = parseId(params.id);
  if (memberId == null) {
    return NextResponse.json({ error: "Invalid member id." }, { status: 400 });
  }

  if (memberId === gate.user.id) {
    return NextResponse.json(
      { error: "You can't remove yourself. Ask another team admin to do this." },
      { status: 400 },
    );
  }

  const target = findTeamMember(gate.account.id, memberId);
  if (!target) {
    return NextResponse.json(
      { error: "Member not found in your institution." },
      { status: 404 },
    );
  }

  // If the target is the LAST remaining admin, refuse — prevents lockout.
  if (target.institutional_role === "admin") {
    const remainingAdmins = listTeamMembers(gate.account.id).filter(
      m => m.institutional_role === "admin" && m.id !== memberId,
    );
    if (remainingAdmins.length === 0) {
      return NextResponse.json(
        { error: "Can't remove the last team admin." },
        { status: 400 },
      );
    }
  }

  removeFromInstitution(memberId);
  recountSeats(gate.account.id);

  logSecurityEvent({
    user_id: gate.user.id,
    username: gate.user.username,
    action: "TEAM_MEMBER_REMOVED",
    details: JSON.stringify({
      institutional_account_id: gate.account.id,
      removed_user_id: memberId,
      removed_email: target.email,
    }),
    severity: "info",
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const gate = await requireInstitutionalAdmin();
  if (!gate.ok) return gate.response;

  const memberId = parseId(params.id);
  if (memberId == null) {
    return NextResponse.json({ error: "Invalid member id." }, { status: 400 });
  }

  let body: { institutional_role?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const role = body.institutional_role;
  if (role !== "user" && role !== "admin") {
    return NextResponse.json(
      { error: "institutional_role must be 'user' or 'admin'." },
      { status: 400 },
    );
  }

  if (memberId === gate.user.id && role === "user") {
    return NextResponse.json(
      { error: "You can't demote yourself. Ask another team admin to do this." },
      { status: 400 },
    );
  }

  const target = findTeamMember(gate.account.id, memberId);
  if (!target) {
    return NextResponse.json(
      { error: "Member not found in your institution." },
      { status: 404 },
    );
  }

  // Demoting the last admin would lock the team out — refuse.
  if (target.institutional_role === "admin" && role === "user") {
    const remainingAdmins = listTeamMembers(gate.account.id).filter(
      m => m.institutional_role === "admin" && m.id !== memberId,
    );
    if (remainingAdmins.length === 0) {
      return NextResponse.json(
        { error: "Can't demote the last team admin." },
        { status: 400 },
      );
    }
  }

  setInstitutionalRole(memberId, role);

  logSecurityEvent({
    user_id: gate.user.id,
    username: gate.user.username,
    action: "TEAM_MEMBER_ROLE_CHANGED",
    details: JSON.stringify({
      institutional_account_id: gate.account.id,
      target_user_id: memberId,
      new_role: role,
    }),
    severity: "info",
  });

  return NextResponse.json({ ok: true });
}
