import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import db from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { readContactRequest } from "@/lib/contact/request";
import { contactSchema } from "@/lib/contact/schema";
import { ACK_TRANSLATIONS, CONTACT_EMAIL, acknowledgementRecipient, claimAcknowledgement } from "@/lib/contact/accessAcknowledgement";

const TOPICS = {
  restricted_access: "Saved history and institutional access request",
  hospital: "Hospital / Institutional Pilot", research: "Research & Academic",
  clinical: "Clinical Support", technical: "Technical question", other: "General Inquiry",
};
export async function POST(request: NextRequest) {
  const input = await readContactRequest(request);
  if (!input.ok) return NextResponse.json({ error: "Invalid contact request." }, { status: input.status });
  const parsed = contactSchema.safeParse(input.body);
  if (!parsed.success) return NextResponse.json({ error: "Please check the contact form fields." }, { status: 400 });
  const rate = checkRateLimit(`contact:${getClientIp(request.headers)}`, 5, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Please wait before sending another enquiry." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    // Never claim receipt when no delivery transport is configured.
    return NextResponse.json({ error: "Message delivery is unavailable. Please email contact@vancomyzer.com." }, { status: 503 });
  }
  const body = parsed.data;
  const sender = process.env.SMTP_USER;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com", port: Number(process.env.SMTP_PORT ?? 465), secure: true,
    auth: { user: sender, pass: process.env.SMTP_PASS },
  });
  try {
    // Plain text prevents submitted HTML from becoming executable email content.
    const delivered = await transporter.sendMail({
      from: `"Vancomyzer Contact" <${sender}>`,
      to: body.topic === "research" ? "contact@dosys.health" : CONTACT_EMAIL,
      replyTo: body.email,
      subject: `[Vancomyzer Contact] ${TOPICS[body.topic]} — ${body.name}`,
      text: `Name: ${body.name}\nEmail: ${body.email}\nTopic: ${TOPICS[body.topic]}\n\n${body.message}`,
    });
    if (!delivered.accepted?.length) throw new Error("Contact recipient not accepted");
  } catch {
    return NextResponse.json({ error: "Failed to send inquiry. Please email us directly." }, { status: 503 });
  }
  const recipient = acknowledgementRecipient(body, process.env.ACCESS_REQUEST_ACK_ENABLED === "true" && !request.headers.has("auto-submitted") && !request.headers.has("list-id") && !request.headers.has("x-auto-response-suppress"), sender);
  if (recipient) {
    try {
      if (claimAcknowledgement(db, recipient)) {
        await transporter.sendMail({
          from: `"Vancomyzer Contact" <${sender}>`, to: recipient, replyTo: CONTACT_EMAIL,
          subject: ACK_TRANSLATIONS[body.locale].subject, text: ACK_TRANSLATIONS[body.locale].text,
          headers: { "Auto-Submitted": "auto-replied", "X-Auto-Response-Suppress": "All" },
        });
      }
    } catch {
      // The enquiry already reached the team. Do not encourage duplicate submission.
      console.error("[CONTACT] Restricted-access acknowledgement could not be confirmed; no automatic retry.");
    }
  }
  return NextResponse.json({ ok: true, message: "Inquiry sent successfully." });
}
