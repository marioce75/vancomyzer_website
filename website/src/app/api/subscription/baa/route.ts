import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { findUserById, getInstitutionalAccount, updateBaaStatus } from "@/lib/db";
import nodemailer from "nodemailer";

/**
 * POST /api/subscription/baa — Request a BAA for the user's institutional account.
 * Requires hospital or enterprise tier.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number((session.user as Record<string, unknown>).id);
  const user = findUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const tier = user.subscription_tier ?? "free";
  if (tier !== "hospital" && tier !== "enterprise") {
    return NextResponse.json(
      { error: "BAA requests require a Hospital or Enterprise plan." },
      { status: 403 }
    );
  }

  if (!user.institutional_account_id) {
    return NextResponse.json(
      { error: "No institutional account linked to this user." },
      { status: 400 }
    );
  }

  const account = getInstitutionalAccount(user.institutional_account_id);
  if (!account) {
    return NextResponse.json(
      { error: "Institutional account not found." },
      { status: 404 }
    );
  }

  if (account.baa_status === "active") {
    return NextResponse.json({ message: "BAA is already active.", baaStatus: "active" });
  }

  // Update status to pending
  updateBaaStatus(account.id, "pending");

  // Send notification email
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Vancomyzer™" <${process.env.SMTP_USER ?? "noreply@vancomyzer.com"}>`,
      to: "contact@dosys.health",
      subject: `BAA Request — ${account.institution_name}`,
      text: [
        `BAA request received from ${account.institution_name}.`,
        ``,
        `Account ID: ${account.id}`,
        `Institution: ${account.institution_name}`,
        `Plan: ${account.plan_tier}`,
        `Billing email: ${account.billing_email}`,
        `Requested by: ${user.full_name} (${user.email})`,
        ``,
        `Please prepare and send the BAA to the billing contact.`,
      ].join("\n"),
    });
  } catch (err) {
    // Log but don't fail — the status was already updated
    console.error("[BAA] Email send failed:", err);
  }

  return NextResponse.json({ message: "BAA request submitted.", baaStatus: "pending" });
}
