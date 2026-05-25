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
 * Notify a user that one of their referrals has converted to a paid
 * subscription — and that they've earned a 1-month credit (or it's
 * deferred to their first paid subscription if they're still on Free).
 *
 * Fires from the Stripe webhook when subscription becomes active for a
 * referred user, after the credit is applied via customer balance.
 */
export async function sendReferralConvertedEmail(args: {
  referrer_full_name: string;
  referrer_email: string;
  referred_email: string;
  credit_amount_usd: string;
  deferred: boolean;
}) {
  if (!process.env.SMTP_USER) {
    console.log("[EMAIL] Skipped referral-converted — SMTP not configured.", args.referrer_email);
    return;
  }
  try {
    const subject = args.deferred
      ? `You earned a Vancomyzer credit — applied when you next subscribe`
      : `Your Vancomyzer referral converted — $${args.credit_amount_usd} credit applied`;
    const bodyIntro = args.deferred
      ? `${args.referred_email} just subscribed to Vancomyzer Pro thanks to your referral. You've earned a $${args.credit_amount_usd} credit — we'll apply it automatically the next time you start a paid subscription.`
      : `${args.referred_email} just subscribed to Vancomyzer Pro thanks to your referral. We've applied a $${args.credit_amount_usd} credit to your account — it'll come off your next invoice automatically.`;
    await transporter.sendMail({
      from: FROM,
      to: args.referrer_email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px;">
          <h2 style="color: #047857; margin-bottom: 4px;">A referral converted ✓</h2>
          <p style="font-size: 14px; color: #2d3748;">
            Hello ${args.referrer_full_name},
          </p>
          <p style="font-size: 14px; color: #2d3748; line-height: 1.55;">
            ${bodyIntro}
          </p>
          <div style="margin-top: 16px; padding: 14px; background: #ecfdf5; border-left: 3px solid #047857; font-size: 13px; color: #065f46;">
            Thanks for sharing Vancomyzer with your colleagues. Keep going —
            each Pro conversion earns you another month.
          </div>
          <p style="margin-top: 16px;">
            <a href="${process.env.NEXTAUTH_URL ?? "https://vancomyzer.com"}/settings"
               style="display: inline-block; padding: 9px 18px; background: #1e4d8c; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 13px; border-radius: 4px;">
              See your referrals
            </a>
          </p>
          <p style="margin-top: 24px; font-size: 10px; color: #a0aec0;">Vancomyzer™ · Engineered by Dōsys Health LLC</p>
        </div>
      `,
    });
    console.log(`[EMAIL] Referral-converted email sent to ${args.referrer_email} (deferred=${args.deferred})`);
  } catch (err) {
    console.error("[EMAIL] Failed to send referral-converted email:", err);
  }
}

/**
 * Welcome a newly-registered user. Sent automatically on signup as part of
 * the auto-approval flow (v2026.05) — replaces the previous "wait for admin
 * approval" gating. Pairs with the admin notification email so both Mario
 * and the user know the account is live.
 */
export async function sendWelcomeEmail(user: {
  full_name: string;
  email: string;
  username: string;
}) {
  if (!process.env.SMTP_USER) {
    console.log("[EMAIL] Skipped welcome email — SMTP not configured:", user.username);
    return;
  }

  try {
    await transporter.sendMail({
      from: FROM,
      to: user.email,
      subject: "Welcome to Vancomyzer™ — your account is active",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px;">
          <h2 style="color: #047857; margin-bottom: 4px;">Welcome to Vancomyzer™ ✓</h2>
          <p style="font-size: 14px; color: #2d3748;">
            Hello ${user.full_name},
          </p>
          <p style="font-size: 14px; color: #2d3748; line-height: 1.55;">
            Your Vancomyzer™ account (<strong>${user.username}</strong>) is active and ready to use.
            No approval step required.
          </p>
          <p style="margin-top: 16px;">
            <a href="${process.env.NEXTAUTH_URL ?? "https://vancomyzer.com"}/login"
               style="display: inline-block; padding: 11px 24px; background: #1e4d8c; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 4px;">
              Sign In to Vancomyzer
            </a>
          </p>
          <div style="margin-top: 24px; padding: 14px; background: #f7fafc; border-left: 3px solid #1e4d8c; font-size: 12px; color: #4a5568; line-height: 1.55;">
            <strong style="color: #1a3a5c;">Reminder:</strong> Vancomyzer™ is non-device clinical
            decision support under 21st Century Cures Act §3060, intended for licensed healthcare
            professionals only. Every recommendation must be independently reviewed by a clinician
            prior to patient administration. Not a substitute for clinical judgment, institutional
            protocols, or therapeutic drug monitoring.
          </div>
          <p style="margin-top: 24px; font-size: 11px; color: #4a5568; line-height: 1.55;">
            Useful next steps:
          </p>
          <ul style="font-size: 11px; color: #4a5568; padding-left: 20px; line-height: 1.55;">
            <li><a href="${process.env.NEXTAUTH_URL ?? "https://vancomyzer.com"}/transparent-dosing" style="color: #1e4d8c;">Read how the engine works</a> (Transparent Dosing manifesto)</li>
            <li><a href="${process.env.NEXTAUTH_URL ?? "https://vancomyzer.com"}/transparent-dosing/cases" style="color: #1e4d8c;">See our Literature Reproducibility tests</a></li>
            <li><a href="${process.env.NEXTAUTH_URL ?? "https://vancomyzer.com"}/calculator" style="color: #1e4d8c;">Run your first calculation</a></li>
          </ul>
          <p style="margin-top: 24px; font-size: 10px; color: #a0aec0;">Vancomyzer™ · Engineered by <a href="https://dosys.health" style="color: inherit; text-decoration: underline;">Dōsys™</a></p>
        </div>
      `,
    });
    console.log(`[EMAIL] Welcome email sent to ${user.email}`);
  } catch (err) {
    console.error("[EMAIL] Failed to send welcome email:", err);
  }
}

/**
 * Notify user that their account has been approved.
 * (Legacy — auto-approval is now the default; this remains for any
 * remaining manual-approval edge cases.)
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
 * Welcome a freshly-provisioned hospital pilot.
 * BCC pilot@dosys.health (override via PILOT_NOTIFICATION_EMAIL) so sales
 * can do white-glove onboarding in parallel.
 */
export async function sendPilotWelcomeEmail(args: {
  applicantName: string;
  applicantEmail: string;
  hospitalName: string;
  magicLinkUrl: string;
  pilotEndsAt: string; // ISO-8601
  isNewUser: boolean;
}) {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL] Skipped — SMTP not configured. Pilot welcome for ${args.applicantEmail}`);
    return;
  }
  const bcc = process.env.PILOT_NOTIFICATION_EMAIL ?? ADMIN_EMAIL;
  const endsHuman = new Date(args.pilotEndsAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const escape = (s: string | null | undefined) =>
    String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  try {
    await transporter.sendMail({
      from: FROM,
      to: args.applicantEmail,
      bcc: bcc || undefined,
      subject: `Your Vancomyzer™ Hospital Pilot is Ready — ${args.hospitalName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 540px;">
          <h2 style="color: #047857; margin-bottom: 4px;">Your Hospital Pilot is Ready ✓</h2>
          <p style="font-size: 14px; color: #2d3748;">Hello ${escape(args.applicantName)},</p>
          <p style="font-size: 14px; color: #2d3748;">
            Your 90-day Vancomyzer™ pilot for <strong>${escape(args.hospitalName)}</strong> has been approved
            and provisioned. Click below to sign in${args.isNewUser ? " (no password needed)" : ""}.
          </p>
          <p style="margin-top: 18px;">
            <a href="${args.magicLinkUrl}"
               style="display: inline-block; padding: 12px 28px; background: #1e4d8c; color: #ffffff;
                      text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 4px;">
              Sign In to Vancomyzer
            </a>
          </p>
          <p style="margin-top: 12px; font-size: 12px; color: #718096;">
            This sign-in link expires in 15 minutes. Request a new one any time at
            <a href="https://vancomyzer.com/login">vancomyzer.com/login</a>.
          </p>
          <p style="margin-top: 18px; font-size: 13px; color: #2d3748;">
            <strong>Pilot details:</strong> Hospital tier · 10 seats · ends <strong>${escape(endsHuman)}</strong>.
            From the admin panel inside the app, you can invite your team and view audit logs immediately.
          </p>
          <p style="margin-top: 18px; font-size: 12px; color: #718096;">
            Questions? Reply to this email — your message reaches the Dōsys™ pilot team directly.
          </p>
          <p style="margin-top: 24px; font-size: 10px; color: #a0aec0;">
            Vancomyzer™ · Engineered by <a href="https://dosys.health" style="color: inherit; text-decoration: underline;">Dōsys™</a>
          </p>
        </div>
      `,
    });
    console.log(`[EMAIL] Pilot welcome sent to ${args.applicantEmail} (BCC ${bcc || "none"})`);
  } catch (err) {
    console.error("[EMAIL] Failed to send pilot welcome:", err);
  }
}

/**
 * Self-serve Department signup confirmation.
 * Sent when the Stripe webhook successfully provisions a new institutional
 * account from /upgrade/department. Includes a magic-link sign-in for the
 * purchasing user (who is the institution admin).
 */
export async function sendDepartmentWelcomeEmail(args: {
  adminName: string;
  adminEmail: string;
  institutionName: string;
  seats: number;
  trialEndsAt: string | null;
  magicLinkUrl: string;
}) {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL] Skipped — SMTP not configured. Department welcome for ${args.adminEmail}`);
    return;
  }
  const trialLine = args.trialEndsAt
    ? `Your 14-day free trial runs until <strong>${new Date(args.trialEndsAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</strong>.`
    : "Your subscription is active.";
  const escape = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  try {
    await transporter.sendMail({
      from: FROM,
      to: args.adminEmail,
      bcc: process.env.PILOT_NOTIFICATION_EMAIL ?? ADMIN_EMAIL ?? undefined,
      subject: `Welcome to Vancomyzer™ Department — ${args.institutionName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 540px;">
          <h2 style="color: #047857; margin-bottom: 4px;">Your Department is set up ✓</h2>
          <p style="font-size: 14px; color: #2d3748;">Hello ${escape(args.adminName)},</p>
          <p style="font-size: 14px; color: #2d3748;">
            Vancomyzer™ Department has been activated for <strong>${escape(args.institutionName)}</strong>
            with up to <strong>${args.seats}</strong> seats. You are the institution admin —
            you can invite teammates, manage seats, and view the audit log from the admin panel.
          </p>
          <p style="font-size: 14px; color: #2d3748;">${trialLine}</p>
          <p style="margin-top: 18px;">
            <a href="${args.magicLinkUrl}"
               style="display: inline-block; padding: 12px 28px; background: #1e4d8c; color: #ffffff;
                      text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 4px;">
              Sign In and Set Up Your Team
            </a>
          </p>
          <p style="margin-top: 12px; font-size: 12px; color: #718096;">
            This sign-in link expires in 15 minutes. Request a new one any time at
            <a href="https://vancomyzer.com/login">vancomyzer.com/login</a>.
          </p>
          <p style="margin-top: 24px; font-size: 10px; color: #a0aec0;">
            Vancomyzer™ · Engineered by <a href="https://dosys.health" style="color: inherit; text-decoration: underline;">Dōsys™</a>
          </p>
        </div>
      `,
    });
    console.log(`[EMAIL] Department welcome sent to ${args.adminEmail} for ${args.institutionName}`);
  } catch (err) {
    console.error("[EMAIL] Failed to send Department welcome:", err);
  }
}

/** Polite generic decline sent on REJECT. */
export async function sendPilotDeclineEmail(args: {
  applicantName: string;
  applicantEmail: string;
  hospitalName: string;
}) {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL] Skipped — SMTP not configured. Pilot decline for ${args.applicantEmail}`);
    return;
  }
  const escape = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  try {
    await transporter.sendMail({
      from: FROM,
      to: args.applicantEmail,
      subject: "About your Vancomyzer™ Pilot Application",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 540px;">
          <p style="font-size: 14px; color: #2d3748;">Hello ${escape(args.applicantName)},</p>
          <p style="font-size: 14px; color: #2d3748;">
            Thank you for your interest in piloting Vancomyzer™ at ${escape(args.hospitalName)}.
            After reviewing your application, we won't be moving forward with a pilot at this time.
          </p>
          <p style="font-size: 14px; color: #2d3748;">
            We appreciate your interest and welcome you to use the free version of Vancomyzer at any time at
            <a href="https://vancomyzer.com">vancomyzer.com</a>. If your circumstances change, you're
            welcome to reapply down the road.
          </p>
          <p style="margin-top: 24px; font-size: 10px; color: #a0aec0;">
            Vancomyzer™ · Engineered by <a href="https://dosys.health" style="color: inherit; text-decoration: underline;">Dōsys™</a>
          </p>
        </div>
      `,
    });
    console.log(`[EMAIL] Pilot decline sent to ${args.applicantEmail}`);
  } catch (err) {
    console.error("[EMAIL] Failed to send pilot decline:", err);
  }
}

/**
 * In-app bug report.
 * Recipient resolution: BUG_REPORT_EMAIL → PILOT_NOTIFICATION_EMAIL → ADMIN_EMAIL.
 * Failure logs and returns false; the API caller surfaces a generic error.
 */
export async function sendBugReport(args: {
  description: string;
  reporter: { username: string; email: string; full_name: string };
  userAgent: string | null;
  pageUrl: string | null;
}): Promise<boolean> {
  const recipient =
    process.env.BUG_REPORT_EMAIL ??
    process.env.PILOT_NOTIFICATION_EMAIL ??
    ADMIN_EMAIL;
  if (!recipient || !process.env.SMTP_USER) {
    console.log(`[EMAIL] Skipped — SMTP not configured. Bug report from ${args.reporter.username}`);
    return false;
  }

  const escape = (s: string | null | undefined) =>
    String(s ?? "—")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  // Render description with line breaks preserved
  const descriptionHtml = escape(args.description).replace(/\n/g, "<br>");

  try {
    await transporter.sendMail({
      from: FROM,
      to: recipient,
      replyTo: args.reporter.email,
      subject: `[Vancomyzer] Bug report — ${args.reporter.username}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px;">
          <h2 style="color: #1e4d8c; margin-bottom: 4px;">Bug Report</h2>
          <table style="font-size: 13px; border-collapse: collapse; width: 100%; margin-top: 8px;">
            <tr><td style="padding: 5px 12px; color: #718096; width: 130px;">Reporter</td><td style="padding: 5px 12px;">${escape(args.reporter.full_name)} <span style="color:#a0aec0;">(${escape(args.reporter.username)})</span></td></tr>
            <tr><td style="padding: 5px 12px; color: #718096;">Email</td><td style="padding: 5px 12px;"><a href="mailto:${escape(args.reporter.email)}">${escape(args.reporter.email)}</a></td></tr>
            <tr><td style="padding: 5px 12px; color: #718096;">Page</td><td style="padding: 5px 12px; font-family: monospace; font-size: 12px;">${escape(args.pageUrl)}</td></tr>
            <tr><td style="padding: 5px 12px; color: #718096; vertical-align: top;">User-Agent</td><td style="padding: 5px 12px; font-size: 11px; color: #4a5568;">${escape(args.userAgent)}</td></tr>
            <tr><td style="padding: 5px 12px; color: #718096;">Submitted</td><td style="padding: 5px 12px; font-size: 12px;">${new Date().toISOString()}</td></tr>
          </table>
          <div style="margin-top: 14px; padding: 12px 14px; background: #f7fafc; border-left: 3px solid #1e4d8c; font-size: 13px; color: #2d3748; line-height: 1.6;">
            ${descriptionHtml}
          </div>
          <p style="margin-top: 14px; font-size: 11px; color: #718096;">
            Reply directly to this email — it will reach the reporter.
          </p>
          <p style="margin-top: 24px; font-size: 10px; color: #a0aec0;">Vancomyzer™ · Engineered by <a href="https://dosys.health" style="color: inherit; text-decoration: underline;">Dōsys™</a></p>
        </div>
      `,
    });
    console.log(`[EMAIL] Bug report from ${args.reporter.username} sent to ${recipient}`);
    return true;
  } catch (err) {
    console.error("[EMAIL] Failed to send bug report:", err);
    return false;
  }
}

/** Sent when a pilot is revoked mid-cycle. Brief, blames nothing. */
export async function sendPilotRevokedEmail(args: {
  applicantName: string;
  applicantEmail: string;
  hospitalName: string;
}) {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL] Skipped — SMTP not configured. Pilot revoked for ${args.applicantEmail}`);
    return;
  }
  const escape = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  try {
    await transporter.sendMail({
      from: FROM,
      to: args.applicantEmail,
      subject: "Vancomyzer™ Pilot Access Update",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 540px;">
          <p style="font-size: 14px; color: #2d3748;">Hello ${escape(args.applicantName)},</p>
          <p style="font-size: 14px; color: #2d3748;">
            Your Vancomyzer™ pilot for ${escape(args.hospitalName)} has been ended.
            Please reach out to the Dōsys™ team if you'd like to discuss next steps.
          </p>
          <p style="margin-top: 24px; font-size: 10px; color: #a0aec0;">
            Vancomyzer™ · Engineered by <a href="https://dosys.health" style="color: inherit; text-decoration: underline;">Dōsys™</a>
          </p>
        </div>
      `,
    });
    console.log(`[EMAIL] Pilot revocation sent to ${args.applicantEmail}`);
  } catch (err) {
    console.error("[EMAIL] Failed to send pilot revocation:", err);
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
