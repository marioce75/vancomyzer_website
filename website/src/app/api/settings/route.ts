import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { findUserById } from "@/lib/db";
import {
  getSettingsForUser,
  saveInstitutionalSettings,
  DEFAULT_INSTITUTIONAL_SETTINGS,
  type InstitutionalSettings,
} from "@/lib/institutionalSettings";

/**
 * GET /api/settings — Returns the institutional settings for the logged-in user.
 * Merges institutional defaults with any institution-level overrides.
 */
export async function GET() {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ settings: DEFAULT_INSTITUTIONAL_SETTINGS });
  }

  const userId = (session.user as Record<string, unknown>).id;
  const user = userId ? findUserById(Number(userId)) : null;
  const institution = user?.institution ?? "";
  const settings = getSettingsForUser(institution);

  return NextResponse.json({ settings, institution: institution || "(none)" });
}

/**
 * PUT /api/settings — Update institutional settings.
 * Only updates the institution tied to the current user.
 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id;
  const user = userId ? findUserById(Number(userId)) : null;
  if (!user || !user.institution || user.institution.trim() === "") {
    return NextResponse.json(
      { error: "You must have an institution set in your profile to configure institutional settings." },
      { status: 400 }
    );
  }

  let body: Partial<InstitutionalSettings>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Validate numeric ranges
  const errors: string[] = [];
  if (body.auc24_target_low !== undefined && (body.auc24_target_low < 200 || body.auc24_target_low > 800)) {
    errors.push("AUC24 target low must be 200-800.");
  }
  if (body.auc24_target_high !== undefined && (body.auc24_target_high < 200 || body.auc24_target_high > 800)) {
    errors.push("AUC24 target high must be 200-800.");
  }
  if (body.max_infusion_rate_mg_per_min !== undefined && (body.max_infusion_rate_mg_per_min < 5 || body.max_infusion_rate_mg_per_min > 15)) {
    errors.push("Max infusion rate must be 5-15 mg/min.");
  }
  if (body.loading_dose_mg_per_kg !== undefined && (body.loading_dose_mg_per_kg < 15 || body.loading_dose_mg_per_kg > 35)) {
    errors.push("Loading dose must be 15-35 mg/kg.");
  }
  if (body.max_single_dose_mg !== undefined && (body.max_single_dose_mg < 500 || body.max_single_dose_mg > 4000)) {
    errors.push("Max single dose must be 500-4000 mg.");
  }
  if (body.max_daily_dose_mg !== undefined && (body.max_daily_dose_mg < 1000 || body.max_daily_dose_mg > 8000)) {
    errors.push("Max daily dose must be 1000-8000 mg.");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  saveInstitutionalSettings(user.institution, body);
  const updated = getSettingsForUser(user.institution);

  return NextResponse.json({ settings: updated, institution: user.institution });
}
