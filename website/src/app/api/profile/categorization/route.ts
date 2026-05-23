/**
 * GET  /api/profile/categorization → returns current country/institution_type/
 *                                    practice_setting + a boolean indicating
 *                                    whether the profile is complete.
 * POST /api/profile/categorization → updates the three fields. Validates
 *                                    against the enums in userCategorization.ts.
 *
 * Powers the "complete your profile" backfill prompt for users who signed
 * up before these fields were required (v2026.05).
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { findUserByLogin, setUserCategorization, logSecurityEvent } from "@/lib/db";
import {
  isValidCountryCode,
  isValidInstitutionType,
  isValidPracticeSetting,
} from "@/lib/userCategorization";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const user = findUserByLogin(session.user.email);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  const complete = !!(user.country_code && user.institution_type && user.practice_setting);
  return NextResponse.json({
    country_code: user.country_code,
    institution_type: user.institution_type,
    practice_setting: user.practice_setting,
    complete,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const user = findUserByLogin(session.user.email);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  let body: { country_code?: string; institution_type?: string; practice_setting?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const errors: string[] = [];
  if (!isValidCountryCode(body.country_code)) errors.push("Invalid country selection.");
  if (!isValidInstitutionType(body.institution_type)) errors.push("Invalid institution type.");
  if (!isValidPracticeSetting(body.practice_setting)) errors.push("Invalid practice setting.");
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  setUserCategorization(user.id, {
    country_code: body.country_code!,
    institution_type: body.institution_type!,
    practice_setting: body.practice_setting!,
  });

  logSecurityEvent({
    user_id: user.id,
    username: user.username,
    action: "PROFILE_CATEGORIZATION_COMPLETED",
    details: JSON.stringify({
      country_code: body.country_code,
      institution_type: body.institution_type,
      practice_setting: body.practice_setting,
    }),
    severity: "info",
  });

  return NextResponse.json({ ok: true });
}
