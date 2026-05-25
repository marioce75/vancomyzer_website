/**
 * POST /api/auth/register
 *
 * Self-serve account creation. As of v2026.05:
 *
 *   - ALL tiers auto-approve. No admin approval gate. The combination of
 *     the disclaimer / terms / HCP-confirmation / age-confirmation
 *     click-throughs + the magic-link email round-trip + (for paid)
 *     Stripe's own KYC is sufficient gating. Manual approval added
 *     friction without adding safety.
 *
 *   - Three categorization fields are REQUIRED: country_code,
 *     institution_type, practice_setting. These power the User Management
 *     dashboard's segment/filter sidebar. Validated against the enums in
 *     src/lib/userCategorization.ts.
 *
 *   - Two emails fire on success:
 *       1. Admin notification (Mario) — quantification + visibility
 *       2. User welcome — confirms account is active, links to sign in
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db, { findUserByUsername, findUserByEmail, createReferral, createAutoVerifiedStudentDiscount } from "@/lib/db";
import { sendRegistrationNotification, sendWelcomeEmail } from "@/lib/email";
import {
  isValidCountryCode,
  isValidInstitutionType,
  isValidPracticeSetting,
} from "@/lib/userCategorization";
import { detectStudentEmail } from "@/lib/discountEmail";

export async function POST(request: NextRequest) {
  let body: {
    username?: string;
    email?: string;
    password?: string;
    full_name?: string;
    credentials?: string;
    institution?: string;
    country_code?: string;
    institution_type?: string;
    practice_setting?: string;
    referral_code?: string;        // optional ?ref=<code> from invite link
    agreed_disclaimer?: boolean;
    agreed_terms?: boolean;
    confirmed_hcp?: boolean;
    confirmed_age?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const {
    username, email, password, full_name, credentials, institution,
    country_code, institution_type, practice_setting,
  } = body;

  // Validation
  const errors: string[] = [];
  if (!full_name || full_name.trim().length < 2) errors.push("Full name required (min 2 chars).");
  if (!credentials || credentials.trim().length < 2) errors.push("Professional credentials required.");
  if (!email || !email.includes("@")) errors.push("Valid email required.");
  if (!username || !/^[a-zA-Z0-9_]+$/.test(username) || username.length < 3) errors.push("Username required (alphanumeric, min 3 chars).");
  if (!password || password.length < 8) errors.push("Password min 8 characters.");
  if (password && (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password))) {
    errors.push("Password must contain uppercase, lowercase, and number.");
  }
  if (!body.agreed_disclaimer || !body.agreed_terms || !body.confirmed_hcp || !body.confirmed_age) {
    errors.push("All legal agreements must be accepted.");
  }
  if (!isValidCountryCode(country_code)) errors.push("Country selection required.");
  if (!isValidInstitutionType(institution_type)) errors.push("Institution type selection required.");
  if (!isValidPracticeSetting(practice_setting)) errors.push("Practice setting selection required.");

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  // Check duplicates
  if (findUserByUsername(username!)) {
    return NextResponse.json({ error: "Username already taken." }, { status: 409 });
  }
  if (findUserByEmail(email!)) {
    return NextResponse.json({ error: "Email already registered." }, { status: 409 });
  }

  // Hash password
  const password_hash = await bcrypt.hash(password!, 12);

  // Get client IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";

  // Insert user — status='active', approved_at=now(), approved_by='AUTO_REGISTRATION'
  const stmt = db.prepare(`
    INSERT INTO users (
      username, email, password_hash, full_name, credentials, institution,
      country_code, institution_type, practice_setting,
      agreed_disclaimer, agreed_terms, confirmed_hcp, confirmed_age,
      disclaimer_version, terms_version, agreement_timestamp, agreement_ip,
      status, approved_at, approved_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 1,
            'March 2026', 'March 2026', datetime('now'), ?,
            'active', datetime('now'), 'AUTO_REGISTRATION')
  `);

  let newUserId: number;
  try {
    const result = stmt.run(
      username!.trim(),
      email!.trim().toLowerCase(),
      password_hash,
      full_name!.trim(),
      credentials!.trim(),
      (institution ?? "").trim() || null,
      country_code!,
      institution_type!,
      practice_setting!,
      ip,
    );
    newUserId = Number(result.lastInsertRowid);
  } catch (err) {
    console.error("[REGISTER]", err);
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }

  // Record referral if the user signed up via /register?ref=<code>. Silent
  // no-op on self-referral, unknown code, or duplicate (already referred).
  const refCode = body.referral_code?.trim().toUpperCase();
  if (refCode) {
    const referral = createReferral(refCode, newUserId);
    if (referral) {
      console.log(`[REGISTER] Referral recorded: referrer ${referral.referrer_user_id} → new user ${newUserId} via code ${refCode}`);
    }
  }

  // Auto-detect student discount eligibility from email domain (.edu,
  // .ac.uk, etc.). Generous heuristic; residents and missed students
  // use the manual application form on /settings.
  if (detectStudentEmail(email!) === "student") {
    createAutoVerifiedStudentDiscount(newUserId);
    console.log(`[REGISTER] Student discount auto-verified for ${email} (school-email pattern)`);
  }

  console.log(`[REGISTER] New auto-approved registration: ${username} (${email}) · ${country_code} · ${institution_type}`);

  // Fire both emails — admin notification + user welcome. Done in parallel.
  await Promise.allSettled([
    sendRegistrationNotification({
      full_name: full_name!.trim(),
      credentials: credentials!.trim(),
      institution: (institution ?? "").trim() || null,
      email: email!.trim().toLowerCase(),
      username: username!.trim(),
    }),
    sendWelcomeEmail({
      full_name: full_name!.trim(),
      email: email!.trim().toLowerCase(),
      username: username!.trim(),
    }),
  ]);

  return NextResponse.json({
    ok: true,
    message: "Your account is active. Check your email for the sign-in link.",
  });
}
