/**
 * Owner-only access policy for the study demo. Pure; callers supply a
 * cryptographically verified JWT, the fresh DB row and the DB session token.
 *
 * Allowed only when ALL hold:
 *   - STUDY_DEMO_ENABLED is exactly "true";
 *   - STUDY_DEMO_OWNER_USER_ID is a positive integer;
 *   - the request is a fully verified, active system administrator under the
 *     existing admin policy (fresh DB role/status, current single-session
 *     token, unexpired session, 60-min admin inactivity limit, MFA when
 *     enabled) — reused unchanged from the pediatric preview;
 *   - that administrator's stable account ID (users.id, the same value the
 *     session carries as user.id) equals the configured owner ID exactly.
 * Anything missing or malformed denies. No role is created or changed.
 */
import { pediatricAdminAllowed } from "../pediatric/access";

export interface StudyDemoConfig { ownerUserId: number }

/** Parse configuration; null (deny everyone) if the flag is off or the owner ID is missing or malformed. */
export function readStudyDemoConfig(env: Record<string, string | undefined>): StudyDemoConfig | null {
  if (env.STUDY_DEMO_ENABLED !== "true") return null;
  const raw = env.STUDY_DEMO_OWNER_USER_ID;
  if (typeof raw !== "string" || !/^[1-9]\d{0,15}$/.test(raw)) return null;
  const ownerUserId = Number(raw);
  if (!Number.isSafeInteger(ownerUserId)) return null;
  return { ownerUserId };
}

type AdminRow = Parameters<typeof pediatricAdminAllowed>[1];

export function studyDemoOwnerAllowed(
  config: StudyDemoConfig | null,
  token: Record<string, unknown> | null,
  user: AdminRow,
  sessionToken: string | null,
  now = Date.now(),
): boolean {
  if (!config || !token || !user) return false;
  if (user.id !== config.ownerUserId) return false;
  if (token.id !== String(config.ownerUserId)) return false;
  return pediatricAdminAllowed(token, user, sessionToken, now);
}
