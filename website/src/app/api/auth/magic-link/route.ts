/**
 * POST /api/auth/magic-link
 * Body: { email: string }
 *
 * Always returns 200 (regardless of whether the email matches a real
 * account) to avoid an account-enumeration oracle. If the email exists
 * and the account is active, a sign-in link is sent via the existing
 * SMTP transport.
 */

import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { findUserByEmail, logSecurityEvent } from "@/lib/db";
import { issueMagicLinkToken } from "@/lib/magicLink";

const GENERIC_RESPONSE = NextResponse.json({
  message: "If an account exists for that email, a sign-in link has been sent.",
});

export async function POST(req: Request) {
  let email: string | undefined;
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  }

  const user = findUserByEmail(email);

  // Generic response regardless of user existence — prevents enumeration.
  // Only send mail if account exists and is active.
  if (!user || user.status !== "active") {
    logSecurityEvent({
      action: "MAGIC_LINK_REQUESTED",
      username: email,
      details: JSON.stringify({ exists: !!user, status: user?.status ?? "none" }),
      severity: "info",
    });
    return GENERIC_RESPONSE;
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    // Dev fallback — log the link to the server console so devs can copy it
    const token = issueMagicLinkToken(email);
    const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auth/magic-link/callback?token=${encodeURIComponent(token)}`;
    console.warn(`[magic-link] SMTP not configured. Dev link for ${email}: ${link}`);
    return GENERIC_RESPONSE;
  }

  try {
    const token = issueMagicLinkToken(email);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://vancomyzer.com";
    const link = `${baseUrl}/api/auth/magic-link/callback?token=${encodeURIComponent(token)}`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"Vancomyzer™" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Your Vancomyzer™ sign-in link",
      text:
        `Click this link to sign in to Vancomyzer™:\n\n${link}\n\n` +
        `This link expires in 15 minutes and can be used only once. If you did not request this email, you can safely ignore it.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1f3a;">
          <h2 style="margin: 0 0 16px; font-size: 20px;">Sign in to Vancomyzer™</h2>
          <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #4a5568;">
            Click the button below to sign in. This link expires in 15 minutes.
          </p>
          <p style="margin: 0 0 32px;">
            <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #0d9488; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 14px;">
              Sign in to Vancomyzer™
            </a>
          </p>
          <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #718096;">
            If the button doesn't work, paste this URL into your browser:<br/>
            <span style="word-break: break-all;">${link}</span>
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px;"/>
          <p style="margin: 0; font-size: 11px; color: #a0aec0;">
            If you did not request this email, you can safely ignore it. No action required.
          </p>
        </div>
      `,
    });

    logSecurityEvent({
      user_id: user.id,
      username: user.username,
      action: "MAGIC_LINK_SENT",
      details: JSON.stringify({ email }),
      severity: "info",
    });
  } catch (err) {
    console.error("[magic-link] failed to send:", err);
    // Still return generic response so error doesn't leak account existence
  }

  return GENERIC_RESPONSE;
}
