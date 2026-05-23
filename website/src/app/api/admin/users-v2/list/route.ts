/**
 * GET /api/admin/users-v2/list
 *
 * Server-side filtered + paginated user list for the redesigned User
 * Management dashboard. Replaces the unfiltered `/api/admin` GET that
 * loaded ALL users into memory — unworkable past ~500 users.
 *
 * Query params:
 *   search                       free-text match on name/email/username/institution
 *   status                       active | pending | disabled
 *   tier                         free | individual_pro | department | hospital
 *   country                      ISO 3166-1 alpha-2
 *   institution_type             enum from userCategorization.ts
 *   institutional_account_id     number
 *   mfa_off                      "1" → only users with MFA disabled
 *   locked                       "1" → only currently-locked accounts
 *   inactive_days                number → last_login older than N days
 *   sort                         created_desc | created_asc | last_login_desc | name_asc | email_asc
 *   page                         1-indexed, default 1
 *   page_size                    default 50, max 200
 *
 * Auth: system superadmin only.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { listUsersPaginated, type UserListFilter } from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as Record<string, unknown> | undefined)?.role;
  if (role !== "admin") return NextResponse.json({ error: "Superadmin only." }, { status: 403 });

  const url = new URL(req.url);
  const q = url.searchParams;

  const filter: UserListFilter = {
    search: q.get("search") ?? undefined,
    status: q.get("status") ?? undefined,
    subscription_tier: q.get("tier") ?? undefined,
    country_code: q.get("country") ?? undefined,
    institution_type: q.get("institution_type") ?? undefined,
    institutional_account_id: q.get("institutional_account_id")
      ? Number(q.get("institutional_account_id"))
      : undefined,
    mfa_enabled: q.get("mfa_off") === "1" ? false : undefined,
    locked: q.get("locked") === "1" ? true : undefined,
    inactive_days: q.get("inactive_days") ? Number(q.get("inactive_days")) : undefined,
    sort: (q.get("sort") as UserListFilter["sort"]) ?? "created_desc",
    page: q.get("page") ? Number(q.get("page")) : 1,
    page_size: q.get("page_size") ? Number(q.get("page_size")) : 50,
  };

  const result = listUsersPaginated(filter);

  // Trim sensitive fields before returning to the client. password_hash,
  // session_token, mfa_secret, reset_token never leave the server.
  return NextResponse.json({
    users: result.users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      full_name: u.full_name,
      credentials: u.credentials,
      institution: u.institution,
      role: u.role,
      status: u.status,
      created_at: u.created_at,
      approved_at: u.approved_at,
      approved_by: u.approved_by,
      last_login: u.last_login,
      mfa_enabled: u.mfa_enabled,
      failed_login_attempts: u.failed_login_attempts,
      locked_until: u.locked_until,
      subscription_tier: u.subscription_tier,
      subscription_status: u.subscription_status,
      subscription_expiry: u.subscription_expiry,
      institutional_account_id: u.institutional_account_id,
      institutional_role: u.institutional_role,
      country_code: u.country_code,
      institution_type: u.institution_type,
      practice_setting: u.practice_setting,
    })),
    total: result.total,
    page: result.page,
    page_size: result.page_size,
    total_pages: result.total_pages,
  });
}
