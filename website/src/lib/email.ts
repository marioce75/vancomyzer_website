import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: true, // SSL
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"Vancomyzer™" <${process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@vancomyzer.com"}>`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

/**
 * Notify admin that a new user registered and needs approval.
 */
export async function sendRegistrationNotification(user: {
  full_name: string;
  credentials: string;
  institution: string | null;
  email: string;
  username: string;
}) {
  if (!ADMIN_EMAIL || !process.env.SMTP_USER) {
    console.log("[EMAIL] Skipped — SMTP not configured. New registration:", user.username);
    return;
  }

  try {
    await transporter.sendMail({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `[Vancomyzer] New Registration — ${user.full_name}, ${user.credentials}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px;">
          <h2 style="color: #1e4d8c; margin-bottom: 4px;">New Registration Pending Approval</h2>
          <table style="font-size: 14px; border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 6px 12px; color: #718096; width: 120px;">Name</td><td style="padding: 6px 12px; font-weight: 600;">${user.full_name}</td></tr>
            <tr><td style="padding: 6px 12px; color: #718096;">Credentials</td><td style="padding: 6px 12px;">${user.credentials}</td></tr>
            <tr><td style="padding: 6px 12px; color: #718096;">Institution</td><td style="padding: 6px 12px;">${user.institution ?? "—"}</td></tr>
            <tr><td style="padding: 6px 12px; color: #718096;">Email</td><td style="padding: 6px 12px;">${user.email}</td></tr>
            <tr><td style="padding: 6px 12px; color: #718096;">Username</td><td style="padding: 6px 12px; font-weight: 600;">${user.username}</td></tr>
          </table>
          <p style="margin-top: 16px; font-size: 13px; color: #4a5568;">
            Log in to the <a href="${process.env.NEXTAUTH_URL ?? "https://vancomyzer.com"}/admin" style="color: #1e4d8c;">Admin Panel</a> to approve or reject.
          </p>
          <p style="margin-top: 24px; font-size: 10px; color: #a0aec0;">Vancomyzer™ · Engineered by <a href="https://dosys.health" style="color: inherit; text-decoration: underline;">Dōsys™</a></p>
        </div>
      `,
    });
    console.log(`[EMAIL] Registration notification sent to ${ADMIN_EMAIL} for ${user.username}`);
  } catch (err) {
    console.error("[EMAIL] Failed to send registration notification:", err);
  }
}

/**
 * Notify user that their account has been approved.
 */
export async function sendApprovalNotification(user: {
  full_name: string;
  email: string;
  username: string;
}) {
  if (!process.env.SMTP_USER) {
    console.log("[EMAIL] Skipped — SMTP not configured. Approved:", user.username);
    return;
  }

  try {
    await transporter.sendMail({
      from: FROM,
      to: user.email,
      subject: "Your Vancomyzer™ Account Has Been Approved",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px;">
          <h2 style="color: #047857; margin-bottom: 4px;">Account Approved ✓</h2>
          <p style="font-size: 14px; color: #2d3748;">
            Hello ${user.full_name},
          </p>
          <p style="font-size: 14px; color: #2d3748;">
            Your Vancomyzer™ account (<strong>${user.username}</strong>) has been approved.
            You can now sign in and access the calculator.
          </p>
          <p style="margin-top: 16px;">
            <a href="${process.env.NEXTAUTH_URL ?? "https://vancomyzer.com"}/login"
               style="display: inline-block; padding: 10px 24px; background: #1e4d8c; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">
              Sign In to Vancomyzer
            </a>
          </p>
          <p style="margin-top: 24px; font-size: 10px; color: #a0aec0;">Vancomyzer™ · Engineered by <a href="https://dosys.health" style="color: inherit; text-decoration: underline;">Dōsys™</a></p>
        </div>
      `,
    });
    console.log(`[EMAIL] Approval notification sent to ${user.email}`);
  } catch (err) {
    console.error("[EMAIL] Failed to send approval notification:", err);
  }
}

/**
 * Send password reset link to user.
 */
export async function sendPasswordResetEmail(user: {
  full_name: string;
  email: string;
  resetToken: string;
}) {
  if (!process.env.SMTP_USER) {
    console.log("[EMAIL] Skipped — SMTP not configured. Reset token:", user.resetToken);
    return;
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://vancomyzer.com";
  const resetUrl = `${baseUrl}/reset-password?token=${user.resetToken}`;

  try {
    await transporter.sendMail({
      from: FROM,
      to: user.email,
      subject: "Vancomyzer™ — Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px;">
          <h2 style="color: #1e4d8c; margin-bottom: 4px;">Password Reset</h2>
          <p style="font-size: 14px; color: #2d3748;">
            Hello ${user.full_name},
          </p>
          <p style="font-size: 14px; color: #2d3748;">
            We received a request to reset your Vancomyzer™ password. Click the button below to set a new password.
          </p>
          <p style="margin-top: 16px;">
            <a href="${resetUrl}"
               style="display: inline-block; padding: 12px 28px; background: #1e4d8c; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 4px;">
              Reset Password
            </a>
          </p>
          <p style="margin-top: 16px; font-size: 12px; color: #718096;">
            This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.
          </p>
          <p style="margin-top: 8px; font-size: 11px; color: #a0aec0; word-break: break-all;">
            ${resetUrl}
          </p>
          <p style="margin-top: 24px; font-size: 10px; color: #a0aec0;">Vancomyzer™ · Engineered by <a href="https://dosys.health" style="color: inherit; text-decoration: underline;">Dōsys™</a></p>
        </div>
      `,
    });
    console.log(`[EMAIL] Password reset sent to ${user.email}`);
  } catch (err) {
    console.error("[EMAIL] Failed to send password reset:", err);
  }
}

/**
 * Notify sales of a new pilot application from dosys.health/pilot.
 * Recipient resolution: PILOT_NOTIFICATION_EMAIL → ADMIN_EMAIL.
 * Failure here must NOT fail the ingest request — caller logs and continues.
 */
export async function sendPilotApplicationNotification(app: {
  id: number;
  contact_name: string;
  contact_title: string;
  hospital_name: string;
  email: string;
  phone: string | null;
  bed_count: number | null;
  current_monitoring: string | null;
  submitted_at: string;
  source: string;
}) {
  const recipient = process.env.PILOT_NOTIFICATION_EMAIL ?? ADMIN_EMAIL;
  if (!recipient || !process.env.SMTP_USER) {
    console.log(
      `[EMAIL] Skipped — SMTP not configured. Pilot application id=${app.id} hospital="${app.hospital_name}"`,
    );
    return;
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://vancomyzer.com";
  const reviewUrl = `${baseUrl}/admin/dashboard/pilot-applications`;

  const escape = (s: string | null | undefined) =>
    String(s ?? "—")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  try {
    await transporter.sendMail({
      from: FROM,
      to: recipient,
      subject: `[Vancomyzer] New pilot application — ${app.hospital_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 540px;">
          <h2 style="color: #1e4d8c; margin-bottom: 4px;">New Pilot Application</h2>
          <p style="font-size: 13px; color: #4a5568; margin-top: 4px;">
            Application <strong>#${app.id}</strong> · received via ${escape(app.source)}
          </p>
          <table style="font-size: 14px; border-collapse: collapse; width: 100%; margin-top: 8px;">
            <tr><td style="padding: 6px 12px; color: #718096; width: 160px;">Hospital</td><td style="padding: 6px 12px; font-weight: 600;">${escape(app.hospital_name)}</td></tr>
            <tr><td style="padding: 6px 12px; color: #718096;">Contact</td><td style="padding: 6px 12px;">${escape(app.contact_name)}, ${escape(app.contact_title)}</td></tr>
            <tr><td style="padding: 6px 12px; color: #718096;">Email</td><td style="padding: 6px 12px;"><a href="mailto:${escape(app.email)}">${escape(app.email)}</a></td></tr>
            <tr><td style="padding: 6px 12px; color: #718096;">Phone</td><td style="padding: 6px 12px;">${escape(app.phone)}</td></tr>
            <tr><td style="padding: 6px 12px; color: #718096;">Beds</td><td style="padding: 6px 12px;">${app.bed_count ?? "—"}</td></tr>
            <tr><td style="padding: 6px 12px; color: #718096;">Current monitoring</td><td style="padding: 6px 12px;">${escape(app.current_monitoring)}</td></tr>
            <tr><td style="padding: 6px 12px; color: #718096;">Submitted at</td><td style="padding: 6px 12px;">${escape(app.submitted_at)}</td></tr>
          </table>
          <p style="margin-top: 18px;">
            <a href="${reviewUrl}"
               style="display: inline-block; padding: 10px 22px; background: #1e4d8c; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">
              Review in Admin Panel
            </a>
          </p>
          <p style="margin-top: 24px; font-size: 10px; color: #a0aec0;">Vancomyzer™ · Engineered by <a href="https://dosys.health" style="color: inherit; text-decoration: underline;">Dōsys™</a></p>
        </div>
      `,
    });
    console.log(
      `[EMAIL] Pilot-application notification sent to ${recipient} for application id=${app.id}`,
    );
  } catch (err) {
    console.error("[EMAIL] Failed to send pilot-application notification:", err);
  }
}

/**
 * Notify user that their account has been rejected/disabled.
 */
export async function sendRejectionNotification(user: {
  full_name: string;
  email: string;
  username: string;
}) {
  if (!process.env.SMTP_USER) {
    console.log("[EMAIL] Skipped — SMTP not configured. Rejected:", user.username);
    return;
  }

  try {
    await transporter.sendMail({
      from: FROM,
      to: user.email,
      subject: "Vancomyzer™ Account Update",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px;">
          <h2 style="color: #991b1b; margin-bottom: 4px;">Account Not Approved</h2>
          <p style="font-size: 14px; color: #2d3748;">
            Hello ${user.full_name},
          </p>
          <p style="font-size: 14px; color: #2d3748;">
            Your Vancomyzer™ registration was not approved at this time.
            If you believe this is an error, please contact your administrator.
          </p>
          <p style="margin-top: 24px; font-size: 10px; color: #a0aec0;">Vancomyzer™ · Engineered by <a href="https://dosys.health" style="color: inherit; text-decoration: underline;">Dōsys™</a></p>
        </div>
      `,
    });
    console.log(`[EMAIL] Rejection notification sent to ${user.email}`);
  } catch (err) {
    console.error("[EMAIL] Failed to send rejection notification:", err);
  }
}
