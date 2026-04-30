/**
 * GET  /api/team/members          → list seats for the inviter's institution
 * POST /api/team/members { email,
 *                          full_name?,
 *                          credentials? }
 *                                  → create+activate user pre-bound to the
 *                                    inviter's institution and tier; sends
 *                                    magic-link sign-in email so the invitee
 *                                    can land in the calculator with one click
 *
 * Both endpoints are gated by requireInstitutionalAdmin().
 * POST additionally enforces the institutional account's seat cap.
 */

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import {
  createInvitedTeamMember,
  findUserByEmail,
  listTeamMembers,
  recountSeats,
  logSecurityEvent,
  setUserInstitution,
  setUserTier,
} from "@/lib/db";
import { issueMagicLinkToken } from "@/lib/magicLink";
import { requireInstitutionalAdmin, looksLikeEmail } from "@/lib/team";

export async function GET() {
  const gate = await requireInstitutionalAdmin();
  if (!gate.ok) return gate.response;
  const members = listTeamMembers(gate.account.id);
  return NextResponse.json({
    members,
    seats_used: gate.account.seats_used,
    seats_allocated: gate.account.seats_allocated,
    institution_name: gate.account.institution_name,
  });
}

export async function POST(req: Request) {
  try {
    return await handleInvite(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[team-invite] handler crashed:", message, stack);
    return NextResponse.json(
      { error: `Invite failed: ${message}` },
      { status: 500 },
    );
  }
}

async function handleInvite(req: Request): Promise<NextResponse> {
  const gate = await requireInstitutionalAdmin();
  if (!gate.ok) return gate.response;

  let body: { email?: string; full_name?: string; credentials?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email?.toLowerCase().trim();
  const fullName = (body.full_name ?? "").trim() || (email?.split("@")[0] ?? "Team Member");
  const credentials = (body.credentials ?? "").trim() || "Clinician";

  if (!email || !looksLikeEmail(email)) {
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  }

  // Three cases for an existing email:
  //   (a) already on THIS team   → 409 "already on your team"
  //   (b) bound to a DIFFERENT institution → 409 "in another institution"
  //   (c) unbound (e.g. previously removed, or a self-registered free user)
  //       → re-bind to this institution
  const existing = findUserByEmail(email);
  if (existing) {
    if (existing.institutional_account_id === gate.account.id) {
      return NextResponse.json(
        { error: "That email is already on your team." },
        { status: 409 },
      );
    }
    if (existing.institutional_account_id != null) {
      return NextResponse.json(
        { error: "That email is already part of another institution." },
        { status: 409 },
      );
    }
    // Case (c) — re-bind. Enforce seat cap first.
  }

  // Seat cap (re-check against persisted count, not the cached field)
  recountSeats(gate.account.id);
  const refreshed = listTeamMembers(gate.account.id);
  const seatsUsed = refreshed.length;
  if (seatsUsed >= gate.account.seats_allocated) {
    return NextResponse.json(
      {
        error: `Seat cap reached (${seatsUsed}/${gate.account.seats_allocated}). Contact sales to expand.`,
        seats_used: seatsUsed,
        seats_allocated: gate.account.seats_allocated,
      },
      { status: 409 },
    );
  }

  // Case (c) re-bind path: the user already has a record, just attach
  // them to this institution and copy the inviter's tier. Skip user
  // creation and re-send the magic-link email so they can sign in.
  if (existing) {
    setUserInstitution(existing.id, gate.account.id, "user");
    setUserTier(existing.id, gate.tier);
    recountSeats(gate.account.id);

    logSecurityEvent({
      user_id: gate.user.id,
      username: gate.user.username,
      action: "TEAM_MEMBER_REBOUND",
      details: JSON.stringify({
        institutional_account_id: gate.account.id,
        rebound_user_id: existing.id,
        rebound_email: email,
      }),
      severity: "info",
    });

    await sendMagicLinkInvite(email, gate.user.full_name ?? gate.user.username, gate.account.institution_name);

    return NextResponse.json({
      ok: true,
      user_id: existing.id,
      seats_used: seatsUsed + 1,
      seats_allocated: gate.account.seats_allocated,
      rebound: true,
    });
  }

  // Random temp password — invitee never sees it; they sign in via magic link
  // and can later reset via /reset-password.
  const tempPassword = crypto.randomBytes(24).toString("base64");
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const newUserId = createInvitedTeamMember({
    email,
    full_name: fullName,
    credentials,
    password_hash: passwordHash,
    institutional_account_id: gate.account.id,
    subscription_tier: gate.tier,
  });
  recountSeats(gate.account.id);

  logSecurityEvent({
    user_id: gate.user.id,
    username: gate.user.username,
    action: "TEAM_MEMBER_INVITED",
    details: JSON.stringify({
      institutional_account_id: gate.account.id,
      invitee_email: email,
      new_user_id: newUserId,
    }),
    severity: "info",
  });

  await sendMagicLinkInvite(email, gate.user.full_name ?? gate.user.username, gate.account.institution_name);

  return NextResponse.json({
    ok: true,
    user_id: newUserId,
    seats_used: seatsUsed + 1,
    seats_allocated: gate.account.seats_allocated,
  });
}

/** Send the magic-link sign-in email used by both new invites and re-binds. */
async function sendMagicLinkInvite(email: string, inviterName: string, institutionName: string) {
  const token = issueMagicLinkToken(email);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/api/auth/magic-link/callback?token=${encodeURIComponent(token)}`;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(`[team-invite] SMTP not configured. Dev sign-in link for ${email}: ${link}`);
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"Vancomyzer™" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `You've been invited to ${institutionName} on Vancomyzer™`,
      text:
        `${inviterName} has invited you to join ${institutionName} on Vancomyzer™.\n\n` +
        `Click here to activate your account and sign in:\n${link}\n\n` +
        `This link expires in 15 minutes. After signing in you can set a password from your account settings.\n\n` +
        `If you did not expect this invitation, you can safely ignore this email.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1f3a;">
          <h2 style="margin: 0 0 16px; font-size: 20px;">You're invited to Vancomyzer™</h2>
          <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #4a5568;">
            <strong>${inviterName}</strong> has invited you to join
            <strong>${institutionName}</strong> on Vancomyzer™.
          </p>
          <p style="margin: 0 0 32px;">
            <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #0d9488; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 14px;">
              Activate &amp; sign in
            </a>
          </p>
          <p style="margin: 0 0 8px; font-size: 12px; color: #718096; line-height: 1.6;">
            This link expires in 15 minutes. You can set a password later via account settings.
          </p>
          <p style="margin: 0; font-size: 12px; color: #718096; line-height: 1.6; word-break: break-all;">
            If the button doesn't work, paste this URL into your browser:<br/>${link}
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px;"/>
          <p style="margin: 0; font-size: 11px; color: #a0aec0;">
            If you did not expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[team-invite] email failed:", err);
    // Don't fail the whole request — user is bound, inviter can resend.
  }
}
