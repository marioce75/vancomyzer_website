import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db, { findUserByUsername, findUserByEmail } from "@/lib/db";
import { sendRegistrationNotification } from "@/lib/email";

export async function POST(request: NextRequest) {
  let body: {
    username?: string;
    email?: string;
    password?: string;
    full_name?: string;
    credentials?: string;
    institution?: string;
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

  const { username, email, password, full_name, credentials, institution } = body;

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

  // Insert user
  const stmt = db.prepare(`
    INSERT INTO users (username, email, password_hash, full_name, credentials, institution,
                       agreed_disclaimer, agreed_terms, confirmed_hcp, confirmed_age,
                       disclaimer_version, terms_version, agreement_timestamp, agreement_ip, status)
    VALUES (?, ?, ?, ?, ?, ?, 1, 1, 1, 1, 'March 2026', 'March 2026', datetime('now'), ?, 'pending')
  `);

  try {
    stmt.run(
      username!.trim(),
      email!.trim().toLowerCase(),
      password_hash,
      full_name!.trim(),
      credentials!.trim(),
      (institution ?? "").trim() || null,
      ip,
    );
  } catch (err) {
    console.error("[REGISTER]", err);
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }

  // Log registration + notify admin
  console.log(`[REGISTER] New registration: ${username} (${email}) — pending approval`);
  sendRegistrationNotification({
    full_name: full_name!.trim(),
    credentials: credentials!.trim(),
    institution: (institution ?? "").trim() || null,
    email: email!.trim().toLowerCase(),
    username: username!.trim(),
  });

  return NextResponse.json({
    ok: true,
    message: "Your account is pending review. You will be notified when approved.",
  });
}
