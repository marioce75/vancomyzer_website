/**
 * Phase 2 — provisioning a hospital-tier pilot from an approved application.
 *
 * Sequence (wrapped in a SQLite transaction so partial failures roll back):
 *   1. Create institutional_accounts row (hospital tier, configurable seats + expiry)
 *   2. Resolve the user — find by email or create a new magic-link-only user
 *   3. Link user to the institutional account as institution admin
 *   4. Stamp pilot_applications.tenant_id with the new institutional_account.id
 *
 * Magic-link token is generated AFTER the transaction commits (it's stateless,
 * so there's nothing to roll back). Email is fired by the caller, not here —
 * keeps DB and email concerns separate so a failed email doesn't undo the
 * provisioning.
 */

import crypto from "crypto";
import db, {
  findUserByEmail,
  createInstitutionalAccount,
  createPilotPrimaryUser,
  setUserInstitution,
  setUserTier,
  reactivateUser,
  setPilotApplicationTenant,
  recountSeats,
  type PilotApplicationRow,
} from "@/lib/db";
import { issueMagicLinkToken } from "@/lib/magicLink";

export interface ProvisionPilotOptions {
  /** Number of seats the pilot starts with. */
  seats: number;
  /** Days from now until the pilot expires. */
  durationDays: number;
}

export interface ProvisionPilotResult {
  institutionalAccountId: number;
  userId: number;
  isNewUser: boolean;
  magicLinkToken: string;
  pilotEndsAt: string; // ISO-8601
}

const DEFAULT_OPTS: ProvisionPilotOptions = { seats: 10, durationDays: 90 };

export function provisionPilot(
  application: PilotApplicationRow,
  opts: Partial<ProvisionPilotOptions> = {},
): ProvisionPilotResult {
  const { seats, durationDays } = { ...DEFAULT_OPTS, ...opts };

  const pilotEndsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const email = application.email.toLowerCase().trim();

  let institutionalAccountId = 0;
  let userId = 0;
  let isNewUser = false;

  db.transaction(() => {
    // 1. Institutional account
    institutionalAccountId = createInstitutionalAccount({
      institution_name: application.hospital_name,
      billing_email: email,
      plan_tier: "hospital",
      seats_allocated: seats,
      subscription_start: new Date().toISOString(),
      subscription_expiry: pilotEndsAt,
      baa_status: "not_requested",
      baa_requested_at: null,
    });

    // 2. Resolve user
    const existing = findUserByEmail(email);
    if (existing) {
      // Reuse the row. Re-enable if disabled, upgrade to hospital tier,
      // link to the new institution as admin.
      userId = existing.id;
      isNewUser = false;
      if (existing.status !== "active") {
        reactivateUser(existing.id);
      }
      setUserTier(existing.id, "hospital", pilotEndsAt);
      setUserInstitution(existing.id, institutionalAccountId, "admin");
    } else {
      // 2b. New user — magic-link only (random unguessable password_hash)
      const placeholderHash = crypto.randomBytes(48).toString("base64");
      userId = createPilotPrimaryUser({
        email,
        full_name: application.contact_name,
        credentials: application.contact_title,
        password_hash: placeholderHash,
        institutional_account_id: institutionalAccountId,
      });
      isNewUser = true;
      // tier is set in createPilotPrimaryUser, but we still need expiry
      setUserTier(userId, "hospital", pilotEndsAt);
    }

    // 3. Recount seats so seats_used reflects the new admin
    recountSeats(institutionalAccountId);

    // 4. Link the application row back to the tenant
    setPilotApplicationTenant(application.id, institutionalAccountId);
  })();

  // Magic-link token — stateless, generated post-commit
  const magicLinkToken = issueMagicLinkToken(email);

  return {
    institutionalAccountId,
    userId,
    isNewUser,
    magicLinkToken,
    pilotEndsAt,
  };
}

/** Build the magic-link URL the welcome email points at. */
export function buildMagicLinkUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "https://vancomyzer.com";
  return `${baseUrl}/api/auth/magic-link/callback?token=${encodeURIComponent(token)}`;
}
