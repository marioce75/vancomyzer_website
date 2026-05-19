/**
 * Transactional emails for the BAA flow.
 *
 * Two events generate mail:
 *  - sendBaaSubmittedEmails: customer uploaded a signed BAA → notify
 *    Mario (ADMIN_EMAIL) + send a receipt to the customer's signer.
 *  - sendBaaExecutedEmail: Mario countersigned → notify the customer's
 *    signer that the BAA is fully executed and attach the final PDF.
 *
 * SMTP failure is logged, not thrown — the calling endpoint should
 * already have committed the DB state so the customer is not blocked
 * by transient mail outages.
 */

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"Vancomyzer™" <${process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@vancomyzer.com"}>`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

interface BaaSubmittedContext {
  institutionName: string;
  institutionId: number;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  templateVersion: string;
  submittedAt: Date;
}

export async function sendBaaSubmittedEmails(ctx: BaaSubmittedContext): Promise<void> {
  if (!process.env.SMTP_USER) {
    console.log("[EMAIL] Skipped BAA submitted notifications — SMTP not configured.", ctx.institutionName);
    return;
  }

  const submittedAtIso = ctx.submittedAt.toISOString();
  const adminLink = `${process.env.NEXTAUTH_URL ?? "https://vancomyzer.com"}/admin/dashboard#baa-${ctx.institutionId}`;

  // --- Email 1: notify Mario ---
  if (ADMIN_EMAIL) {
    try {
      await transporter.sendMail({
        from: FROM,
        to: ADMIN_EMAIL,
        subject: `[Vancomyzer] BAA submitted — ${ctx.institutionName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px;">
            <h2 style="color: #1e4d8c; margin-bottom: 4px;">BAA Submitted — Awaiting Countersign</h2>
            <p style="font-size: 13px; color: #4a5568;">
              ${escapeHtml(ctx.institutionName)} has uploaded a signed BAA. Review the PDF and
              countersign in the admin panel to mark it as fully executed.
            </p>
            <table style="font-size: 13px; border-collapse: collapse; width: 100%; margin-top: 12px;">
              <tr><td style="padding: 6px 12px; color: #718096; width: 140px;">Institution</td><td style="padding: 6px 12px; font-weight: 600;">${escapeHtml(ctx.institutionName)}</td></tr>
              <tr><td style="padding: 6px 12px; color: #718096;">Signer</td><td style="padding: 6px 12px;">${escapeHtml(ctx.signerName)} (${escapeHtml(ctx.signerTitle)})</td></tr>
              <tr><td style="padding: 6px 12px; color: #718096;">Signer email</td><td style="padding: 6px 12px;">${escapeHtml(ctx.signerEmail)}</td></tr>
              <tr><td style="padding: 6px 12px; color: #718096;">Template version</td><td style="padding: 6px 12px;">${escapeHtml(ctx.templateVersion)}</td></tr>
              <tr><td style="padding: 6px 12px; color: #718096;">Submitted at</td><td style="padding: 6px 12px;">${escapeHtml(submittedAtIso)}</td></tr>
            </table>
            <p style="margin-top: 16px;">
              <a href="${adminLink}" style="display: inline-block; padding: 9px 18px; background: #1e4d8c; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 13px; border-radius: 4px;">
                Review &amp; countersign
              </a>
            </p>
            <p style="margin-top: 24px; font-size: 10px; color: #a0aec0;">Vancomyzer™ · Engineered by Dōsys Health LLC</p>
          </div>
        `,
      });
      console.log(`[EMAIL] BAA submitted notification sent to ${ADMIN_EMAIL} for ${ctx.institutionName}`);
    } catch (err) {
      console.error("[EMAIL] Failed to send BAA submitted notification to admin:", err);
    }
  }

  // --- Email 2: receipt to customer signer ---
  try {
    await transporter.sendMail({
      from: FROM,
      to: ctx.signerEmail,
      subject: `Vancomyzer™ BAA — Receipt of your signed copy`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px;">
          <h2 style="color: #1e4d8c; margin-bottom: 4px;">We received your signed BAA</h2>
          <p style="font-size: 13px; color: #2d3748; line-height: 1.55;">
            Hello ${escapeHtml(ctx.signerName)},
          </p>
          <p style="font-size: 13px; color: #2d3748; line-height: 1.55;">
            Thank you for submitting the signed Business Associate Agreement for
            <strong>${escapeHtml(ctx.institutionName)}</strong>. Our compliance team will countersign within
            one business day and email you the fully-executed PDF.
          </p>
          <p style="font-size: 13px; color: #2d3748; line-height: 1.55;">
            In the meantime, your team can continue using Vancomyzer freely — calculator
            access is not gated on BAA execution, and Vancomyzer does not persist patient
            identifiers in any case.
          </p>
          <table style="font-size: 13px; border-collapse: collapse; width: 100%; margin-top: 12px; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
            <tr><td style="padding: 8px 12px; color: #718096; width: 140px;">Template version</td><td style="padding: 8px 12px;">${escapeHtml(ctx.templateVersion)}</td></tr>
            <tr><td style="padding: 8px 12px; color: #718096;">Submitted at</td><td style="padding: 8px 12px;">${escapeHtml(submittedAtIso)}</td></tr>
          </table>
          <p style="margin-top: 24px; font-size: 12px; color: #4a5568;">
            If you did not initiate this submission, contact <a href="mailto:contact@dosys.health" style="color: #1e4d8c;">contact@dosys.health</a> immediately.
          </p>
          <p style="margin-top: 16px; font-size: 10px; color: #a0aec0;">Vancomyzer™ · Engineered by Dōsys Health LLC</p>
        </div>
      `,
    });
    console.log(`[EMAIL] BAA receipt sent to ${ctx.signerEmail} for ${ctx.institutionName}`);
  } catch (err) {
    console.error("[EMAIL] Failed to send BAA receipt to customer:", err);
  }
}

interface BaaExecutedContext {
  institutionName: string;
  signerName: string;
  signerEmail: string;
  countersignedAt: Date;
  executedPdfBytes?: Buffer;
}

export async function sendBaaExecutedEmail(ctx: BaaExecutedContext): Promise<void> {
  if (!process.env.SMTP_USER) {
    console.log("[EMAIL] Skipped BAA executed notification — SMTP not configured.", ctx.institutionName);
    return;
  }

  const teamLink = `${process.env.NEXTAUTH_URL ?? "https://vancomyzer.com"}/team`;

  try {
    await transporter.sendMail({
      from: FROM,
      to: ctx.signerEmail,
      subject: `Your Vancomyzer™ BAA is fully executed`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px;">
          <h2 style="color: #047857; margin-bottom: 4px;">BAA Executed ✓</h2>
          <p style="font-size: 13px; color: #2d3748; line-height: 1.55;">
            Hello ${escapeHtml(ctx.signerName)},
          </p>
          <p style="font-size: 13px; color: #2d3748; line-height: 1.55;">
            The Business Associate Agreement between <strong>${escapeHtml(ctx.institutionName)}</strong> and Dōsys Health LLC was
            countersigned on <strong>${escapeHtml(ctx.countersignedAt.toISOString().slice(0, 10))}</strong>. A copy of the fully-executed PDF
            is attached for your records.
          </p>
          <p style="font-size: 13px; color: #2d3748; line-height: 1.55;">
            You can also download the executed BAA at any time from your Team page.
          </p>
          <p style="margin-top: 16px;">
            <a href="${teamLink}" style="display: inline-block; padding: 9px 18px; background: #1e4d8c; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 13px; border-radius: 4px;">
              Open Team page
            </a>
          </p>
          <p style="margin-top: 24px; font-size: 10px; color: #a0aec0;">Vancomyzer™ · Engineered by Dōsys Health LLC</p>
        </div>
      `,
      attachments: ctx.executedPdfBytes
        ? [
            {
              filename: `Vancomyzer-BAA-Executed-${ctx.institutionName.replace(/[^A-Za-z0-9_-]+/g, "_")}.pdf`,
              content: ctx.executedPdfBytes,
              contentType: "application/pdf",
            },
          ]
        : undefined,
    });
    console.log(`[EMAIL] BAA executed notification sent to ${ctx.signerEmail} for ${ctx.institutionName}`);
  } catch (err) {
    console.error("[EMAIL] Failed to send BAA executed notification:", err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
