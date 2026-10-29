/** Pure policy; callers must supply a cryptographically verified token and fresh DB row. */
export function pediatricAdminAllowed(token: Record<string, unknown> | null, user: {
  id: number; role: string; status: string; mfa_enabled: number;
  mfa_verified_at: string | null; mfa_verified_session_token?: string | null; last_login?: string | null;
} | undefined, sessionToken: string | null, now = Date.now()): boolean {
  if (!token || !user || user.role !== 'admin' || user.status !== 'active') return false;
  if (token.role !== 'admin' || String(user.id) !== token.id) return false;
  if (!sessionToken || token.sessionToken !== sessionToken) return false;
  const activity = token.lastActivity;
  if (typeof activity !== 'number' || !Number.isFinite(activity) || activity > now || now - activity >= 3600000) return false;
  if (typeof token.exp !== 'number' || !Number.isFinite(token.exp) || token.exp * 1000 <= now) return false;
  if (user.mfa_enabled === 1) {
    // Session-bound proof permits same-second MFA without accepting a previous login's proof.
    if (user.mfa_verified_session_token !== sessionToken) return false;
    const verified = user.mfa_verified_at ? Date.parse(user.mfa_verified_at.replace(' ', 'T') + (user.mfa_verified_at.endsWith('Z') ? '' : 'Z')) : NaN;
    if (!Number.isFinite(verified) || verified > now) return false;
  } else if (token.mfaPending === true) return false;
  return true;
}
