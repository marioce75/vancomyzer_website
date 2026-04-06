import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const TOPIC_EMAILS: Record<string, string> = {
  "hospital": "contact@vancomyzer.com",
  "research": "contact@dosys.health",
  "clinical": "contact@vancomyzer.com",
  "other": "contact@vancomyzer.com",
};

const TOPIC_LABELS: Record<string, string> = {
  "hospital": "Hospital / Institutional Pilot",
  "research": "Research & Academic",
  "clinical": "Clinical Support",
  "other": "General Inquiry",
};

export async function POST(request: NextRequest) {
  let body: { name?: string; email?: string; topic?: string; message?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { name, email, topic, message } = body;

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }
  if (!topic || !TOPIC_EMAILS[topic]) {
    return NextResponse.json({ error: "Please select a topic." }, { status: 400 });
  }
  if (!message || message.trim().length < 10) {
    return NextResponse.json({ error: "Message must be at least 10 characters." }, { status: 400 });
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("[CONTACT] Skipped — SMTP not configured.", { name, email, topic });
    return NextResponse.json({ ok: true, message: "Inquiry received." });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const toEmail = TOPIC_EMAILS[topic];
  const topicLabel = TOPIC_LABELS[topic];

  try {
    await transporter.sendMail({
      from: `"Vancomyzer™ Contact" <${process.env.SMTP_USER}>`,
      to: toEmail,
      replyTo: email.trim(),
      subject: `[Vancomyzer Contact] ${topicLabel} — ${name.trim()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px;">
          <h2 style="color: #1e4d8c; margin-bottom: 4px;">New Contact Inquiry</h2>
          <table style="font-size: 14px; border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 6px 12px; color: #718096; width: 100px;">Name</td><td style="padding: 6px 12px; font-weight: 600;">${name.trim()}</td></tr>
            <tr><td style="padding: 6px 12px; color: #718096;">Email</td><td style="padding: 6px 12px;"><a href="mailto:${email.trim()}">${email.trim()}</a></td></tr>
            <tr><td style="padding: 6px 12px; color: #718096;">Topic</td><td style="padding: 6px 12px;">${topicLabel}</td></tr>
          </table>
          <div style="margin-top: 16px; padding: 12px 16px; background: #f7fafc; border: 1px solid #e2e8f0; font-size: 14px; color: #2d3748; line-height: 1.6; white-space: pre-wrap;">${message.trim()}</div>
          <p style="margin-top: 24px; font-size: 10px; color: #a0aec0;">Vancomyzer™ Contact Form · vancomyzer.com</p>
        </div>
      `,
    });
    console.log(`[CONTACT] Inquiry sent to ${toEmail} from ${email} (${topicLabel})`);
  } catch (err) {
    console.error("[CONTACT] Failed to send:", err);
    return NextResponse.json({ error: "Failed to send inquiry. Please email us directly." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Inquiry sent successfully." });
}
